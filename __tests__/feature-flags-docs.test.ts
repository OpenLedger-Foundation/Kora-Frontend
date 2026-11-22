/**
 * Keeps the header table in `lib/featureFlags.ts` honest (Issue #774).
 *
 * The table is the first thing a contributor reads when adding a flag, and it
 * had silently fallen a flag behind `FEATURE_FLAGS` — `category-taxonomy-preview`
 * existed at runtime and in `FLAG_ENV_MAP` but not in the docs. A comment that
 * is almost right is worse than no comment, because it is believed.
 *
 * This reads the source file rather than importing it: the table is a comment,
 * so there is nothing to import. Asserting on it is the only way the "1:1"
 * acceptance criterion stays true past the next flag.
 *
 * Issue #1157 extends this to the `docs/` feature-flags page so the two
 * documentation surfaces cannot drift from the runtime keys independently.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "@/lib/featureFlags";

const SOURCE = readFileSync(join(process.cwd(), "lib/featureFlags.ts"), "utf8");
const ENV_EXAMPLE = readFileSync(join(process.cwd(), ".env.example"), "utf8");
const DOCS = readFileSync(join(process.cwd(), "docs/feature-flags.md"), "utf8");

/** Rows of the ` * | flag | ENV_VAR | description |` table in the file header. */
function parseHeaderTable(): Array<{ flag: string; envVar: string; description: string }> {
  return SOURCE.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("* |") && !line.includes("|---"))
    .map((line) =>
      line
        .replace(/^\* \|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length === 3 && cells[0] !== "Flag")
    .map(([flag, envVar, description]) => ({
      flag: flag!,
      envVar: envVar!,
      description: description!,
    }));
}

/**
 * Flags documented in `docs/feature-flags.md`.
 *
 * The docs page lists flags as backticked identifiers in bullet points, e.g.
 * `- \`category-taxonomy-preview\` — ...`. We only pick up backticked tokens
 * that look like flag slugs (lowercase kebab-case) so prose and env vars are
 * not mistaken for flags. The experimental section is included on purpose:
 * experimental flags are still runtime flags and must be documented.
 */
function parseDocsFlags(): string[] {
  const matches = DOCS.match(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

describe("featureFlags header documentation", () => {
  const rows = parseHeaderTable();

  it("parses a non-empty table (guards the test itself)", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("documents every runtime flag", () => {
    const documented = rows.map((r) => r.flag).sort();
    expect(documented).toEqual([...FEATURE_FLAGS].sort());
  });

  it("documents no flag that does not exist at runtime", () => {
    for (const row of rows) {
      expect(FEATURE_FLAGS).toContain(row.flag);
    }
  });

  it("names an env var for every flag", () => {
    for (const row of rows) {
      expect(row.envVar).toMatch(/^NEXT_PUBLIC_[A-Z0-9_]+$/);
    }
  });

  it("gives every flag a description", () => {
    for (const row of rows) {
      expect(row.description.length).toBeGreaterThan(0);
    }
  });

  it("uses the same env var names the runtime map does", () => {
    // The table is documentation for FLAG_ENV_MAP; a drifting name here sends
    // a contributor to set a variable that nothing reads.
    for (const row of rows) {
      expect(SOURCE).toContain(`"${row.envVar}"`);
    }
  });

  it("lists every documented env var in .env.example", () => {
    // Where a contributor actually goes to turn a flag on.
    for (const row of rows) {
      expect(ENV_EXAMPLE).toContain(row.envVar);
    }
  });
});

describe("docs/feature-flags.md parity with runtime flags", () => {
  const docsFlags = parseDocsFlags();

  it("parses at least one flag from the docs (guards the test itself)", () => {
    expect(docsFlags.length).toBeGreaterThan(0);
  });

  it("documents every runtime flag in docs/feature-flags.md", () => {
    // A new flag added to FEATURE_FLAGS without a docs entry fails here.
    const missing = [...FEATURE_FLAGS].filter((flag) => !docsFlags.includes(flag));
    expect(missing).toEqual([]);
  });

  it("documents no flag in docs/feature-flags.md that does not exist at runtime", () => {
    const stale = docsFlags.filter((flag) => !FEATURE_FLAGS.includes(flag));
    expect(stale).toEqual([]);
  });

  it("covers experimental flags in the docs", () => {
    // Experimental flags are still runtime flags; the docs page must not skip
    // them just because they live under a separate section.
    const experimental = [...FEATURE_FLAGS].filter((flag) =>
      SOURCE.includes(`"${flag}"`) && /experimental/i.test(SOURCE),
    );
    for (const flag of experimental) {
      expect(docsFlags).toContain(flag);
    }
  });
});

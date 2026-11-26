/**
 * i18n key parity — vitest counterpart to `npm run check:i18n`.
 *
 * The CI script (scripts/check-i18n.mjs) only runs when the i18n job is
 * triggered, so this suite pins the same contract inside the unit-test run:
 * every key defined in en.json exists in es/ar/pt-BR with a non-empty string,
 * and no locale drifts with keys en.json does not have.
 *
 * Issue #1118 additionally requires that every new transaction-history string
 * ships with translations, so the `transactions.drawer.clear*` keys added by
 * that issue are asserted explicitly below.
 */
import { describe, it, expect } from "vitest";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ar from "@/messages/ar.json";
import ptBR from "@/messages/pt-BR.json";

const LOCALES: Record<string, unknown> = {
  es,
  "pt-BR": ptBR,
  ar,
};

/** Recursively collect dot-notation key paths, mirroring check-i18n.mjs. */
function collectKeys(obj: unknown, prefix = ""): string[] {
  const keys: string[] = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function readPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      obj
    );
}

const enKeys = collectKeys(en);

describe("i18n parity across en/es/pt-BR/ar", () => {
  it("defines a non-trivial catalog", () => {
    expect(enKeys.length).toBeGreaterThan(500);
  });

  for (const [locale, messages] of Object.entries(LOCALES)) {
    describe(locale, () => {
      it("has full key parity with en.json", () => {
        const localeKeys = new Set(collectKeys(messages));
        const missing = enKeys.filter((key) => !localeKeys.has(key));
        const extra = [...localeKeys].filter((key) => !enKeys.includes(key));

        expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
      });

      it("has a non-empty string for every key", () => {
        const empty = enKeys.filter((key) => {
          const value = readPath(messages, key);
          // A few keys are string arrays (e.g. commandPalette.synonyms).
          if (Array.isArray(value)) {
            return value.length === 0 || value.some((entry) => !String(entry).trim());
          }
          return typeof value !== "string" || value.trim().length === 0;
        });
        expect(empty).toEqual([]);
      });
    });
  }
});

describe("transaction-history clear dialog (#1118)", () => {
  // The keys the localized confirm dialog in TransactionHistoryDrawer reads.
  const REQUIRED_KEYS = [
    "transactions.drawer.clearConfirm",
    "transactions.drawer.clearConfirmTitle",
    "transactions.drawer.clearConfirmCancel",
    "transactions.drawer.clearConfirmConfirm",
    "transactions.drawer.clearCleared",
    "transactions.drawer.clearAria",
  ];

  it.each(REQUIRED_KEYS)("%s exists in en.json", (key) => {
    expect(typeof readPath(en, key)).toBe("string");
  });

  for (const locale of Object.keys(LOCALES)) {
    it(`translates every clear-dialog key in ${locale}`, () => {
      const untranslated = REQUIRED_KEYS.filter((key) => {
        const value = readPath(LOCALES[locale], key);
        return typeof value !== "string" || value.trim().length === 0;
      });
      expect(untranslated).toEqual([]);
    });
  }
});

/**
 * Node module resolution hook so plain `node --experimental-strip-types`
 * can run scripts that reuse the app's TypeScript source (`lib/stellar/*`,
 * `lib/env.ts`, ...) unmodified.
 *
 * Those files use two things Node's ESM resolver doesn't do on its own:
 *   1. The `@/*` path alias (defined in tsconfig.json, understood by
 *      Next.js's bundler but not by plain Node).
 *   2. Extensionless relative specifiers (e.g. `./client`), which bundler
 *      resolution allows but ESM requires an explicit extension for.
 *
 * This hook rewrites both to real file:// URLs and hands off to Node's
 * default resolver, so no bundler or extra dependency (tsconfig-paths,
 * tsx, ts-node, ...) is needed to run a standalone script.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptsDir);

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", "/index.ts"];

function resolveMissingExtension(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return filePath; // let Node's resolver produce the real "not found" error
}

export async function resolve(specifier, context, nextResolve) {
  let targetUrl;

  if (specifier.startsWith("@/")) {
    targetUrl = pathToFileURL(path.join(rootDir, specifier.slice(2))).href;
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    targetUrl = new URL(specifier, context.parentURL).href;
  } else {
    // Bare specifier (npm package) — defer to Node's normal resolution.
    return nextResolve(specifier, context);
  }

  if (!/\.(ts|tsx|mjs|cjs|js|json)$/.test(targetUrl)) {
    const filePath = resolveMissingExtension(fileURLToPath(targetUrl));
    targetUrl = pathToFileURL(filePath).href;
  }

  return nextResolve(targetUrl, context);
}

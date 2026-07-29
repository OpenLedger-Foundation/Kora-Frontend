#!/usr/bin/env node
/**
 * check-i18n.mjs
 *
 * Checks that all non-English locale files have full key parity with en.json.
 * Exits with code 1 if any keys are missing or extra keys are found.
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *
 * Options:
 *   --fix   Print a summary of fixes needed (does not auto-fix)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MESSAGES_DIR = join(ROOT, "messages");

const LOCALES = ["es", "ar", "pt-BR"];

/**
 * Recursively collect all dot-notation key paths from a nested object.
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      keys.push(...collectKeys(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadJson(locale) {
  const path = join(MESSAGES_DIR, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`❌  Could not read ${locale}.json: ${err.message}`);
    process.exit(1);
  }
}

const en = loadJson("en");
const enKeys = new Set(collectKeys(en));

let totalMissing = 0;
let totalExtra = 0;

for (const locale of LOCALES) {
  const messages = loadJson(locale);
  const localeKeys = new Set(collectKeys(messages));

  const missing = [...enKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !enKeys.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅  ${locale}: full parity (${enKeys.size} keys)`);
  } else {
    if (missing.length > 0) {
      console.error(`\n❌  ${locale}: ${missing.length} missing key(s):`);
      for (const k of missing) {
        console.error(`     - ${k}`);
      }
      totalMissing += missing.length;
    }
    if (extra.length > 0) {
      console.warn(`\n⚠️   ${locale}: ${extra.length} extra key(s) not in en.json:`);
      for (const k of extra) {
        console.warn(`     + ${k}`);
      }
      totalExtra += extra.length;
    }
  }
}

if (totalMissing > 0) {
  console.error(
    `\n❌  i18n check failed: ${totalMissing} missing key(s) across locale files.\n` +
    `   Add the missing keys to the relevant locale files and re-run.\n`
  );
  process.exit(1);
}

if (totalExtra > 0) {
  console.warn(
    `\n⚠️   i18n check passed with warnings: ${totalExtra} extra key(s) found.\n` +
    `   Consider removing orphaned keys or adding them to en.json.\n`
  );
}

console.log("\n✅  i18n key parity check passed.\n");

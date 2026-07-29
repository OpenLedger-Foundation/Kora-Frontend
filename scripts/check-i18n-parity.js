/**
 * Fails the build if the locale message catalogs (messages/*.json) don't have
 * matching key sets, or if a translated value drops/adds an ICU placeholder
 * (e.g. `{count}`) relative to the English source — a common way a translation
 * silently breaks at render time.
 *
 * messages/en.json is treated as the source of truth. Every other locale must
 * have exactly the same set of keys, with exactly the same placeholders per key.
 */

const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const SOURCE_LOCALE = "en";

function readLocale(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function extractPlaceholders(value) {
  if (typeof value !== "string") return new Set();
  const matches = value.match(/\{[a-zA-Z0-9_]+\}/g) || [];
  return new Set(matches);
}

function listLocales() {
  return fs
    .readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function main() {
  const locales = listLocales();
  if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`Source locale "${SOURCE_LOCALE}.json" not found in ${MESSAGES_DIR}`);
    process.exit(1);
  }

  const source = flatten(readLocale(SOURCE_LOCALE));
  const sourceKeys = new Set(Object.keys(source));

  let hasErrors = false;

  for (const locale of locales) {
    if (locale === SOURCE_LOCALE) continue;

    const flat = flatten(readLocale(locale));
    const keys = new Set(Object.keys(flat));

    const missing = [...sourceKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !sourceKeys.has(k));

    const placeholderMismatches = [];
    for (const key of sourceKeys) {
      if (!keys.has(key)) continue; // already reported as missing
      const sourcePlaceholders = extractPlaceholders(source[key]);
      const localePlaceholders = extractPlaceholders(flat[key]);
      const sourceOnly = [...sourcePlaceholders].filter((p) => !localePlaceholders.has(p));
      const localeOnly = [...localePlaceholders].filter((p) => !sourcePlaceholders.has(p));
      if (sourceOnly.length || localeOnly.length) {
        placeholderMismatches.push({ key, sourceOnly, localeOnly });
      }
    }

    if (missing.length || extra.length || placeholderMismatches.length) {
      hasErrors = true;
      console.error(`\n=== ${locale}.json ===`);
      if (missing.length) {
        console.error(`  Missing ${missing.length} key(s) present in ${SOURCE_LOCALE}.json:`);
        missing.forEach((k) => console.error(`    - ${k}`));
      }
      if (extra.length) {
        console.error(`  Has ${extra.length} extra key(s) not present in ${SOURCE_LOCALE}.json:`);
        extra.forEach((k) => console.error(`    - ${k}`));
      }
      if (placeholderMismatches.length) {
        console.error(`  Placeholder mismatch on ${placeholderMismatches.length} key(s):`);
        placeholderMismatches.forEach(({ key, sourceOnly, localeOnly }) => {
          console.error(
            `    - ${key}: missing [${sourceOnly.join(", ")}] extra [${localeOnly.join(", ")}]`
          );
        });
      }
    } else {
      console.log(`${locale}.json: OK (${keys.size} keys, all placeholders match)`);
    }
  }

  if (hasErrors) {
    console.error(
      "\ni18n parity check failed. Every locale in messages/ must have the exact same keys " +
        `as ${SOURCE_LOCALE}.json, with matching ICU placeholders. Fix the mismatches above ` +
        "before merging."
    );
    process.exit(1);
  }

  console.log(`\nAll locales match ${SOURCE_LOCALE}.json (${sourceKeys.size} keys). i18n parity check passed.`);
}

main();

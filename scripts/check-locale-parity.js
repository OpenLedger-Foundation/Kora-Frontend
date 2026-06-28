const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const LOCALES = ['en', 'es']; // add other locales like 'ar' if needed

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadLocale(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Error loading ${locale}:`, err);
    process.exit(1);
  }
}

function main() {
  console.log('🔍 Checking locale file parity...\n');

  const localeData = {};
  const allKeys = new Set();

  for (const locale of LOCALES) {
    const data = loadLocale(locale);
    localeData[locale] = data;
    const keys = getAllKeys(data);
    keys.forEach(key => allKeys.add(key));
  }

  let hasIssues = false;

  for (const locale of LOCALES) {
    const currentKeys = new Set(getAllKeys(localeData[locale]));
    const missingKeys = [...allKeys].filter(key => !currentKeys.has(key));

    if (missingKeys.length > 0) {
      hasIssues = true;
      console.error(`❌ ${locale} is missing keys:`, missingKeys);
    } else {
      console.log(`✅ ${locale} has all keys`);
    }
  }

  if (hasIssues) {
    console.error('\nLocale parity check failed');
    process.exit(1);
  } else {
    console.log('\n✅ All locales are in parity');
  }
}

main();

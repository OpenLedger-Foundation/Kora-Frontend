const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../messages');
const localeFiles = fs.readdirSync(messagesDir).filter(file => file.endsWith('.json'));

const loadMessages = (file) => {
  const filePath = path.join(messagesDir, file);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const getKeys = (obj, prefix = '') => {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

const checkParity = () => {
  const messages = {};
  localeFiles.forEach(file => {
    messages[file] = loadMessages(file);
  });

  const allKeys = {};
  localeFiles.forEach(file => {
    allKeys[file] = new Set(getKeys(messages[file]));
  });

  const baseKeys = allKeys['en.json'];
  let hasErrors = false;

  for (const file of localeFiles) {
    if (file === 'en.json') continue;

    const keys = allKeys[file];

    // Check missing keys
    const missingKeys = [...baseKeys].filter(key => !keys.has(key));
    if (missingKeys.length > 0) {
      hasErrors = true;
      console.error(`❌ Missing keys in ${file}: ${missingKeys.join(', ')}`);
    }

    // Check extra keys
    const extraKeys = [...keys].filter(key => !baseKeys.has(key));
    if (extraKeys.length > 0) {
      hasErrors = true;
      console.error(`❌ Extra keys in ${file}: ${extraKeys.join(', ')}`);
    }
  }

  if (!hasErrors) {
    console.log('✅ All locale files are in parity!');
  }

  process.exit(hasErrors ? 1 : 0);
};

checkParity();

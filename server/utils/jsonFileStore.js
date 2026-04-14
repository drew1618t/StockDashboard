const fs = require('fs');
const path = require('path');

function ensureJsonFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, typeof defaultValue === 'function' ? defaultValue() : defaultValue);
  }
}

function readJsonFile(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
  }
}

function writeJsonFile(filePath, data, options = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const suffix = options.trailingNewline ? '\n' : '';
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + suffix);
}

module.exports = {
  ensureJsonFile,
  readJsonFile,
  writeJsonFile,
};

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ensureJsonFile,
  readJsonFile,
  writeJsonFile,
} = require('../server/utils/jsonFileStore');

test('jsonFileStore creates missing files and reads fallback safely', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-store-'));
  try {
    const filePath = path.join(tempDir, 'nested', 'data.json');
    assert.deepEqual(readJsonFile(filePath, { items: [] }), { items: [] });

    ensureJsonFile(filePath, () => ({ items: ['default'] }));
    assert.deepEqual(readJsonFile(filePath, { items: [] }), { items: ['default'] });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('jsonFileStore preserves pretty JSON and optional trailing newline', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-store-'));
  try {
    const filePath = path.join(tempDir, 'data.json');
    writeJsonFile(filePath, { a: 1, b: ['x'] }, { trailingNewline: true });

    const raw = fs.readFileSync(filePath, 'utf-8');
    assert.equal(raw.endsWith('\n'), true);
    assert.match(raw, /\n  "a": 1,/);
    assert.deepEqual(readJsonFile(filePath, null), { a: 1, b: ['x'] });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

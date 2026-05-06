// Simple JSON-file-backed store. One file per collection.
// Synchronous reads/writes are fine for a classroom-scale prototype.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureFile(name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8');
  return p;
}

function readAll(name) {
  const p = ensureFile(name);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[store] Corrupt ${name}, resetting.`, e);
    fs.writeFileSync(p, '[]', 'utf8');
    return [];
  }
}

function writeAll(name, items) {
  const p = ensureFile(name);
  fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf8');
}

module.exports = { readAll, writeAll };

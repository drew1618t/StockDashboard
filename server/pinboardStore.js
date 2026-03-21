const fs = require('fs');
const path = require('path');

const PINBOARD_PATH = path.join(__dirname, '..', 'data', 'pinboard.json');

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getDefaultNotes() {
  return {
    notes: [
      {
        id: makeId(),
        author: 'Kaili',
        text: "Don't forget your mom's birthday is next Thursday! I already got a card, just need you to sign it.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: makeId(),
        author: 'Andrew',
        text: 'Wi-Fi password changed to the usual format. Also moved the router to the office shelf.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: makeId(),
        author: 'Kaili',
        text: "Leftover pasta is in the blue container, second shelf. It's really good, don't skip it.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function ensureDataFile() {
  const dir = path.dirname(PINBOARD_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PINBOARD_PATH)) {
    fs.writeFileSync(PINBOARD_PATH, JSON.stringify(getDefaultNotes(), null, 2));
  }
}

function readData() {
  try {
    ensureDataFile();
    const raw = JSON.parse(fs.readFileSync(PINBOARD_PATH, 'utf-8'));
    if (!raw || !Array.isArray(raw.notes)) return getDefaultNotes();
    return raw;
  } catch {
    return getDefaultNotes();
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(PINBOARD_PATH, JSON.stringify(data, null, 2));
}

function normalizeAuthor(author) {
  const value = typeof author === 'string' ? author.trim() : '';
  if (!value) return 'Andrew';
  return value;
}

function getNotes() {
  const data = readData();
  data.notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  writeData(data);
  return data;
}

function addNote(text, author) {
  if (!text || typeof text !== 'string' || !text.trim()) return null;
  const data = readData();
  const now = new Date().toISOString();
  const note = {
    id: makeId(),
    author: normalizeAuthor(author),
    text: text.trim(),
    createdAt: now,
    updatedAt: now,
  };
  data.notes.unshift(note);
  writeData(data);
  return note;
}

function updateNote(id, updates) {
  const data = readData();
  const note = data.notes.find(item => item.id === id);
  if (!note) return null;
  if (typeof updates.text === 'string' && updates.text.trim()) {
    note.text = updates.text.trim();
  }
  if (typeof updates.author === 'string' && updates.author.trim()) {
    note.author = normalizeAuthor(updates.author);
  }
  note.updatedAt = new Date().toISOString();
  writeData(data);
  return note;
}

function deleteNote(id) {
  const data = readData();
  const idx = data.notes.findIndex(item => item.id === id);
  if (idx < 0) return false;
  data.notes.splice(idx, 1);
  writeData(data);
  return true;
}

module.exports = {
  getNotes,
  addNote,
  updateNote,
  deleteNote,
};

const express = require('express');

const defaultPinboardStore = require('../../pinboardStore');

function createPinboardRoutes(options = {}) {
  const pinboardStore = options.pinboardStore || defaultPinboardStore;
  const router = express.Router();

  router.get('/pinboard', (req, res) => {
    res.json(pinboardStore.getNotes());
  });

  router.post('/pinboard', (req, res) => {
    const note = pinboardStore.addNote(req.body.text, req.body.author);
    if (!note) return res.status(400).json({ error: 'Text is required' });
    res.status(201).json(note);
  });

  router.patch('/pinboard/:id', (req, res) => {
    const note = pinboardStore.updateNote(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  });

  router.delete('/pinboard/:id', (req, res) => {
    const ok = pinboardStore.deleteNote(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  });

  return router;
}

module.exports = {
  createPinboardRoutes,
};

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const {
  DEFAULT_UPLOAD_DIR,
  PUBLIC_UPLOAD_PREFIX,
} = require('../../pigeonImport');
const { getPigeonStore: defaultGetPigeonStore } = require('../../pigeonStore');
const { safeResolveUnder } = require('../../utils/pathSafety');

function createPigeonPhotoUpload(uploadDir) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(uploadDir, 'photos');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
      return cb(new Error('Only image files are allowed'));
    },
  });
}

function removePigeonUploadedFile(publicPath, uploadDir, publicUploadPrefix) {
  const prefix = `${publicUploadPrefix}/`;
  if (!publicPath || !publicPath.startsWith(prefix)) return;
  const relative = publicPath.slice(prefix.length).replace(/\//g, path.sep);
  const fullPath = safeResolveUnder(uploadDir, relative);
  if (!fullPath) return;
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.warn(`[pigeons] failed to remove uploaded file: ${err.message}`);
  }
}

function createPigeonRoutes(options = {}) {
  const getPigeonStore = options.getPigeonStore || defaultGetPigeonStore;
  const uploadDir = options.uploadDir || DEFAULT_UPLOAD_DIR;
  const publicUploadPrefix = options.publicUploadPrefix || PUBLIC_UPLOAD_PREFIX;
  const pigeonPhotoUpload = options.pigeonPhotoUpload || createPigeonPhotoUpload(uploadDir);
  const router = express.Router();

  router.get('/pigeons/summary', (req, res) => {
    res.json(getPigeonStore().getSummary());
  });

  router.get('/pigeons/locations', (req, res) => {
    res.json(getPigeonStore().getLocations());
  });

  router.post('/pigeons/locations', (req, res) => {
    const location = getPigeonStore().createLocation(req.body.name);
    if (!location) return res.status(400).json({ error: 'Room name is required' });
    res.status(201).json(location);
  });

  router.get('/pigeons/birds', (req, res) => {
    const birds = getPigeonStore().listBirds({
      status: req.query.status,
      locationId: req.query.locationId,
      search: req.query.search,
    });
    res.json({ birds, total: birds.length });
  });

  router.post('/pigeons/birds', (req, res) => {
    const bird = getPigeonStore().createBird(req.body);
    if (!bird) return res.status(400).json({ error: 'Could not create bird' });
    res.status(201).json(bird);
  });

  router.get('/pigeons/birds/:id', (req, res) => {
    const bird = getPigeonStore().getBirdDetail(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(bird);
  });

  router.patch('/pigeons/birds/:id', (req, res) => {
    const bird = getPigeonStore().updateBird(req.params.id, req.body);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(bird);
  });

  router.delete('/pigeons/birds/:id', (req, res) => {
    const ok = getPigeonStore().deleteBird(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Bird not found' });
    res.json({ deleted: true });
  });

  router.get('/pigeons/birds/:id/medications', (req, res) => {
    const bird = getPigeonStore().getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(getPigeonStore().listBirdMedications(req.params.id));
  });

  router.post('/pigeons/birds/:id/medications', (req, res) => {
    const medication = getPigeonStore().createMedication(req.params.id, req.body);
    if (!medication) return res.status(400).json({ error: 'Medication name is required' });
    res.status(201).json(medication);
  });

  router.post('/pigeons/birds/:id/notes', (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const note = store.addBirdNote(req.params.id, req.body);
    if (!note) return res.status(400).json({ error: 'Note text is required' });
    res.status(201).json(note);
  });

  router.post('/pigeons/birds/:id/weights', (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const weight = store.addBirdWeight(req.params.id, req.body);
    if (!weight) return res.status(400).json({ error: 'Valid date and positive gram weight are required' });
    res.status(201).json(weight);
  });

  router.patch('/pigeons/medications/:medId', (req, res) => {
    const medication = getPigeonStore().updateMedication(req.params.medId, req.body);
    if (!medication) return res.status(404).json({ error: 'Medication not found' });
    res.json(medication);
  });

  router.patch('/pigeons/notes/:noteId', (req, res) => {
    const store = getPigeonStore();
    if (!store.getNoteById(req.params.noteId)) return res.status(404).json({ error: 'Note not found' });
    const note = store.updateBirdNote(req.params.noteId, req.body);
    if (!note) return res.status(400).json({ error: 'Valid note date and note text are required' });
    res.json(note);
  });

  router.delete('/pigeons/medications/:medId', (req, res) => {
    const ok = getPigeonStore().deleteMedication(req.params.medId);
    if (!ok) return res.status(404).json({ error: 'Medication not found' });
    res.json({ deleted: true });
  });

  router.delete('/pigeons/notes/:noteId', (req, res) => {
    const note = getPigeonStore().deleteBirdNote(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  });

  router.post('/pigeons/medications/:medId/log-dose', (req, res) => {
    const log = getPigeonStore().logDose(req.params.medId, req.body);
    if (!log) return res.status(404).json({ error: 'Medication not found' });
    res.json(log);
  });

  router.post('/pigeons/medication-logs/:logId/undo-dose', (req, res) => {
    const log = getPigeonStore().undoDose(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/pigeons/medication-logs/:logId/skip-dose', (req, res) => {
    const log = getPigeonStore().skipDose(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/pigeons/medication-logs/:logId/undo-skip', (req, res) => {
    const log = getPigeonStore().undoSkip(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/pigeons/birds/:id/photos', pigeonPhotoUpload.array('photos', 10), (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const photos = (req.files || []).map(file => store.addPhoto(req.params.id, {
      photo_path: `${publicUploadPrefix}/photos/${file.filename}`,
      description: req.body.description,
      photo_type: req.body.photo_type,
    }));
    res.status(201).json(photos);
  });

  router.delete('/pigeons/photos/:photoId', (req, res) => {
    const photo = getPigeonStore().deletePhoto(req.params.photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    removePigeonUploadedFile(photo.photo_path, uploadDir, publicUploadPrefix);
    res.json({ deleted: true });
  });

  router.delete('/pigeons/weights/:weightId', (req, res) => {
    const weight = getPigeonStore().deleteBirdWeight(req.params.weightId);
    if (!weight) return res.status(404).json({ error: 'Weight not found' });
    res.json({ deleted: true });
  });

  return router;
}

module.exports = {
  createPigeonPhotoUpload,
  createPigeonRoutes,
  removePigeonUploadedFile,
};

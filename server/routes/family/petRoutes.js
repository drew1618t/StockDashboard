const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const { getPetStore: defaultGetPetStore } = require('../../petStore');
const { safeResolveUnder } = require('../../utils/pathSafety');

const DEFAULT_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'data', 'pets-uploads');
const PUBLIC_UPLOAD_PREFIX = '/family/animals/pets/uploads';

function createPetPhotoUpload(uploadDir) {
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

function removePetUploadedFile(publicPath, uploadDir, publicUploadPrefix) {
  const prefix = `${publicUploadPrefix}/`;
  if (!publicPath || !publicPath.startsWith(prefix)) return;
  const relative = publicPath.slice(prefix.length).replace(/\//g, path.sep);
  const fullPath = safeResolveUnder(uploadDir, relative);
  if (!fullPath) return;
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.warn(`[pets] failed to remove uploaded file: ${err.message}`);
  }
}

function createPetRoutes(options = {}) {
  const getPetStore = options.getPetStore || defaultGetPetStore;
  const uploadDir = options.petUploadDir || options.uploadDir || DEFAULT_UPLOAD_DIR;
  const publicUploadPrefix = options.petPublicUploadPrefix || PUBLIC_UPLOAD_PREFIX;
  const petPhotoUpload = options.petPhotoUpload || createPetPhotoUpload(uploadDir);
  const router = express.Router();

  router.get('/animals/pets/summary', (req, res) => {
    res.json(getPetStore().getSummary());
  });

  router.get('/animals/pets/pets', (req, res) => {
    const pets = getPetStore().listPets({
      status: req.query.status,
      animalType: req.query.animalType,
      search: req.query.search,
    });
    res.json({ pets, total: pets.length });
  });

  router.post('/animals/pets/pets', (req, res) => {
    const pet = getPetStore().createPet(req.body);
    if (!pet) return res.status(400).json({ error: 'Pet name and valid dates are required' });
    res.status(201).json(pet);
  });

  router.get('/animals/pets/pets/:id', (req, res) => {
    const pet = getPetStore().getPetDetail(req.params.id);
    if (!pet) return res.status(404).json({ error: 'Pet not found' });
    res.json(pet);
  });

  router.patch('/animals/pets/pets/:id', (req, res) => {
    const pet = getPetStore().updatePet(req.params.id, req.body);
    if (!pet) return res.status(400).json({ error: 'Pet not found or update is invalid' });
    res.json(pet);
  });

  router.delete('/animals/pets/pets/:id', (req, res) => {
    const ok = getPetStore().deletePet(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Pet not found' });
    res.json({ deleted: true });
  });

  router.get('/animals/pets/pets/:id/medications', (req, res) => {
    if (!getPetStore().getPetById(req.params.id)) return res.status(404).json({ error: 'Pet not found' });
    res.json(getPetStore().listPetMedications(req.params.id));
  });

  router.post('/animals/pets/pets/:id/medications', (req, res) => {
    const medication = getPetStore().createMedication(req.params.id, req.body);
    if (!medication) return res.status(400).json({ error: 'Medication name and valid schedule are required' });
    res.status(201).json(medication);
  });

  router.patch('/animals/pets/medications/:medId', (req, res) => {
    const medication = getPetStore().updateMedication(req.params.medId, req.body);
    if (!medication) return res.status(400).json({ error: 'Medication not found or update is invalid' });
    res.json(medication);
  });

  router.delete('/animals/pets/medications/:medId', (req, res) => {
    const ok = getPetStore().deleteMedication(req.params.medId);
    if (!ok) return res.status(404).json({ error: 'Medication not found' });
    res.json({ deleted: true });
  });

  router.post('/animals/pets/medications/:medId/log-dose', (req, res) => {
    const log = getPetStore().logDose(req.params.medId, req.body);
    if (!log) return res.status(404).json({ error: 'Medication or pending dose not found' });
    res.json(log);
  });

  router.post('/animals/pets/medication-logs/:logId/undo-dose', (req, res) => {
    const log = getPetStore().undoDose(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/animals/pets/medication-logs/:logId/skip-dose', (req, res) => {
    const log = getPetStore().skipDose(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/animals/pets/medication-logs/:logId/undo-skip', (req, res) => {
    const log = getPetStore().undoSkip(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Dose log not found' });
    res.json(log);
  });

  router.post('/animals/pets/pets/:id/notes', (req, res) => {
    if (!getPetStore().getPetById(req.params.id)) return res.status(404).json({ error: 'Pet not found' });
    const note = getPetStore().addPetNote(req.params.id, req.body);
    if (!note) return res.status(400).json({ error: 'Valid note date and note text are required' });
    res.status(201).json(note);
  });

  router.patch('/animals/pets/notes/:noteId', (req, res) => {
    const note = getPetStore().updatePetNote(req.params.noteId, req.body);
    if (!note) return res.status(400).json({ error: 'Note not found or update is invalid' });
    res.json(note);
  });

  router.delete('/animals/pets/notes/:noteId', (req, res) => {
    const note = getPetStore().deletePetNote(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  });

  router.post('/animals/pets/pets/:id/weights', (req, res) => {
    if (!getPetStore().getPetById(req.params.id)) return res.status(404).json({ error: 'Pet not found' });
    const weight = getPetStore().addPetWeight(req.params.id, req.body);
    if (!weight) return res.status(400).json({ error: 'Valid date and positive pound weight are required' });
    res.status(201).json(weight);
  });

  router.delete('/animals/pets/weights/:weightId', (req, res) => {
    const weight = getPetStore().deletePetWeight(req.params.weightId);
    if (!weight) return res.status(404).json({ error: 'Weight not found' });
    res.json({ deleted: true });
  });

  router.post('/animals/pets/pets/:id/photos', petPhotoUpload.array('photos', 10), (req, res) => {
    const store = getPetStore();
    if (!store.getPetById(req.params.id)) return res.status(404).json({ error: 'Pet not found' });
    const photos = (req.files || []).map(file => store.addPhoto(req.params.id, {
      photo_path: `${publicUploadPrefix}/photos/${file.filename}`,
      description: req.body.description,
      photo_type: req.body.photo_type,
    }));
    res.status(201).json(photos);
  });

  router.delete('/animals/pets/photos/:photoId', (req, res) => {
    const photo = getPetStore().deletePhoto(req.params.photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    removePetUploadedFile(photo.photo_path, uploadDir, publicUploadPrefix);
    res.json({ deleted: true });
  });

  return router;
}

module.exports = {
  DEFAULT_UPLOAD_DIR,
  PUBLIC_UPLOAD_PREFIX,
  createPetPhotoUpload,
  createPetRoutes,
  removePetUploadedFile,
};

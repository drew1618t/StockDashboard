const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const { DEFAULT_DB_PATH, createPigeonStore } = require('./pigeonStore');

const DEFAULT_OLD_DB_PATH = path.join(getDefaultOldRoot(), 'db', 'rehab.db');
const DEFAULT_UPLOAD_DIR = path.join(__dirname, '..', 'data', 'pigeons-uploads');
const PUBLIC_UPLOAD_PREFIX = '/family/pigeons/uploads';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getDefaultOldRoot() {
  return path.resolve(__dirname, '..', '..', 'Pigeons');
}

function normalizeOldAssetPath(value) {
  const clean = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean) return null;
  return clean.startsWith('uploads/') ? clean.slice('uploads/'.length) : clean;
}

function copyImportedPhoto(oldRoot, uploadDir, oldPath) {
  const relative = normalizeOldAssetPath(oldPath);
  if (!relative) return null;

  const source = path.resolve(oldRoot, 'uploads', relative);
  if (!source.startsWith(path.resolve(oldRoot))) return null;
  if (!fs.existsSync(source)) return null;

  const target = path.join(uploadDir, relative);
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return `${PUBLIC_UPLOAD_PREFIX}/${relative.replace(/\\/g, '/')}`;
}

function importExistingPigeonDataIfNeeded(options = {}) {
  const targetDbPath = options.targetDbPath || DEFAULT_DB_PATH;
  const oldRoot = options.oldRoot || getDefaultOldRoot();
  const oldDbPath = options.oldDbPath || path.join(oldRoot, 'db', 'rehab.db');
  const uploadDir = options.uploadDir || DEFAULT_UPLOAD_DIR;

  if (fs.existsSync(targetDbPath)) {
    return { imported: false, reason: 'target-exists', targetDbPath };
  }
  if (!fs.existsSync(oldDbPath)) {
    return { imported: false, reason: 'source-missing', targetDbPath, oldDbPath };
  }

  ensureDir(path.dirname(targetDbPath));
  ensureDir(uploadDir);

  const store = createPigeonStore({ dbPath: targetDbPath });
  const target = store.db;
  const source = new Database(oldDbPath, { readonly: true });

  const unassigned = store.ensureLocation('Unassigned');

  const tx = target.transaction(() => {
    const insertBird = target.prepare(`
      INSERT INTO pigeon_birds (
        id, case_number, name, species, intake_date, location_found, current_location_id,
        initial_condition, initial_weight, status, release_date, death_date, death_cause,
        notes, breathing, hydration, weight_assessment, injury_type, alert_level, created_at, updated_at
      )
      VALUES (
        @id, @case_number, @name, @species, @intake_date, @location_found, @current_location_id,
        @initial_condition, @initial_weight, @status, @release_date, @death_date, @death_cause,
        @notes, @breathing, @hydration, @weight_assessment, @injury_type, @alert_level, @created_at, @updated_at
      )
    `);
    const insertMed = target.prepare(`
      INSERT INTO pigeon_medications (
        id, bird_id, kind, name, dosage, frequency_per_day, start_date, end_date, notes, active, created_at, updated_at
      )
      VALUES (
        @id, @bird_id, @kind, @name, @dosage, @frequency_per_day, @start_date, @end_date, @notes, @active, @created_at, @updated_at
      )
    `);
    const insertLog = target.prepare(`
      INSERT INTO pigeon_medication_logs (
        id, medication_id, scheduled_datetime, completed_datetime, given, notes
      )
      VALUES (
        @id, @medication_id, @scheduled_datetime, @completed_datetime, @given, @notes
      )
    `);
    const insertPhoto = target.prepare(`
      INSERT INTO pigeon_photos (id, bird_id, photo_path, description, photo_type, upload_date)
      VALUES (@id, @bird_id, @photo_path, @description, @photo_type, @upload_date)
    `);

    for (const row of source.prepare('SELECT * FROM birds ORDER BY id').all()) {
      insertBird.run({
        ...row,
        current_location_id: unassigned.id,
        species: row.species || 'Unknown',
        intake_date: row.intake_date || new Date().toISOString().slice(0, 10),
        status: row.status || 'active',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.created_at || new Date().toISOString(),
      });
    }

    for (const row of source.prepare('SELECT * FROM medications ORDER BY id').all()) {
      insertMed.run({
        id: row.id,
        bird_id: row.bird_id,
        kind: 'medication',
        name: row.medication_name,
        dosage: row.dosage,
        frequency_per_day: row.frequency_per_day || 1,
        start_date: row.start_date,
        end_date: row.end_date,
        notes: row.notes,
        active: row.active ? 1 : 0,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.created_at || new Date().toISOString(),
      });
    }

    for (const row of source.prepare('SELECT * FROM medication_logs ORDER BY id').all()) {
      insertLog.run({
        id: row.id,
        medication_id: row.medication_id,
        scheduled_datetime: row.scheduled_datetime,
        completed_datetime: row.completed_datetime,
        given: row.given ? 1 : 0,
        notes: row.notes,
      });
    }

    for (const row of source.prepare('SELECT * FROM photos ORDER BY id').all()) {
      const photoPath = copyImportedPhoto(oldRoot, uploadDir, row.photo_path) || row.photo_path;
      if (!photoPath) continue;
      if (row.thumbnail_path) copyImportedPhoto(oldRoot, uploadDir, row.thumbnail_path);
      insertPhoto.run({
        id: row.id,
        bird_id: row.bird_id,
        photo_path: photoPath,
        description: row.description,
        photo_type: row.photo_type || 'progress',
        upload_date: row.upload_date || new Date().toISOString(),
      });
    }
  });

  try {
    tx();
    return {
      imported: true,
      targetDbPath,
      oldDbPath,
      birds: target.prepare('SELECT COUNT(*) as count FROM pigeon_birds').get().count,
      medications: target.prepare('SELECT COUNT(*) as count FROM pigeon_medications').get().count,
      medicationLogs: target.prepare('SELECT COUNT(*) as count FROM pigeon_medication_logs').get().count,
      photos: target.prepare('SELECT COUNT(*) as count FROM pigeon_photos').get().count,
    };
  } finally {
    source.close();
    store.close();
  }
}

module.exports = {
  DEFAULT_OLD_DB_PATH,
  DEFAULT_UPLOAD_DIR,
  PUBLIC_UPLOAD_PREFIX,
  copyImportedPhoto,
  getDefaultOldRoot,
  importExistingPigeonDataIfNeeded,
};

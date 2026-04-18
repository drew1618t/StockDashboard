const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const {
  addDays,
  generateDoseDateTimes,
  normalizeDateOnly,
  normalizeText,
  parsePositiveFloat,
  parsePositiveInt,
  scheduledDateTimeForDate,
  toDateOnly,
  toDateTimeString,
} = require('./animalMedicationSchedule');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'pets.db');
const ACTIVE_PET_STATUSES = ['active'];
const PET_TYPES = ['dog', 'cat', 'other'];
const PET_STATUSES = ['active', 'inactive', 'deceased'];
const MEDICATION_KINDS = ['medication', 'supplement', 'preventative'];
const SCHEDULE_TYPES = ['daily_course', 'interval'];

let singletonStore = null;

function ensureDir(filePath) {
  const dir = path.extname(filePath) ? path.dirname(filePath) : filePath;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function mapMedicationRow(row) {
  if (!row) return row;
  return {
    ...row,
    active: row.active ? 1 : 0,
    out_of_stock: row.out_of_stock ? 1 : 0,
    doses_given: row.doses_given || 0,
    total_doses: row.total_doses || 0,
    overdue_count: row.overdue_count || 0,
    interval_days: row.interval_days || null,
  };
}

class PetStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.now = options.now || (() => new Date());
    ensureDir(this.dbPath);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
  }

  close() {
    if (this.db) this.db.close();
    this.db = null;
  }

  nowDate() {
    return this.now();
  }

  today() {
    return toDateOnly(this.nowDate());
  }

  nowDateTime() {
    return toDateTimeString(this.nowDate());
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pet_animals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        animal_type TEXT NOT NULL,
        breed TEXT,
        sex TEXT,
        birthday TEXT,
        adoption_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pet_medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pet_animals(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'medication',
        name TEXT NOT NULL,
        dosage TEXT,
        schedule_type TEXT NOT NULL DEFAULT 'daily_course',
        frequency_per_day INTEGER DEFAULT 1,
        start_date TEXT NOT NULL,
        end_date TEXT,
        interval_days INTEGER,
        next_due_date TEXT,
        notes TEXT,
        active INTEGER DEFAULT 1,
        out_of_stock INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pet_medication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL REFERENCES pet_medications(id) ON DELETE CASCADE,
        scheduled_datetime TEXT NOT NULL,
        completed_datetime TEXT,
        given INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS pet_weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pet_animals(id) ON DELETE CASCADE,
        weight_date TEXT NOT NULL,
        weight_lbs REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(pet_id, weight_date)
      );

      CREATE TABLE IF NOT EXISTS pet_note_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pet_animals(id) ON DELETE CASCADE,
        note_date TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pet_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pet_animals(id) ON DELETE CASCADE,
        photo_path TEXT NOT NULL,
        description TEXT,
        photo_type TEXT DEFAULT 'progress',
        upload_date TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_pet_animals_status ON pet_animals(status);
      CREATE INDEX IF NOT EXISTS idx_pet_animals_type ON pet_animals(animal_type);
      CREATE INDEX IF NOT EXISTS idx_pet_meds_pet ON pet_medications(pet_id);
      CREATE INDEX IF NOT EXISTS idx_pet_meds_active ON pet_medications(active);
      CREATE INDEX IF NOT EXISTS idx_pet_med_logs_med ON pet_medication_logs(medication_id);
      CREATE INDEX IF NOT EXISTS idx_pet_med_logs_scheduled ON pet_medication_logs(scheduled_datetime);
      CREATE INDEX IF NOT EXISTS idx_pet_weight_logs_pet ON pet_weight_logs(pet_id);
      CREATE INDEX IF NOT EXISTS idx_pet_note_logs_pet ON pet_note_logs(pet_id);
      CREATE INDEX IF NOT EXISTS idx_pet_photos_pet ON pet_photos(pet_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_med_logs_unique_pending
        ON pet_medication_logs(medication_id, scheduled_datetime)
        WHERE given = 0 AND skipped = 0;
    `);
  }

  getPetById(id) {
    return this.db.prepare('SELECT * FROM pet_animals WHERE id = ?').get(id);
  }

  createPet(input = {}) {
    const name = normalizeText(input.name);
    if (!name) return null;

    const birthday = input.birthday ? normalizeDateOnly(input.birthday) : null;
    const adoptionDate = input.adoption_date ? normalizeDateOnly(input.adoption_date) : null;
    if (input.birthday && !birthday) return null;
    if (input.adoption_date && !adoptionDate) return null;

    const result = this.db.prepare(`
      INSERT INTO pet_animals (name, animal_type, breed, sex, birthday, adoption_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      oneOf(normalizeText(input.animal_type), PET_TYPES, 'dog'),
      normalizeText(input.breed),
      normalizeText(input.sex),
      birthday,
      adoptionDate,
      oneOf(normalizeText(input.status), PET_STATUSES, 'active'),
      normalizeText(input.notes)
    );
    return this.getPetById(result.lastInsertRowid);
  }

  updatePet(id, updates = {}) {
    const pet = this.getPetById(id);
    if (!pet) return null;
    const allowed = ['name', 'animal_type', 'breed', 'sex', 'birthday', 'adoption_date', 'status', 'notes'];
    const sets = [];
    const values = [];

    for (const field of allowed) {
      if (updates[field] === undefined) continue;
      let value = updates[field];
      if (field === 'name') value = normalizeText(value) || pet.name;
      else if (field === 'animal_type') value = oneOf(normalizeText(value), PET_TYPES, pet.animal_type);
      else if (field === 'status') value = oneOf(normalizeText(value), PET_STATUSES, pet.status);
      else if (field === 'birthday' || field === 'adoption_date') {
        value = value ? normalizeDateOnly(value) : null;
        if (updates[field] && !value) return null;
      } else value = normalizeText(value);
      sets.push(`${field} = ?`);
      values.push(value);
    }

    if (sets.length === 0) return pet;
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.prepare(`UPDATE pet_animals SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getPetById(id);
  }

  deletePet(id) {
    const pet = this.getPetById(id);
    if (!pet) return false;
    this.db.prepare('DELETE FROM pet_animals WHERE id = ?').run(id);
    return true;
  }

  listPets(filters = {}) {
    const where = [];
    const params = [];
    const status = normalizeText(filters.status);
    const animalType = normalizeText(filters.animalType || filters.animal_type);

    if (status) {
      where.push('p.status = ?');
      params.push(status);
    }
    if (animalType) {
      where.push('p.animal_type = ?');
      params.push(animalType);
    }
    if (filters.search) {
      where.push(`(
        p.name LIKE ? OR p.animal_type LIKE ? OR p.breed LIKE ? OR p.notes LIKE ?
        OR EXISTS (SELECT 1 FROM pet_note_logs n WHERE n.pet_id = p.id AND n.note_text LIKE ?)
      )`);
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM pet_medications m WHERE m.pet_id = p.id AND m.active = 1) as active_med_count,
        (SELECT photo_path FROM pet_photos ph WHERE ph.pet_id = p.id ORDER BY ph.upload_date ASC LIMIT 1) as first_photo
      FROM pet_animals p
      ${whereClause}
      ORDER BY
        CASE p.status WHEN 'active' THEN 1 WHEN 'inactive' THEN 2 WHEN 'deceased' THEN 3 ELSE 4 END,
        CASE p.animal_type WHEN 'dog' THEN 1 WHEN 'cat' THEN 2 ELSE 3 END,
        lower(p.name)
    `).all(...params);
  }

  getPetDetail(id) {
    const pet = this.getPetById(id);
    if (!pet) return null;
    pet.medications = this.listPetMedications(id);
    pet.photos = this.listPetPhotos(id);
    pet.weights = this.listPetWeights(id);
    pet.noteLogs = this.listPetNotes(id);
    return pet;
  }

  addPetNote(petId, input = {}) {
    if (!this.getPetById(petId)) return null;
    const noteDate = input.note_date ? normalizeDateOnly(input.note_date) : this.today();
    const noteText = normalizeText(input.note_text || input.notes);
    if (!noteDate || !noteText) return null;
    const result = this.db.prepare(`
      INSERT INTO pet_note_logs (pet_id, note_date, note_text)
      VALUES (?, ?, ?)
    `).run(petId, noteDate, noteText);
    return this.getNoteById(result.lastInsertRowid);
  }

  getNoteById(id) {
    return this.db.prepare(`
      SELECT id, pet_id, note_date, note_text, created_at, updated_at
      FROM pet_note_logs WHERE id = ?
    `).get(id);
  }

  listPetNotes(petId) {
    return this.db.prepare(`
      SELECT id, pet_id, note_date, note_text, created_at, updated_at
      FROM pet_note_logs WHERE pet_id = ?
      ORDER BY note_date DESC, id DESC
    `).all(petId);
  }

  updatePetNote(noteId, input = {}) {
    const note = this.getNoteById(noteId);
    if (!note) return null;
    const noteDate = input.note_date !== undefined ? normalizeDateOnly(input.note_date) : note.note_date;
    const noteText = input.note_text !== undefined || input.notes !== undefined
      ? normalizeText(input.note_text || input.notes)
      : note.note_text;
    if (!noteDate || !noteText) return null;
    this.db.prepare(`
      UPDATE pet_note_logs SET note_date = ?, note_text = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(noteDate, noteText, noteId);
    return this.getNoteById(noteId);
  }

  deletePetNote(noteId) {
    const note = this.getNoteById(noteId);
    if (!note) return null;
    this.db.prepare('DELETE FROM pet_note_logs WHERE id = ?').run(noteId);
    return note;
  }

  addPetWeight(petId, input = {}) {
    if (!this.getPetById(petId)) return null;
    const weightDate = normalizeDateOnly(input.weight_date);
    const weightLbs = parsePositiveFloat(input.weight_lbs);
    if (!weightDate || weightLbs === null) return null;
    this.db.prepare(`
      INSERT INTO pet_weight_logs (pet_id, weight_date, weight_lbs)
      VALUES (?, ?, ?)
      ON CONFLICT(pet_id, weight_date) DO UPDATE SET weight_lbs = excluded.weight_lbs
    `).run(petId, weightDate, weightLbs);
    return this.db.prepare(`
      SELECT id, pet_id, weight_date, weight_lbs, created_at
      FROM pet_weight_logs WHERE pet_id = ? AND weight_date = ?
    `).get(petId, weightDate);
  }

  listPetWeights(petId) {
    return this.db.prepare(`
      SELECT id, pet_id, weight_date, weight_lbs, created_at
      FROM pet_weight_logs WHERE pet_id = ?
      ORDER BY weight_date ASC, id ASC
    `).all(petId).map(row => ({ ...row, weight_lbs: Number(row.weight_lbs) }));
  }

  getWeightById(id) {
    const row = this.db.prepare(`
      SELECT id, pet_id, weight_date, weight_lbs, created_at
      FROM pet_weight_logs WHERE id = ?
    `).get(id);
    return row ? { ...row, weight_lbs: Number(row.weight_lbs) } : null;
  }

  deletePetWeight(weightId) {
    const weight = this.getWeightById(weightId);
    if (!weight) return null;
    this.db.prepare('DELETE FROM pet_weight_logs WHERE id = ?').run(weightId);
    return weight;
  }

  normalizeMedicationInput(input = {}, existing = {}) {
    const scheduleType = oneOf(normalizeText(input.schedule_type), SCHEDULE_TYPES, existing.schedule_type || 'daily_course');
    const startDate = input.start_date !== undefined
      ? normalizeDateOnly(input.start_date)
      : existing.start_date || this.today();
    if (!startDate) return null;

    const base = {
      kind: oneOf(normalizeText(input.kind), MEDICATION_KINDS, existing.kind || 'medication'),
      name: normalizeText(input.name || input.medication_name) || existing.name || null,
      dosage: normalizeText(input.dosage),
      schedule_type: scheduleType,
      frequency_per_day: parsePositiveInt(input.frequency_per_day, existing.frequency_per_day || 1),
      start_date: startDate,
      end_date: null,
      interval_days: null,
      next_due_date: null,
      notes: normalizeText(input.notes),
    };
    if (!base.name) return null;

    if (scheduleType === 'interval') {
      base.interval_days = parsePositiveInt(input.interval_days, existing.interval_days || 30);
      base.next_due_date = input.next_due_date !== undefined
        ? normalizeDateOnly(input.next_due_date)
        : existing.next_due_date || startDate;
      if (!base.next_due_date) return null;
      base.frequency_per_day = 1;
    } else {
      base.end_date = input.end_date !== undefined
        ? normalizeDateOnly(input.end_date)
        : existing.end_date || startDate;
      if (!base.end_date) return null;
    }
    return base;
  }

  createMedication(petId, input = {}) {
    if (!this.getPetById(petId)) return null;
    const med = this.normalizeMedicationInput(input);
    if (!med) return null;

    const tx = this.db.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO pet_medications (
          pet_id, kind, name, dosage, schedule_type, frequency_per_day, start_date,
          end_date, interval_days, next_due_date, notes, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        petId,
        med.kind,
        med.name,
        med.dosage,
        med.schedule_type,
        med.frequency_per_day,
        med.start_date,
        med.end_date,
        med.interval_days,
        med.next_due_date,
        med.notes
      );
      this.generateScheduledDoses(result.lastInsertRowid);
      return result.lastInsertRowid;
    });

    return this.getMedicationById(tx());
  }

  generateScheduledDoses(medicationId) {
    const med = this.db.prepare('SELECT * FROM pet_medications WHERE id = ?').get(medicationId);
    if (!med) return;
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO pet_medication_logs (medication_id, scheduled_datetime, given)
      VALUES (?, ?, 0)
    `);
    if (med.schedule_type === 'interval') {
      insert.run(medicationId, scheduledDateTimeForDate(med.next_due_date || med.start_date, 9));
      return;
    }
    for (const scheduled of generateDoseDateTimes(med.frequency_per_day, med.start_date, med.end_date || med.start_date)) {
      insert.run(medicationId, scheduled);
    }
  }

  getMedicationById(id) {
    return mapMedicationRow(this.db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id AND given = 1) as doses_given,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id) as total_doses,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id AND given = 0 AND skipped = 0 AND scheduled_datetime < ?) as overdue_count
      FROM pet_medications m
      WHERE m.id = ?
    `).get(this.nowDateTime(), id));
  }

  listPetMedications(petId) {
    return this.db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id AND given = 1) as doses_given,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id) as total_doses,
        (SELECT COUNT(*) FROM pet_medication_logs WHERE medication_id = m.id AND given = 0 AND skipped = 0 AND scheduled_datetime < ?) as overdue_count
      FROM pet_medications m
      WHERE m.pet_id = ?
      ORDER BY m.active DESC, m.kind, lower(m.name)
    `).all(this.nowDateTime(), petId).map(mapMedicationRow);
  }

  updateMedication(id, updates = {}) {
    const existing = this.getMedicationById(id);
    if (!existing) return null;

    const allowed = ['kind', 'name', 'dosage', 'schedule_type', 'frequency_per_day', 'start_date', 'end_date', 'interval_days', 'next_due_date', 'notes'];
    const scheduleChanged = allowed.some(field => updates[field] !== undefined);
    const sets = [];
    const values = [];

    if (scheduleChanged) {
      const normalized = this.normalizeMedicationInput({ ...existing, ...updates }, existing);
      if (!normalized) return null;
      for (const field of allowed) {
        sets.push(`${field} = ?`);
        values.push(normalized[field]);
      }
    }

    if (updates.active !== undefined) {
      sets.push('active = ?');
      values.push(updates.active ? 1 : 0);
    }
    if (updates.out_of_stock !== undefined) {
      sets.push('out_of_stock = ?');
      values.push(updates.out_of_stock ? 1 : 0);
    }

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      values.push(id);
      this.db.prepare(`UPDATE pet_medications SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    if (scheduleChanged) {
      this.db.prepare('DELETE FROM pet_medication_logs WHERE medication_id = ? AND given = 0').run(id);
      this.generateScheduledDoses(id);
    }

    return this.getMedicationById(id);
  }

  deleteMedication(id) {
    const med = this.getMedicationById(id);
    if (!med) return false;
    this.db.prepare('DELETE FROM pet_medications WHERE id = ?').run(id);
    return true;
  }

  logDose(medicationId, input = {}) {
    const med = this.getMedicationById(medicationId);
    if (!med) return null;
    const now = this.nowDateTime();
    const notes = normalizeText(input.notes);
    const logId = input.log_id || this.findCurrentPendingLogId(medicationId);
    if (!logId && med.schedule_type !== 'interval') {
      const result = this.db.prepare(`
        INSERT INTO pet_medication_logs (medication_id, scheduled_datetime, completed_datetime, given, notes)
        VALUES (?, ?, ?, 1, ?)
      `).run(medicationId, now, now, notes);
      return this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(result.lastInsertRowid);
    }
    if (!logId) return null;

    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE pet_medication_logs
        SET given = 1, completed_datetime = ?, notes = ?
        WHERE id = ? AND medication_id = ?
      `).run(now, notes, logId, medicationId);

      if (med.schedule_type === 'interval' && med.active) {
        const nextDueDate = addDays(this.today(), med.interval_days || 30);
        this.db.prepare(`
          UPDATE pet_medications SET next_due_date = ?, updated_at = datetime('now') WHERE id = ?
        `).run(nextDueDate, medicationId);
        this.db.prepare(`
          INSERT OR IGNORE INTO pet_medication_logs (medication_id, scheduled_datetime, given)
          VALUES (?, ?, 0)
        `).run(medicationId, scheduledDateTimeForDate(nextDueDate, 9));
      }
      return this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
    });

    return tx();
  }

  findCurrentPendingLogId(medicationId) {
    const row = this.db.prepare(`
      SELECT id FROM pet_medication_logs
      WHERE medication_id = ? AND given = 0 AND skipped = 0
      ORDER BY scheduled_datetime ASC LIMIT 1
    `).get(medicationId);
    return row ? row.id : null;
  }

  undoDose(logId) {
    const log = this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
    if (!log) return null;
    this.db.prepare(`
      UPDATE pet_medication_logs
      SET given = 0, completed_datetime = NULL, notes = NULL
      WHERE id = ?
    `).run(logId);
    return this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
  }

  skipDose(logId) {
    const log = this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
    if (!log) return null;
    this.db.prepare('UPDATE pet_medication_logs SET skipped = 1 WHERE id = ?').run(logId);
    return this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
  }

  undoSkip(logId) {
    const log = this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
    if (!log) return null;
    this.db.prepare('UPDATE pet_medication_logs SET skipped = 0 WHERE id = ?').run(logId);
    return this.db.prepare('SELECT * FROM pet_medication_logs WHERE id = ?').get(logId);
  }

  listMedicationLogs(medicationId) {
    return this.db.prepare(`
      SELECT * FROM pet_medication_logs
      WHERE medication_id = ?
      ORDER BY scheduled_datetime DESC
    `).all(medicationId);
  }

  doseSelectSql() {
    return `
      SELECT ml.id as log_id, ml.scheduled_datetime, ml.completed_datetime, ml.given, ml.skipped, ml.notes as dose_notes,
        m.id as medication_id, m.kind, m.name, m.dosage, m.schedule_type, m.frequency_per_day,
        m.start_date, m.end_date, m.interval_days, m.next_due_date, m.notes as medication_notes, m.out_of_stock,
        p.id as pet_id, p.name as pet_name, p.animal_type, p.breed, p.status,
        CASE WHEN ml.scheduled_datetime < ? THEN 1 ELSE 0 END as overdue
      FROM pet_medication_logs ml
      JOIN pet_medications m ON m.id = ml.medication_id
      JOIN pet_animals p ON p.id = m.pet_id
    `;
  }

  listDueDoses({ overdue = false, dueToday = false } = {}) {
    const now = this.nowDateTime();
    const today = this.today();
    const clauses = ['ml.given = 0', 'ml.skipped = 0', 'm.active = 1'];
    const params = [];
    const placeholders = ACTIVE_PET_STATUSES.map(() => '?').join(', ');
    clauses.push(`p.status IN (${placeholders})`);
    params.push(...ACTIVE_PET_STATUSES);
    if (overdue) {
      clauses.push('ml.scheduled_datetime < ?');
      params.push(now);
    }
    if (dueToday) {
      clauses.push("substr(ml.scheduled_datetime, 1, 10) = ?");
      params.push(today);
    }
    return this.db.prepare(`
      ${this.doseSelectSql()}
      WHERE ${clauses.join(' AND ')}
      ORDER BY ml.scheduled_datetime ASC, lower(p.name), lower(m.name)
    `).all(now, ...params);
  }

  listCompletedDosesToday() {
    const today = this.today();
    const placeholders = ACTIVE_PET_STATUSES.map(() => '?').join(', ');
    return this.db.prepare(`
      ${this.doseSelectSql()}
      WHERE ml.given = 1
        AND ml.completed_datetime IS NOT NULL
        AND substr(ml.completed_datetime, 1, 10) = ?
        AND p.status IN (${placeholders})
      ORDER BY ml.completed_datetime DESC, lower(p.name), lower(m.name)
    `).all(this.nowDateTime(), today, ...ACTIVE_PET_STATUSES);
  }

  listSkippedDosesToday() {
    const today = this.today();
    const placeholders = ACTIVE_PET_STATUSES.map(() => '?').join(', ');
    return this.db.prepare(`
      ${this.doseSelectSql()}
      WHERE ml.skipped = 1
        AND substr(ml.scheduled_datetime, 1, 10) = ?
        AND p.status IN (${placeholders})
      ORDER BY ml.scheduled_datetime DESC, lower(p.name), lower(m.name)
    `).all(this.nowDateTime(), today, ...ACTIVE_PET_STATUSES);
  }

  listActiveMedications() {
    return this.db.prepare(`
      SELECT m.*, p.id as pet_id, p.name as pet_name, p.animal_type, p.breed, p.status
      FROM pet_medications m
      JOIN pet_animals p ON p.id = m.pet_id
      WHERE m.active = 1 AND p.status IN (${ACTIVE_PET_STATUSES.map(() => '?').join(', ')})
      ORDER BY lower(p.name), lower(m.name)
    `).all(...ACTIVE_PET_STATUSES);
  }

  addPhoto(petId, input = {}) {
    if (!this.getPetById(petId) || !input.photo_path) return null;
    const result = this.db.prepare(`
      INSERT INTO pet_photos (pet_id, photo_path, description, photo_type, upload_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      petId,
      input.photo_path,
      normalizeText(input.description),
      normalizeText(input.photo_type) || 'progress',
      normalizeText(input.upload_date) || this.nowDateTime()
    );
    return this.db.prepare('SELECT * FROM pet_photos WHERE id = ?').get(result.lastInsertRowid);
  }

  listPetPhotos(petId) {
    return this.db.prepare('SELECT * FROM pet_photos WHERE pet_id = ? ORDER BY upload_date DESC').all(petId);
  }

  getPhotoById(id) {
    return this.db.prepare('SELECT * FROM pet_photos WHERE id = ?').get(id);
  }

  deletePhoto(id) {
    const photo = this.getPhotoById(id);
    if (!photo) return null;
    this.db.prepare('DELETE FROM pet_photos WHERE id = ?').run(id);
    return photo;
  }

  getStats() {
    const byStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM pet_animals GROUP BY status ORDER BY status
    `).all();
    const byType = this.db.prepare(`
      SELECT animal_type, COUNT(*) as count FROM pet_animals GROUP BY animal_type ORDER BY count DESC, animal_type
    `).all();
    return {
      total: this.db.prepare('SELECT COUNT(*) as count FROM pet_animals').get().count,
      activePets: this.db.prepare(`
        SELECT COUNT(*) as count FROM pet_animals WHERE status IN (${ACTIVE_PET_STATUSES.map(() => '?').join(', ')})
      `).get(...ACTIVE_PET_STATUSES).count,
      activeMeds: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM pet_medications m JOIN pet_animals p ON p.id = m.pet_id
        WHERE m.active = 1 AND p.status IN (${ACTIVE_PET_STATUSES.map(() => '?').join(', ')})
      `).get(...ACTIVE_PET_STATUSES).count,
      overdueMeds: this.listDueDoses({ overdue: true }).length,
      byStatus,
      byType,
    };
  }

  getSummary() {
    const stats = this.getStats();
    const overdueDoses = this.listDueDoses({ overdue: true });
    const dueTodayDoses = this.listDueDoses({ dueToday: true });
    const completedTodayDoses = this.listCompletedDosesToday();
    const skippedTodayDoses = this.listSkippedDosesToday();
    const activeMeds = this.listActiveMedications();
    const activePets = this.listPets({ status: 'active' }).map(pet => ({
      id: pet.id,
      name: pet.name,
      animal_type: pet.animal_type,
      breed: pet.breed,
      status: pet.status,
      activeMeds: [],
      dueDoses: [],
      completedDoses: [],
      skippedDoses: [],
      medication_state: 'no_meds',
    }));
    const petsById = new Map(activePets.map(pet => [pet.id, pet]));

    const dueOrOverdueByLog = new Map();
    [...overdueDoses, ...dueTodayDoses].forEach(dose => dueOrOverdueByLog.set(dose.log_id, dose));
    for (const dose of dueOrOverdueByLog.values()) {
      if (petsById.has(dose.pet_id)) petsById.get(dose.pet_id).dueDoses.push(dose);
    }
    for (const dose of completedTodayDoses) {
      if (petsById.has(dose.pet_id)) petsById.get(dose.pet_id).completedDoses.push(dose);
    }
    for (const dose of skippedTodayDoses) {
      if (petsById.has(dose.pet_id)) petsById.get(dose.pet_id).skippedDoses.push(dose);
    }
    for (const med of activeMeds) {
      if (petsById.has(med.pet_id)) petsById.get(med.pet_id).activeMeds.push(med);
    }
    for (const pet of petsById.values()) {
      if (pet.dueDoses.length > 0) pet.medication_state = 'needs_meds';
      else if (pet.skippedDoses.length > 0) pet.medication_state = 'missing_meds';
      else if (pet.activeMeds.length > 0) pet.medication_state = 'medicated';
    }

    return {
      ...stats,
      dueTodayDoses,
      overdueDoses,
      completedTodayDoses,
      skippedTodayDoses,
      petItems: activePets,
    };
  }
}

function createPetStore(options) {
  return new PetStore(options);
}

function getPetStore() {
  if (!singletonStore) singletonStore = new PetStore();
  return singletonStore;
}

function resetPetStoreForTests() {
  if (singletonStore) singletonStore.close();
  singletonStore = null;
}

module.exports = {
  ACTIVE_PET_STATUSES,
  DEFAULT_DB_PATH,
  PetStore,
  createPetStore,
  getPetStore,
  resetPetStoreForTests,
};

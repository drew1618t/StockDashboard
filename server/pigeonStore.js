const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'pigeons.db');
const ACTIVE_CARE_STATUSES = ['active', 'critical', 'ready_for_release', 'permanent_resident'];

let singletonStore = null;

function ensureDir(filePath) {
  const dir = path.extname(filePath) ? path.dirname(filePath) : filePath;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toDateOnly(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveFloat(value) {
  const parsed = parseFloatOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function normalizeDateOnly(value) {
  const clean = normalizeText(value);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const parsed = new Date(`${clean}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (toDateOnly(parsed) !== clean) return null;
  return clean;
}

function doseHoursForFrequency(frequency) {
  const freq = parsePositiveInt(frequency, 1);
  if (freq === 1) return [9];
  if (freq === 2) return [8, 20];
  if (freq === 3) return [8, 14, 20];
  if (freq === 4) return [8, 12, 16, 20];

  const hours = [];
  const interval = 24 / freq;
  for (let i = 0; i < freq; i += 1) {
    hours.push(Math.round(8 + interval * i) % 24);
  }
  return hours;
}

function generateDoseDateTimes(frequency, startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate || startDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const hours = doseHoursForFrequency(frequency);
  const rows = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (const hour of hours) {
      const doseDate = new Date(d);
      doseDate.setHours(hour, 0, 0, 0);
      rows.push(toDateTimeString(doseDate));
    }
  }
  return rows;
}

function mapMedicationRow(row) {
  if (!row) return row;
  return {
    ...row,
    active: row.active ? 1 : 0,
    doses_given: row.doses_given || 0,
    total_doses: row.total_doses || 0,
    overdue_count: row.overdue_count || 0,
  };
}

class PigeonStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    ensureDir(this.dbPath);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    this.ensureLocation('Unassigned');
  }

  close() {
    if (this.db) this.db.close();
    this.db = null;
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pigeon_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pigeon_birds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_number TEXT UNIQUE NOT NULL,
        name TEXT,
        species TEXT NOT NULL DEFAULT 'Unknown',
        intake_date TEXT NOT NULL,
        location_found TEXT,
        current_location_id INTEGER REFERENCES pigeon_locations(id) ON DELETE SET NULL,
        initial_condition TEXT,
        initial_weight REAL,
        status TEXT NOT NULL DEFAULT 'active',
        release_date TEXT,
        death_date TEXT,
        death_cause TEXT,
        notes TEXT,
        breathing TEXT,
        hydration TEXT,
        weight_assessment TEXT,
        injury_type TEXT,
        alert_level TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pigeon_medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bird_id INTEGER NOT NULL REFERENCES pigeon_birds(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'medication',
        name TEXT NOT NULL,
        dosage TEXT,
        frequency_per_day INTEGER DEFAULT 1,
        start_date TEXT NOT NULL,
        end_date TEXT,
        notes TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pigeon_medication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL REFERENCES pigeon_medications(id) ON DELETE CASCADE,
        scheduled_datetime TEXT NOT NULL,
        completed_datetime TEXT,
        given INTEGER DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS pigeon_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bird_id INTEGER NOT NULL REFERENCES pigeon_birds(id) ON DELETE CASCADE,
        photo_path TEXT NOT NULL,
        description TEXT,
        photo_type TEXT DEFAULT 'progress',
        upload_date TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pigeon_weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bird_id INTEGER NOT NULL REFERENCES pigeon_birds(id) ON DELETE CASCADE,
        weight_date TEXT NOT NULL,
        weight_grams REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(bird_id, weight_date)
      );

      CREATE TABLE IF NOT EXISTS pigeon_note_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bird_id INTEGER NOT NULL REFERENCES pigeon_birds(id) ON DELETE CASCADE,
        note_date TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_pigeon_birds_status ON pigeon_birds(status);
      CREATE INDEX IF NOT EXISTS idx_pigeon_birds_location ON pigeon_birds(current_location_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_meds_bird ON pigeon_medications(bird_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_meds_active ON pigeon_medications(active);
      CREATE INDEX IF NOT EXISTS idx_pigeon_med_logs_med ON pigeon_medication_logs(medication_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_med_logs_scheduled ON pigeon_medication_logs(scheduled_datetime);
      CREATE INDEX IF NOT EXISTS idx_pigeon_photos_bird ON pigeon_photos(bird_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_weight_logs_bird ON pigeon_weight_logs(bird_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_weight_logs_date ON pigeon_weight_logs(weight_date);
      CREATE INDEX IF NOT EXISTS idx_pigeon_note_logs_bird ON pigeon_note_logs(bird_id);
      CREATE INDEX IF NOT EXISTS idx_pigeon_note_logs_date ON pigeon_note_logs(note_date);
    `);
  }

  ensureLocation(name) {
    const clean = normalizeText(name) || 'Unassigned';
    const existing = this.db.prepare('SELECT * FROM pigeon_locations WHERE lower(name) = lower(?)').get(clean);
    if (existing) return existing;

    const maxOrder = this.db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM pigeon_locations').get().max_order;
    const result = this.db.prepare(
      'INSERT INTO pigeon_locations (name, sort_order) VALUES (?, ?)'
    ).run(clean, maxOrder + 1);
    return this.db.prepare('SELECT * FROM pigeon_locations WHERE id = ?').get(result.lastInsertRowid);
  }

  getLocations() {
    return this.db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM pigeon_birds b
          WHERE b.current_location_id = l.id
            AND b.status NOT IN ('released', 'deceased')) as bird_count,
        (SELECT COUNT(*)
          FROM pigeon_medications m
          JOIN pigeon_birds b ON b.id = m.bird_id
          WHERE b.current_location_id = l.id AND m.active = 1
            AND b.status NOT IN ('released', 'deceased')) as active_med_count
      FROM pigeon_locations l
      ORDER BY CASE WHEN l.name = 'Unassigned' THEN 999999 ELSE l.sort_order END, lower(l.name)
    `).all();
  }

  createLocation(name) {
    return this.ensureLocation(name);
  }

  generateCaseNumber() {
    const today = toDateOnly().replace(/-/g, '');
    const prefix = `PG-${today}-`;
    const row = this.db.prepare(
      'SELECT case_number FROM pigeon_birds WHERE case_number LIKE ? ORDER BY case_number DESC LIMIT 1'
    ).get(`${prefix}%`);

    if (!row) return `${prefix}001`;
    const seq = Number.parseInt(String(row.case_number).split('-')[2], 10) + 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  getBirdById(id) {
    return this.db.prepare(`
      SELECT b.*, l.name as location_name
      FROM pigeon_birds b
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE b.id = ?
    `).get(id);
  }

  createBird(input = {}) {
    const location = input.current_location_id
      ? this.db.prepare('SELECT * FROM pigeon_locations WHERE id = ?').get(input.current_location_id)
      : this.ensureLocation(input.location_name || 'Unassigned');
    const locationId = location ? location.id : this.ensureLocation('Unassigned').id;
    const caseNumber = normalizeText(input.case_number) || this.generateCaseNumber();
    const intakeDate = normalizeText(input.intake_date) || toDateOnly();

    const result = this.db.prepare(`
      INSERT INTO pigeon_birds (
        case_number, name, species, intake_date, location_found, current_location_id,
        initial_condition, initial_weight, status, release_date, death_date, death_cause,
        notes, breathing, hydration, weight_assessment, injury_type, alert_level
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      caseNumber,
      normalizeText(input.name),
      normalizeText(input.species) || 'Unknown',
      intakeDate,
      normalizeText(input.location_found),
      locationId,
      normalizeText(input.initial_condition),
      parseFloatOrNull(input.initial_weight),
      normalizeText(input.status) || 'active',
      normalizeText(input.release_date),
      normalizeText(input.death_date),
      normalizeText(input.death_cause),
      normalizeText(input.notes),
      normalizeText(input.breathing),
      normalizeText(input.hydration),
      normalizeText(input.weight_assessment),
      normalizeText(input.injury_type),
      normalizeText(input.alert_level)
    );

    return this.getBirdById(result.lastInsertRowid);
  }

  updateBird(id, updates = {}) {
    const bird = this.getBirdById(id);
    if (!bird) return null;

    const allowed = [
      'name', 'species', 'intake_date', 'location_found', 'initial_condition',
      'initial_weight', 'status', 'release_date', 'death_date', 'death_cause',
      'notes', 'breathing', 'hydration', 'weight_assessment', 'injury_type',
      'alert_level', 'current_location_id',
    ];
    const sets = [];
    const values = [];

    if (updates.location_name && !updates.current_location_id) {
      updates.current_location_id = this.ensureLocation(updates.location_name).id;
    }

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        values.push(field === 'initial_weight' ? parseFloatOrNull(updates[field]) : updates[field]);
      }
    }

    if (sets.length === 0) return bird;
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.prepare(`UPDATE pigeon_birds SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getBirdById(id);
  }

  deleteBird(id) {
    const bird = this.getBirdById(id);
    if (!bird) return false;
    this.db.prepare('DELETE FROM pigeon_birds WHERE id = ?').run(id);
    return true;
  }

  listBirds(filters = {}) {
    const where = [];
    const params = [];
    const status = normalizeText(filters.status);

    if (status) {
      where.push('b.status = ?');
      params.push(status);
    } else {
      where.push("b.status NOT IN ('released', 'deceased')");
    }
    if (filters.locationId) {
      where.push('b.current_location_id = ?');
      params.push(filters.locationId);
    }
    if (filters.search) {
      where.push(`(
        b.name LIKE ? OR b.case_number LIKE ? OR b.species LIKE ? OR b.notes LIKE ?
        OR b.initial_condition LIKE ? OR l.name LIKE ?
        OR EXISTS (SELECT 1 FROM pigeon_note_logs n WHERE n.bird_id = b.id AND n.note_text LIKE ?)
      )`);
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT b.*, l.name as location_name,
        (SELECT COUNT(*) FROM pigeon_medications m WHERE m.bird_id = b.id AND m.active = 1) as active_med_count,
        (SELECT photo_path FROM pigeon_photos p WHERE p.bird_id = b.id ORDER BY p.upload_date ASC LIMIT 1) as first_photo
      FROM pigeon_birds b
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      ${whereClause}
      ORDER BY
        CASE b.status
          WHEN 'critical' THEN 1
          WHEN 'active' THEN 2
          WHEN 'permanent_resident' THEN 3
          WHEN 'ready_for_release' THEN 4
          WHEN 'released' THEN 5
          WHEN 'deceased' THEN 6
          ELSE 7
        END,
        lower(COALESCE(l.name, '')),
        lower(COALESCE(b.name, b.case_number))
    `).all(...params);
  }

  getBirdDetail(id) {
    const bird = this.getBirdById(id);
    if (!bird) return null;
    bird.medications = this.listBirdMedications(id);
    bird.photos = this.listBirdPhotos(id);
    bird.weights = this.listBirdWeights(id);
    bird.noteLogs = this.listBirdNotes(id);
    return bird;
  }

  listBirdNotes(birdId) {
    return this.db.prepare(`
      SELECT id, bird_id, note_date, note_text, created_at, updated_at
      FROM pigeon_note_logs
      WHERE bird_id = ?
      ORDER BY note_date DESC, id DESC
    `).all(birdId);
  }

  getNoteById(id) {
    return this.db.prepare(`
      SELECT id, bird_id, note_date, note_text, created_at, updated_at
      FROM pigeon_note_logs
      WHERE id = ?
    `).get(id);
  }

  addBirdNote(birdId, input = {}) {
    const bird = this.getBirdById(birdId);
    if (!bird) return null;

    const rawNoteDate = normalizeText(input.note_date);
    const noteDate = rawNoteDate ? normalizeDateOnly(rawNoteDate) : toDateOnly();
    const noteText = normalizeText(input.note_text || input.notes);
    if (!noteDate || !noteText) return null;

    const result = this.db.prepare(`
      INSERT INTO pigeon_note_logs (bird_id, note_date, note_text)
      VALUES (?, ?, ?)
    `).run(birdId, noteDate, noteText);

    return this.getNoteById(result.lastInsertRowid);
  }

  updateBirdNote(noteId, input = {}) {
    const note = this.getNoteById(noteId);
    if (!note) return null;

    const noteDate = input.note_date !== undefined ? normalizeDateOnly(input.note_date) : note.note_date;
    const noteText = input.note_text !== undefined || input.notes !== undefined
      ? normalizeText(input.note_text || input.notes)
      : note.note_text;
    if (!noteDate || !noteText) return null;

    this.db.prepare(`
      UPDATE pigeon_note_logs
      SET note_date = ?, note_text = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(noteDate, noteText, noteId);

    return this.getNoteById(noteId);
  }

  deleteBirdNote(noteId) {
    const note = this.getNoteById(noteId);
    if (!note) return null;
    this.db.prepare('DELETE FROM pigeon_note_logs WHERE id = ?').run(noteId);
    return note;
  }

  listBirdWeights(birdId) {
    const bird = this.getBirdById(birdId);
    if (!bird) return [];

    const logs = this.db.prepare(`
      SELECT id, bird_id, weight_date, weight_grams, created_at, 'log' as source
      FROM pigeon_weight_logs
      WHERE bird_id = ?
      ORDER BY weight_date ASC, id ASC
    `).all(birdId);

    const rows = logs.map(row => ({
      ...row,
      weight_grams: Number(row.weight_grams),
    }));

    if (bird.initial_weight !== null && bird.initial_weight !== undefined && bird.intake_date) {
      const hasLogForIntakeDate = rows.some(row => row.weight_date === bird.intake_date);
      if (!hasLogForIntakeDate) {
        rows.push({
          id: null,
          bird_id: Number(bird.id),
          weight_date: bird.intake_date,
          weight_grams: Number(bird.initial_weight),
          created_at: null,
          source: 'initial',
        });
      }
    }

    return rows.sort((a, b) => {
      const byDate = String(a.weight_date).localeCompare(String(b.weight_date));
      if (byDate !== 0) return byDate;
      if (a.source === b.source) return (a.id || 0) - (b.id || 0);
      return a.source === 'log' ? -1 : 1;
    });
  }

  getWeightById(id) {
    const row = this.db.prepare(`
      SELECT id, bird_id, weight_date, weight_grams, created_at, 'log' as source
      FROM pigeon_weight_logs
      WHERE id = ?
    `).get(id);
    return row ? { ...row, weight_grams: Number(row.weight_grams) } : null;
  }

  addBirdWeight(birdId, input = {}) {
    const bird = this.getBirdById(birdId);
    if (!bird) return null;

    const weightDate = normalizeDateOnly(input.weight_date);
    const weightGrams = parsePositiveFloat(input.weight_grams);
    if (!weightDate || weightGrams === null) return null;

    this.db.prepare(`
      INSERT INTO pigeon_weight_logs (bird_id, weight_date, weight_grams)
      VALUES (?, ?, ?)
      ON CONFLICT(bird_id, weight_date) DO UPDATE SET
        weight_grams = excluded.weight_grams,
        created_at = datetime('now')
    `).run(birdId, weightDate, weightGrams);

    return this.db.prepare(`
      SELECT id, bird_id, weight_date, weight_grams, created_at, 'log' as source
      FROM pigeon_weight_logs
      WHERE bird_id = ? AND weight_date = ?
    `).get(birdId, weightDate);
  }

  deleteBirdWeight(weightId) {
    const weight = this.getWeightById(weightId);
    if (!weight) return null;
    this.db.prepare('DELETE FROM pigeon_weight_logs WHERE id = ?').run(weightId);
    return weight;
  }

  createMedication(birdId, input = {}) {
    const bird = this.getBirdById(birdId);
    if (!bird) return null;
    const name = normalizeText(input.name || input.medication_name);
    if (!name) return null;

    const frequency = parsePositiveInt(input.frequency_per_day, 1);
    const startDate = normalizeText(input.start_date) || toDateOnly();
    let endDate = normalizeText(input.end_date);
    if (!endDate) {
      const d = new Date(`${startDate}T00:00:00`);
      d.setDate(d.getDate() + 7);
      endDate = toDateOnly(d);
    }
    const kind = normalizeText(input.kind) === 'supplement' ? 'supplement' : 'medication';

    const insert = this.db.prepare(`
      INSERT INTO pigeon_medications (bird_id, kind, name, dosage, frequency_per_day, start_date, end_date, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const tx = this.db.transaction(() => {
      const result = insert.run(
        birdId,
        kind,
        name,
        normalizeText(input.dosage),
        frequency,
        startDate,
        endDate,
        normalizeText(input.notes)
      );
      this.generateScheduledDoses(result.lastInsertRowid, frequency, startDate, endDate);
      return result.lastInsertRowid;
    });

    const medId = tx();
    return this.getMedicationById(medId);
  }

  generateScheduledDoses(medicationId, frequency, startDate, endDate) {
    const insert = this.db.prepare(`
      INSERT INTO pigeon_medication_logs (medication_id, scheduled_datetime, given)
      VALUES (?, ?, 0)
    `);
    const existing = this.db.prepare(`
      SELECT id FROM pigeon_medication_logs WHERE medication_id = ? AND scheduled_datetime = ? LIMIT 1
    `);

    for (const scheduled of generateDoseDateTimes(frequency, startDate, endDate)) {
      if (!existing.get(medicationId, scheduled)) {
        insert.run(medicationId, scheduled);
      }
    }
  }

  getMedicationById(id) {
    return mapMedicationRow(this.db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id AND given = 1) as doses_given,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id) as total_doses,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id AND given = 0 AND scheduled_datetime < ?) as overdue_count
      FROM pigeon_medications m
      WHERE m.id = ?
    `).get(toDateTimeString(), id));
  }

  listBirdMedications(birdId) {
    return this.db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id AND given = 1) as doses_given,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id) as total_doses,
        (SELECT COUNT(*) FROM pigeon_medication_logs WHERE medication_id = m.id AND given = 0 AND scheduled_datetime < ?) as overdue_count
      FROM pigeon_medications m
      WHERE m.bird_id = ?
      ORDER BY m.active DESC, m.kind, lower(m.name)
    `).all(toDateTimeString(), birdId).map(mapMedicationRow);
  }

  updateMedication(id, updates = {}) {
    const med = this.getMedicationById(id);
    if (!med) return null;

    const allowed = ['kind', 'name', 'dosage', 'frequency_per_day', 'start_date', 'end_date', 'notes', 'active'];
    const scheduleChanged = ['frequency_per_day', 'start_date', 'end_date'].some(field => updates[field] !== undefined);
    const sets = [];
    const values = [];

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        if (field === 'kind') values.push(updates[field] === 'supplement' ? 'supplement' : 'medication');
        else if (field === 'frequency_per_day') values.push(parsePositiveInt(updates[field], med.frequency_per_day));
        else if (field === 'active') values.push(updates[field] ? 1 : 0);
        else values.push(field === 'name' ? normalizeText(updates[field]) || med.name : updates[field]);
      }
    }

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      values.push(id);
      this.db.prepare(`UPDATE pigeon_medications SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    if (scheduleChanged) {
      const updated = this.getMedicationById(id);
      this.db.prepare('DELETE FROM pigeon_medication_logs WHERE medication_id = ? AND given = 0').run(id);
      this.generateScheduledDoses(updated.id, updated.frequency_per_day, updated.start_date, updated.end_date);
    }

    return this.getMedicationById(id);
  }

  deleteMedication(id) {
    const med = this.getMedicationById(id);
    if (!med) return false;
    this.db.prepare('DELETE FROM pigeon_medications WHERE id = ?').run(id);
    return true;
  }

  logDose(medicationId, input = {}) {
    const med = this.getMedicationById(medicationId);
    if (!med) return null;
    const now = toDateTimeString();
    const notes = normalizeText(input.notes);

    if (input.log_id) {
      this.db.prepare(`
        UPDATE pigeon_medication_logs
        SET given = 1, completed_datetime = ?, notes = ?
        WHERE id = ? AND medication_id = ?
      `).run(now, notes, input.log_id, medicationId);
      return this.db.prepare('SELECT * FROM pigeon_medication_logs WHERE id = ?').get(input.log_id);
    }

    const result = this.db.prepare(`
      INSERT INTO pigeon_medication_logs (medication_id, scheduled_datetime, completed_datetime, given, notes)
      VALUES (?, ?, ?, 1, ?)
    `).run(medicationId, now, now, notes);
    return this.db.prepare('SELECT * FROM pigeon_medication_logs WHERE id = ?').get(result.lastInsertRowid);
  }

  undoDose(logId) {
    const log = this.db.prepare('SELECT * FROM pigeon_medication_logs WHERE id = ?').get(logId);
    if (!log) return null;

    this.db.prepare(`
      UPDATE pigeon_medication_logs
      SET given = 0, completed_datetime = NULL, notes = NULL
      WHERE id = ?
    `).run(logId);
    return this.db.prepare('SELECT * FROM pigeon_medication_logs WHERE id = ?').get(logId);
  }

  listMedicationLogs(medicationId) {
    return this.db.prepare(`
      SELECT * FROM pigeon_medication_logs
      WHERE medication_id = ?
      ORDER BY scheduled_datetime DESC
    `).all(medicationId);
  }

  listDueDoses({ overdue = false, dueToday = false } = {}) {
    const now = toDateTimeString();
    const today = toDateOnly();
    const clauses = ['ml.given = 0', 'm.active = 1'];
    const params = [];
    const placeholders = ACTIVE_CARE_STATUSES.map(() => '?').join(', ');
    clauses.push(`b.status IN (${placeholders})`);
    params.push(...ACTIVE_CARE_STATUSES);

    if (overdue) {
      clauses.push('ml.scheduled_datetime < ?');
      params.push(now);
    }
    if (dueToday) {
      clauses.push("substr(ml.scheduled_datetime, 1, 10) = ?");
      params.push(today);
    }

    return this.db.prepare(`
      SELECT ml.id as log_id, ml.scheduled_datetime, ml.completed_datetime, ml.given, ml.notes as dose_notes,
        m.id as medication_id, m.kind, m.name, m.dosage, m.frequency_per_day, m.start_date, m.end_date, m.notes as medication_notes,
        b.id as bird_id, b.name as bird_name, b.case_number, b.species, b.status,
        l.id as location_id, COALESCE(l.name, 'Unassigned') as location_name,
        CASE WHEN ml.scheduled_datetime < ? THEN 1 ELSE 0 END as overdue
      FROM pigeon_medication_logs ml
      JOIN pigeon_medications m ON m.id = ml.medication_id
      JOIN pigeon_birds b ON b.id = m.bird_id
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY COALESCE(l.sort_order, 999999), lower(COALESCE(l.name, 'Unassigned')), ml.scheduled_datetime ASC, lower(COALESCE(b.name, b.case_number))
    `).all(now, ...params);
  }

  listCompletedDosesToday() {
    const today = toDateOnly();
    const placeholders = ACTIVE_CARE_STATUSES.map(() => '?').join(', ');
    return this.db.prepare(`
      SELECT ml.id as log_id, ml.scheduled_datetime, ml.completed_datetime, ml.given, ml.notes as dose_notes,
        m.id as medication_id, m.kind, m.name, m.dosage, m.frequency_per_day, m.start_date, m.end_date, m.notes as medication_notes,
        b.id as bird_id, b.name as bird_name, b.case_number, b.species, b.status,
        l.id as location_id, COALESCE(l.name, 'Unassigned') as location_name,
        0 as overdue
      FROM pigeon_medication_logs ml
      JOIN pigeon_medications m ON m.id = ml.medication_id
      JOIN pigeon_birds b ON b.id = m.bird_id
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE ml.given = 1
        AND ml.completed_datetime IS NOT NULL
        AND substr(ml.completed_datetime, 1, 10) = ?
        AND b.status IN (${placeholders})
      ORDER BY COALESCE(l.sort_order, 999999), lower(COALESCE(l.name, 'Unassigned')), ml.completed_datetime DESC, lower(COALESCE(b.name, b.case_number))
    `).all(today, ...ACTIVE_CARE_STATUSES);
  }

  listActiveMedicationsByRoom() {
    const placeholders = ACTIVE_CARE_STATUSES.map(() => '?').join(', ');
    return this.db.prepare(`
      SELECT m.*, b.id as bird_id, b.name as bird_name, b.case_number, b.species, b.status,
        l.id as location_id, COALESCE(l.name, 'Unassigned') as location_name
      FROM pigeon_medications m
      JOIN pigeon_birds b ON b.id = m.bird_id
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE m.active = 1 AND b.status IN (${placeholders})
      ORDER BY COALESCE(l.sort_order, 999999), lower(COALESCE(l.name, 'Unassigned')), lower(COALESCE(b.name, b.case_number)), lower(m.name)
    `).all(...ACTIVE_CARE_STATUSES);
  }

  listActiveBirdsByRoom() {
    const placeholders = ACTIVE_CARE_STATUSES.map(() => '?').join(', ');
    return this.db.prepare(`
      SELECT b.*, COALESCE(l.name, 'Unassigned') as location_name,
        (SELECT COUNT(*) FROM pigeon_medications m WHERE m.bird_id = b.id AND m.active = 1) as active_med_count
      FROM pigeon_birds b
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE b.status IN (${placeholders})
      ORDER BY COALESCE(l.sort_order, 999999), lower(COALESCE(l.name, 'Unassigned')), lower(COALESCE(b.name, b.case_number))
    `).all(...ACTIVE_CARE_STATUSES);
  }

  addPhoto(birdId, input = {}) {
    const bird = this.getBirdById(birdId);
    if (!bird || !input.photo_path) return null;
    const result = this.db.prepare(`
      INSERT INTO pigeon_photos (bird_id, photo_path, description, photo_type, upload_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      birdId,
      input.photo_path,
      normalizeText(input.description),
      normalizeText(input.photo_type) || 'progress',
      normalizeText(input.upload_date) || toDateTimeString()
    );
    return this.db.prepare('SELECT * FROM pigeon_photos WHERE id = ?').get(result.lastInsertRowid);
  }

  listBirdPhotos(birdId) {
    return this.db.prepare(`
      SELECT * FROM pigeon_photos WHERE bird_id = ? ORDER BY upload_date DESC
    `).all(birdId);
  }

  getPhotoById(id) {
    return this.db.prepare('SELECT * FROM pigeon_photos WHERE id = ?').get(id);
  }

  deletePhoto(id) {
    const photo = this.getPhotoById(id);
    if (!photo) return null;
    this.db.prepare('DELETE FROM pigeon_photos WHERE id = ?').run(id);
    return photo;
  }

  getStats() {
    const byStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM pigeon_birds GROUP BY status ORDER BY status
    `).all();
    const bySpecies = this.db.prepare(`
      SELECT species, COUNT(*) as count FROM pigeon_birds GROUP BY species ORDER BY count DESC, species
    `).all();
    const byRoom = this.db.prepare(`
      SELECT COALESCE(l.name, 'Unassigned') as location_name, COUNT(b.id) as count
      FROM pigeon_birds b
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE b.status NOT IN ('released', 'deceased')
      GROUP BY COALESCE(l.name, 'Unassigned')
      ORDER BY count DESC, location_name
    `).all();
    const activeMedsByRoom = this.db.prepare(`
      SELECT COALESCE(l.name, 'Unassigned') as location_name, COUNT(m.id) as count
      FROM pigeon_medications m
      JOIN pigeon_birds b ON b.id = m.bird_id
      LEFT JOIN pigeon_locations l ON l.id = b.current_location_id
      WHERE m.active = 1 AND b.status NOT IN ('released', 'deceased')
      GROUP BY COALESCE(l.name, 'Unassigned')
      ORDER BY count DESC, location_name
    `).all();

    return {
      total: this.db.prepare('SELECT COUNT(*) as count FROM pigeon_birds').get().count,
      activeBirds: this.db.prepare(`
        SELECT COUNT(*) as count FROM pigeon_birds WHERE status IN (${ACTIVE_CARE_STATUSES.map(() => '?').join(', ')})
      `).get(...ACTIVE_CARE_STATUSES).count,
      activeMeds: this.db.prepare('SELECT COUNT(*) as count FROM pigeon_medications WHERE active = 1').get().count,
      overdueMeds: this.listDueDoses({ overdue: true }).length,
      byStatus,
      bySpecies,
      byRoom,
      activeMedsByRoom,
    };
  }

  getSummary() {
    const stats = this.getStats();
    const overdueDoses = this.listDueDoses({ overdue: true });
    const dueTodayDoses = this.listDueDoses({ dueToday: true });
    const completedTodayDoses = this.listCompletedDosesToday();
    const activeMeds = this.listActiveMedicationsByRoom();
    const activeBirds = this.listActiveBirdsByRoom();
    const roomsByName = new Map();
    const birdsById = new Map();

    for (const location of this.getLocations()) {
      roomsByName.set(location.name, {
        location_id: location.id,
        location_name: location.name,
        bird_count: location.bird_count,
        active_med_count: location.active_med_count,
        dueDoses: [],
        completedDoses: [],
        activeMeds: [],
        birds: [],
      });
    }

    function ensureRoom(name, id) {
      const key = name || 'Unassigned';
      if (!roomsByName.has(key)) {
        roomsByName.set(key, {
          location_id: id || null,
          location_name: key,
          bird_count: 0,
          active_med_count: 0,
          dueDoses: [],
          completedDoses: [],
          activeMeds: [],
          birds: [],
        });
      }
      return roomsByName.get(key);
    }

    for (const bird of activeBirds) {
      const room = ensureRoom(bird.location_name, bird.current_location_id);
      const roomBird = {
        id: bird.id,
        name: bird.name,
        case_number: bird.case_number,
        species: bird.species,
        status: bird.status,
        current_location_id: bird.current_location_id,
        location_name: bird.location_name,
        activeMeds: [],
        dueDoses: [],
        completedDoses: [],
        medication_state: 'no_meds',
      };
      birdsById.set(bird.id, roomBird);
      room.birds.push(roomBird);
    }

    const dueOrOverdueByLog = new Map();
    [...overdueDoses, ...dueTodayDoses].forEach(dose => {
      dueOrOverdueByLog.set(dose.log_id, dose);
    });
    for (const dose of dueOrOverdueByLog.values()) {
      ensureRoom(dose.location_name, dose.location_id).dueDoses.push(dose);
      if (birdsById.has(dose.bird_id)) birdsById.get(dose.bird_id).dueDoses.push(dose);
    }
    for (const dose of completedTodayDoses) {
      ensureRoom(dose.location_name, dose.location_id).completedDoses.push(dose);
      if (birdsById.has(dose.bird_id)) birdsById.get(dose.bird_id).completedDoses.push(dose);
    }
    for (const med of activeMeds) {
      ensureRoom(med.location_name, med.location_id).activeMeds.push(med);
      if (birdsById.has(med.bird_id)) birdsById.get(med.bird_id).activeMeds.push(med);
    }

    for (const bird of birdsById.values()) {
      if (bird.dueDoses.length > 0) bird.medication_state = 'needs_meds';
      else if (bird.activeMeds.length > 0) bird.medication_state = 'medicated';
      else bird.medication_state = 'no_meds';
    }

    return {
      ...stats,
      dueTodayDoses,
      overdueDoses,
      completedTodayDoses,
      roomGroups: Array.from(roomsByName.values()).filter(room =>
        room.birds.length > 0 || room.bird_count > 0 || room.activeMeds.length > 0 || room.dueDoses.length > 0 || room.completedDoses.length > 0
      ),
    };
  }
}

function createPigeonStore(options) {
  return new PigeonStore(options);
}

function getPigeonStore() {
  if (!singletonStore) singletonStore = new PigeonStore();
  return singletonStore;
}

function resetPigeonStoreForTests() {
  if (singletonStore) singletonStore.close();
  singletonStore = null;
}

module.exports = {
  ACTIVE_CARE_STATUSES,
  DEFAULT_DB_PATH,
  PigeonStore,
  createPigeonStore,
  doseHoursForFrequency,
  generateDoseDateTimes,
  getPigeonStore,
  resetPigeonStoreForTests,
  toDateOnly,
  toDateTimeString,
};

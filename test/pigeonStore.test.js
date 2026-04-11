const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createPigeonStore, generateDoseDateTimes } = require('../server/pigeonStore');
const { importExistingPigeonDataIfNeeded } = require('../server/pigeonImport');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-store-'));
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('pigeon store creates rooms, birds, medication schedules, and dose logs', () => {
  const dir = makeTempDir();
  const store = createPigeonStore({ dbPath: path.join(dir, 'pigeons.db') });
  try {
    const room = store.createLocation('Computer Room');
    const bird = store.createBird({
      name: 'Blue',
      species: 'Feral Pigeon',
      current_location_id: room.id,
      status: 'active',
      intake_date: '2026-04-10',
    });

    assert.equal(bird.location_name, 'Computer Room');

    const med = store.createMedication(bird.id, {
      kind: 'supplement',
      name: 'Calcium',
      dosage: 'pinch',
      frequency_per_day: 2,
      start_date: '2026-04-10',
      end_date: '2026-04-11',
    });

    assert.equal(med.kind, 'supplement');
    assert.equal(med.total_doses, 4);
    assert.deepEqual(generateDoseDateTimes(2, '2026-04-10', '2026-04-10'), [
      '2026-04-10 08:00:00',
      '2026-04-10 20:00:00',
    ]);

    const logs = store.listMedicationLogs(med.id);
    store.logDose(med.id, { log_id: logs[0].id });
    const updated = store.getMedicationById(med.id);
    assert.equal(updated.doses_given, 1);

    const stopped = store.updateMedication(med.id, { active: 0 });
    assert.equal(stopped.active, 0);
    assert.equal(store.deleteMedication(med.id), true);
    assert.equal(store.listBirdMedications(bird.id).length, 0);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('pigeon store returns due and overdue room-grouped medication data', () => {
  const dir = makeTempDir();
  const store = createPigeonStore({ dbPath: path.join(dir, 'pigeons.db') });
  try {
    const room = store.createLocation('Computer Room');
    const bird = store.createBird({
      name: 'Neve',
      current_location_id: room.id,
      status: 'active',
    });
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const med = store.createMedication(bird.id, {
      name: 'Baytril',
      frequency_per_day: 1,
      start_date: start,
      end_date: start,
    });

    store.db.prepare(
      'UPDATE pigeon_medication_logs SET scheduled_datetime = ? WHERE medication_id = ?'
    ).run('2000-01-01 09:00:00', med.id);

    const overdue = store.listDueDoses({ overdue: true });
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0].location_name, 'Computer Room');

    const summary = store.getSummary();
    assert.equal(summary.roomGroups.find(roomGroup => roomGroup.location_name === 'Computer Room').dueDoses.length, 1);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('pigeon import migrates old birds, medications, logs, and defaults room to Unassigned', () => {
  const dir = makeTempDir();
  const oldRoot = path.join(dir, 'old-pigeons');
  const oldDbDir = path.join(oldRoot, 'db');
  fs.mkdirSync(oldDbDir, { recursive: true });
  const oldDbPath = path.join(oldDbDir, 'rehab.db');
  const oldDb = new Database(oldDbPath);
  try {
    oldDb.exec(`
      CREATE TABLE birds (
        id INTEGER PRIMARY KEY,
        case_number TEXT,
        name TEXT,
        species TEXT,
        intake_date TEXT,
        location_found TEXT,
        initial_condition TEXT,
        initial_weight REAL,
        status TEXT,
        release_date TEXT,
        death_date TEXT,
        death_cause TEXT,
        notes TEXT,
        breathing TEXT,
        hydration TEXT,
        weight_assessment TEXT,
        injury_type TEXT,
        alert_level TEXT,
        created_at TEXT
      );
      CREATE TABLE medications (
        id INTEGER PRIMARY KEY,
        bird_id INTEGER,
        medication_name TEXT,
        dosage TEXT,
        frequency_per_day INTEGER,
        start_date TEXT,
        end_date TEXT,
        notes TEXT,
        active INTEGER,
        created_at TEXT
      );
      CREATE TABLE medication_logs (
        id INTEGER PRIMARY KEY,
        medication_id INTEGER,
        scheduled_datetime TEXT,
        completed_datetime TEXT,
        given INTEGER,
        notes TEXT
      );
      CREATE TABLE photos (
        id INTEGER PRIMARY KEY,
        bird_id INTEGER,
        photo_path TEXT,
        thumbnail_path TEXT,
        upload_date TEXT,
        description TEXT,
        photo_type TEXT
      );
    `);
    oldDb.prepare(`
      INSERT INTO birds (id, case_number, name, species, intake_date, status)
      VALUES (1, 'BR-1', 'Pip', 'Feral Pigeon', '2026-01-01', 'active')
    `).run();
    oldDb.prepare(`
      INSERT INTO medications (id, bird_id, medication_name, dosage, frequency_per_day, start_date, end_date, active)
      VALUES (2, 1, 'Spartrix', '1 tablet', 1, '2026-01-01', '2026-01-02', 1)
    `).run();
    oldDb.prepare(`
      INSERT INTO medication_logs (id, medication_id, scheduled_datetime, given)
      VALUES (3, 2, '2026-01-01 09:00:00', 0)
    `).run();
  } finally {
    oldDb.close();
  }

  const targetDbPath = path.join(dir, 'target', 'pigeons.db');
  const result = importExistingPigeonDataIfNeeded({
    targetDbPath,
    oldRoot,
    oldDbPath,
    uploadDir: path.join(dir, 'uploads'),
  });

  assert.equal(result.imported, true);
  assert.equal(result.birds, 1);
  assert.equal(result.medications, 1);
  assert.equal(result.medicationLogs, 1);

  const store = createPigeonStore({ dbPath: targetDbPath });
  try {
    const bird = store.getBirdDetail(1);
    assert.equal(bird.name, 'Pip');
    assert.equal(bird.location_name, 'Unassigned');
    assert.equal(bird.medications[0].name, 'Spartrix');
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

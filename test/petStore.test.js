const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createPetStore } = require('../server/petStore');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pet-store-'));
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('pet store creates a dog with notes, weight, photo metadata, and medication', () => {
  const dir = makeTempDir();
  const store = createPetStore({ dbPath: path.join(dir, 'pets.db') });
  try {
    const dog = store.createPet({
      name: 'Molly',
      animal_type: 'dog',
      breed: 'Lab',
      status: 'active',
    });
    assert.equal(dog.name, 'Molly');
    assert.equal(dog.animal_type, 'dog');

    const note = store.addPetNote(dog.id, {
      note_date: '2026-04-18',
      note_text: 'Eating well.',
    });
    assert.equal(note.note_text, 'Eating well.');

    const weight = store.addPetWeight(dog.id, {
      weight_date: '2026-04-18',
      weight_lbs: '62.5',
    });
    assert.equal(weight.weight_lbs, 62.5);

    const photo = store.addPhoto(dog.id, {
      photo_path: '/family/animals/pets/uploads/photos/test.jpg',
      description: 'Profile',
    });
    assert.equal(photo.photo_type, 'progress');

    const med = store.createMedication(dog.id, {
      kind: 'preventative',
      name: 'Flea and tick',
      dosage: '1 chew',
      schedule_type: 'interval',
      start_date: '2026-04-18',
    });
    assert.equal(med.kind, 'preventative');
    assert.equal(med.interval_days, 30);

    const detail = store.getPetDetail(dog.id);
    assert.equal(detail.noteLogs.length, 1);
    assert.equal(detail.weights.length, 1);
    assert.equal(detail.photos.length, 1);
    assert.equal(detail.medications.length, 1);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('daily-course pet medication generates expected scheduled dose logs', () => {
  const dir = makeTempDir();
  const store = createPetStore({ dbPath: path.join(dir, 'pets.db') });
  try {
    const pet = store.createPet({ name: 'Pip', animal_type: 'cat' });
    const med = store.createMedication(pet.id, {
      name: 'Antibiotic',
      schedule_type: 'daily_course',
      frequency_per_day: 2,
      start_date: '2026-04-10',
      end_date: '2026-04-11',
    });
    const logs = store.listMedicationLogs(med.id).map(log => log.scheduled_datetime).sort();
    assert.deepEqual(logs, [
      '2026-04-10 08:00:00',
      '2026-04-10 20:00:00',
      '2026-04-11 08:00:00',
      '2026-04-11 20:00:00',
    ]);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('recurring interval medication defaults to 30 days and accepts 45 days', () => {
  const dir = makeTempDir();
  const store = createPetStore({ dbPath: path.join(dir, 'pets.db') });
  try {
    const pet = store.createPet({ name: 'Scout', animal_type: 'dog' });
    const defaultMed = store.createMedication(pet.id, {
      name: 'Monthly preventative',
      schedule_type: 'interval',
      start_date: '2026-04-01',
    });
    assert.equal(defaultMed.interval_days, 30);
    assert.equal(defaultMed.next_due_date, '2026-04-01');
    assert.deepEqual(store.listMedicationLogs(defaultMed.id).map(log => log.scheduled_datetime), [
      '2026-04-01 09:00:00',
    ]);

    const fortyFive = store.createMedication(pet.id, {
      name: 'Long preventative',
      schedule_type: 'interval',
      start_date: '2026-04-01',
      interval_days: 45,
      next_due_date: '2026-04-15',
    });
    assert.equal(fortyFive.interval_days, 45);
    assert.equal(fortyFive.next_due_date, '2026-04-15');
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('marking an interval dose advances the next due date from completion date', () => {
  const dir = makeTempDir();
  const store = createPetStore({
    dbPath: path.join(dir, 'pets.db'),
    now: () => new Date('2026-04-10T12:30:00'),
  });
  try {
    const pet = store.createPet({ name: 'Sunny', animal_type: 'dog' });
    const med = store.createMedication(pet.id, {
      name: 'Flea and tick',
      schedule_type: 'interval',
      start_date: '2026-04-01',
      interval_days: 45,
    });
    const firstLog = store.listMedicationLogs(med.id)[0];
    const completed = store.logDose(med.id, { log_id: firstLog.id });
    assert.equal(completed.given, 1);

    const updated = store.getMedicationById(med.id);
    assert.equal(updated.next_due_date, '2026-05-25');
    const pending = store.listMedicationLogs(med.id).filter(log => !log.given && !log.skipped);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].scheduled_datetime, '2026-05-25 09:00:00');
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('summary includes overdue and due today meds and excludes inactive/deceased pets', () => {
  const dir = makeTempDir();
  const store = createPetStore({
    dbPath: path.join(dir, 'pets.db'),
    now: () => new Date('2026-04-18T10:00:00'),
  });
  try {
    const active = store.createPet({ name: 'Active Dog', animal_type: 'dog', status: 'active' });
    const inactive = store.createPet({ name: 'Inactive Dog', animal_type: 'dog', status: 'inactive' });
    const deceased = store.createPet({ name: 'Old Cat', animal_type: 'cat', status: 'deceased' });

    store.createMedication(active.id, {
      name: 'Due now',
      schedule_type: 'daily_course',
      frequency_per_day: 1,
      start_date: '2026-04-18',
      end_date: '2026-04-18',
    });
    store.createMedication(inactive.id, {
      name: 'Hidden inactive',
      schedule_type: 'daily_course',
      start_date: '2026-04-18',
      end_date: '2026-04-18',
    });
    store.createMedication(deceased.id, {
      name: 'Hidden deceased',
      schedule_type: 'daily_course',
      start_date: '2026-04-18',
      end_date: '2026-04-18',
    });

    const summary = store.getSummary();
    assert.equal(summary.dueTodayDoses.length, 1);
    assert.equal(summary.overdueDoses.length, 1);
    assert.equal(summary.dueTodayDoses[0].pet_name, 'Active Dog');
    assert.equal(summary.activePets, 1);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('deleting a pet cascades dependent rows', () => {
  const dir = makeTempDir();
  const store = createPetStore({ dbPath: path.join(dir, 'pets.db') });
  try {
    const pet = store.createPet({ name: 'Cascade', animal_type: 'cat' });
    const med = store.createMedication(pet.id, {
      name: 'Medicine',
      start_date: '2026-04-01',
      end_date: '2026-04-01',
    });
    store.addPetNote(pet.id, { note_date: '2026-04-01', note_text: 'Note' });
    store.addPetWeight(pet.id, { weight_date: '2026-04-01', weight_lbs: 10 });
    store.addPhoto(pet.id, { photo_path: '/family/animals/pets/uploads/photos/test.jpg' });

    assert.equal(store.deletePet(pet.id), true);
    assert.equal(store.getPetById(pet.id), undefined);
    assert.equal(store.getMedicationById(med.id), undefined);
    assert.equal(store.db.prepare('SELECT COUNT(*) as count FROM pet_note_logs').get().count, 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) as count FROM pet_weight_logs').get().count, 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) as count FROM pet_photos').get().count, 0);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

test('weight logs use pounds and update by same-date upsert', () => {
  const dir = makeTempDir();
  const store = createPetStore({ dbPath: path.join(dir, 'pets.db') });
  try {
    const pet = store.createPet({ name: 'Scale', animal_type: 'dog' });
    store.addPetWeight(pet.id, { weight_date: '2026-04-18', weight_lbs: 20 });
    store.addPetWeight(pet.id, { weight_date: '2026-04-18', weight_lbs: 21.5 });
    const weights = store.listPetWeights(pet.id);
    assert.equal(weights.length, 1);
    assert.equal(weights[0].weight_lbs, 21.5);
  } finally {
    store.close();
    cleanupTempDir(dir);
  }
});

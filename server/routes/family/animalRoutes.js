const express = require('express');

const { getPetStore: defaultGetPetStore } = require('../../petStore');
const { getPigeonStore: defaultGetPigeonStore } = require('../../pigeonStore');

function mapPetDose(dose, bucket) {
  return {
    source: 'pet',
    bucket,
    animalId: dose.pet_id,
    animalName: dose.pet_name,
    animalType: dose.animal_type,
    medicationId: dose.medication_id,
    logId: dose.log_id,
    kind: dose.kind,
    name: dose.name,
    dosage: dose.dosage,
    scheduledDatetime: dose.scheduled_datetime,
    completedDatetime: dose.completed_datetime || null,
    overdue: !!dose.overdue,
    openHref: `/family/animals/pets?pet=${encodeURIComponent(dose.pet_id)}`,
  };
}

function mapPigeonDose(dose, bucket) {
  return {
    source: 'pigeon',
    bucket,
    animalId: dose.bird_id,
    animalName: dose.bird_name || dose.case_number,
    animalType: dose.species || 'pigeon',
    medicationId: dose.medication_id,
    logId: dose.log_id,
    kind: dose.kind,
    name: dose.name,
    dosage: dose.dosage,
    scheduledDatetime: dose.scheduled_datetime,
    completedDatetime: dose.completed_datetime || null,
    overdue: !!dose.overdue,
    openHref: `/family/animals/pigeons?bird=${encodeURIComponent(dose.bird_id)}`,
  };
}

function uniqueByLog(rows) {
  const map = new Map();
  rows.forEach(row => map.set(`${row.source}:${row.logId}`, row));
  return Array.from(map.values()).sort((a, b) => {
    const byDate = String(a.scheduledDatetime).localeCompare(String(b.scheduledDatetime));
    if (byDate !== 0) return byDate;
    return String(a.animalName).localeCompare(String(b.animalName));
  });
}

function buildAnimalSummary({ petStore, pigeonStore }) {
  const petSummary = petStore.getSummary();
  const pigeonSummary = pigeonStore.getSummary();

  const petDue = uniqueByLog([
    ...(petSummary.overdueDoses || []).map(dose => mapPetDose(dose, 'overdue')),
    ...(petSummary.dueTodayDoses || []).map(dose => mapPetDose(dose, 'dueToday')),
  ]);
  const pigeonDue = uniqueByLog([
    ...(pigeonSummary.overdueDoses || []).map(dose => mapPigeonDose(dose, 'overdue')),
    ...(pigeonSummary.dueTodayDoses || []).map(dose => mapPigeonDose(dose, 'dueToday')),
  ]);
  const dueItems = uniqueByLog([...petDue, ...pigeonDue]);
  const completedItems = [
    ...(petSummary.completedTodayDoses || []).map(dose => mapPetDose(dose, 'completed')),
    ...(pigeonSummary.completedTodayDoses || []).map(dose => mapPigeonDose(dose, 'completed')),
  ].sort((a, b) => String(b.completedDatetime || '').localeCompare(String(a.completedDatetime || '')));

  return {
    overdueCount: dueItems.filter(item => item.overdue).length,
    dueTodayCount: dueItems.length,
    completedTodayCount: completedItems.length,
    pets: {
      total: petSummary.total || 0,
      active: petSummary.activePets || 0,
      activeMeds: petSummary.activeMeds || 0,
      overdueDoses: petSummary.overdueDoses || [],
      dueTodayDoses: petSummary.dueTodayDoses || [],
      completedTodayDoses: petSummary.completedTodayDoses || [],
    },
    pigeons: {
      total: pigeonSummary.total || 0,
      active: pigeonSummary.activeBirds || 0,
      activeMeds: pigeonSummary.activeMeds || 0,
      overdueDoses: pigeonSummary.overdueDoses || [],
      dueTodayDoses: pigeonSummary.dueTodayDoses || [],
      completedTodayDoses: pigeonSummary.completedTodayDoses || [],
    },
    dueItems,
    completedItems,
  };
}

function createAnimalRoutes(options = {}) {
  const getPetStore = options.getPetStore || defaultGetPetStore;
  const getPigeonStore = options.getPigeonStore || defaultGetPigeonStore;
  const router = express.Router();

  router.get('/animals/summary', (req, res) => {
    res.json(buildAnimalSummary({
      petStore: getPetStore(),
      pigeonStore: getPigeonStore(),
    }));
  });

  return router;
}

module.exports = {
  buildAnimalSummary,
  createAnimalRoutes,
};

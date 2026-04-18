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

function addDays(dateOnly, days) {
  const clean = normalizeDateOnly(dateOnly) || toDateOnly();
  const d = new Date(`${clean}T00:00:00`);
  d.setDate(d.getDate() + parsePositiveInt(days, 1));
  return toDateOnly(d);
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

function scheduledDateTimeForDate(dateOnly, hour = 9) {
  const clean = normalizeDateOnly(dateOnly) || toDateOnly();
  const d = new Date(`${clean}T00:00:00`);
  d.setHours(hour, 0, 0, 0);
  return toDateTimeString(d);
}

module.exports = {
  addDays,
  doseHoursForFrequency,
  generateDoseDateTimes,
  normalizeDateOnly,
  normalizeText,
  parseFloatOrNull,
  parsePositiveFloat,
  parsePositiveInt,
  scheduledDateTimeForDate,
  toDateOnly,
  toDateTimeString,
};

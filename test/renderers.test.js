const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
} = require('../server/healthPageViews');

function makeHealthData() {
  return {
    person: { slug: 'andrew', name: 'Andrew' },
    reminders: [],
    bloodworkReport: null,
    latestImaging: [],
    immunizations: [],
    concerns: [],
    reportFiles: [],
    latestLabs: null,
    imagingStudies: [],
  };
}

test('health person page renders expected title', () => {
  const html = renderPersonHealthPage(makeHealthData());
  assert.match(html, /<title>Andrew Health<\/title>/);
  assert.match(html, /Andrew Health/);
});

test('health section page renders expected person and section title', () => {
  const html = renderPersonHealthSectionPage(makeHealthData(), 'bloodwork');
  assert.match(html, /Andrew Bloodwork/);
  assert.match(html, /Latest date/);
});

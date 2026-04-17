const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
} = require('../server/healthPageViews');
const {
  getDashboardDescription,
  getPortfolioPositionCount,
} = require('../server/homePage');

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

test('home page dashboard description uses dynamic company count', () => {
  assert.equal(
    getDashboardDescription(9),
    "Real-time growth portfolio analysis. 9 companies tracked across revenue growth, valuation, profitability, and Saul's investing rules."
  );
  assert.equal(
    getDashboardDescription(1),
    "Real-time growth portfolio analysis. 1 company tracked across revenue growth, valuation, profitability, and Saul's investing rules."
  );
});

test('portfolio position count prefers holdings and falls back to companies', () => {
  assert.equal(getPortfolioPositionCount({
    getPortfolioHoldings() {
      return ['ALAB', 'APP'];
    },
    getCompanies() {
      return ['ALAB'];
    },
  }), 2);

  assert.equal(getPortfolioPositionCount({
    getPortfolioHoldings() {
      return [];
    },
    getCompanies() {
      return ['ALAB', 'APP', 'IREN'];
    },
  }), 3);
});

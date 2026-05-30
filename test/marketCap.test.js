const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCompany } = require('../server/normalizer');
const { overlayLivePrice } = require('../server/routes/portfolioRoutes');

test('normalizer treats mid-six-figure numeric market cap as millions', () => {
  const company = normalizeCompany({
    ticker: 'APP',
    quantitative: {
      price_and_valuation: {
        current_price: 465.31,
        market_cap: 156465.6,
      },
    },
  });

  assert.equal(company.marketCapMil, 156465.6);
});

test('normalizer converts large numeric market cap from dollars to millions', () => {
  const company = normalizeCompany({
    ticker: 'MU',
    quantitative: {
      price_and_valuation: {
        current_price: 425.5,
        market_cap: 476910000000,
      },
    },
  });

  assert.equal(company.marketCapMil, 476910);
});

test('live price overlay updates market cap from report price ratio', () => {
  const company = {
    ticker: 'APP',
    price: 465.31,
    marketCapMil: 156465.6,
    calculated: {},
  };

  const overlaid = overlayLivePrice(company, 613.09);

  assert.equal(overlaid.priceSource, 'live');
  assert.equal(overlaid.price, 613.09);
  assert.equal(overlaid.marketCapMil, 206158.25);
});

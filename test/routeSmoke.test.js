const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { createApp } = require('../server/createApp');

function makeAuth(role = 'family') {
  return (req, res, next) => {
    req.user = {
      email: role === 'family' ? 'drew1618t@gmail.com' : 'friend@example.org',
      role,
    };
    next();
  };
}

function makeDeps() {
  return {
    dataLoader: {
      getCompanies() {
        return [{
          ticker: 'TEST',
          price: 10,
          calculated: {},
        }];
      },
      getCompany(ticker) {
        return {
          company: {
            ticker: ticker.toUpperCase(),
            price: 10,
            calculated: {},
          },
          analysis: null,
          rawMarkdown: '',
        };
      },
      getAvailableTickers() {
        return { portfolio: ['TEST'], available: ['MOCK'] };
      },
      getNonPortfolioCompanies() {
        return [{
          ticker: 'MOCK',
          price: 20,
          qualityScore: 71,
          calculated: {},
        }];
      },
      getPortfolioHoldings() {
        return [{ ticker: 'TEST', shares: 1 }];
      },
      getLastLoadTime() {
        return '2026-04-14T00:00:00.000Z';
      },
      refresh() {
        return this.getCompanies();
      },
    },
    sheetsPoller: {
      getLiveData() {
        return { stocks: [] };
      },
      async forceRefresh() {
        return { stocks: [] };
      },
    },
    requestTracker: {
      getRequests() {
        return [];
      },
      addRequest(ticker) {
        return { ticker, count: 1 };
      },
    },
    taxStore: {
      async getTaxes() {
        return {
          taxYear: 2026,
          summary: {},
          planner: {},
          positions: [],
          realizedSales: [],
          attentionItems: [],
        };
      },
      updateCarryoverLoss() {
        return { carryoverLoss: 0 };
      },
      updateSaleConfirmation() {
        return { confirmed: true };
      },
      updatePlanner() {
        return {};
      },
    },
    writingStore: {
      getArticles() {
        return [];
      },
      getArticle() {
        return null;
      },
      createArticle(data) {
        return data.title ? { id: 'article-1', slug: 'article-1', ...data } : null;
      },
      updateArticle() {
        return { id: 'article-1' };
      },
      deleteArticle() {
        return true;
      },
    },
    writingAnalytics: {
      getAnalytics() {
        return { totalViews: 0, articleStats: [] };
      },
      recordView() {},
    },
  };
}

function makeAnimalStoreDeps() {
  const deps = makeDeps();
  deps.getPetStore = () => ({
    getSummary() {
      return {
        total: 1,
        activePets: 1,
        activeMeds: 1,
        overdueDoses: [{
          log_id: 11,
          pet_id: 1,
          pet_name: 'Molly',
          animal_type: 'dog',
          medication_id: 21,
          kind: 'preventative',
          name: 'Flea and tick',
          dosage: '1 chew',
          scheduled_datetime: '2026-04-18 09:00:00',
          overdue: 1,
        }],
        dueTodayDoses: [],
        completedTodayDoses: [],
      };
    },
  });
  deps.getPigeonStore = () => ({
    getSummary() {
      return {
        total: 1,
        activeBirds: 1,
        activeMeds: 1,
        overdueDoses: [],
        dueTodayDoses: [{
          log_id: 12,
          bird_id: 2,
          bird_name: 'Blue',
          case_number: 'PG-1',
          species: 'Feral Pigeon',
          medication_id: 22,
          kind: 'medication',
          name: 'Baytril',
          dosage: '0.1ml',
          scheduled_datetime: '2026-04-18 20:00:00',
          overdue: 0,
        }],
        completedTodayDoses: [{
          log_id: 13,
          bird_id: 2,
          bird_name: 'Blue',
          case_number: 'PG-1',
          species: 'Feral Pigeon',
          medication_id: 23,
          kind: 'supplement',
          name: 'Calcium',
          dosage: 'pinch',
          scheduled_datetime: '2026-04-18 08:00:00',
          completed_datetime: '2026-04-18 08:05:00',
          overdue: 0,
        }],
      };
    },
  });
  return deps;
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function request(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  return { res, body };
}

test('/api/me returns authenticated user metadata', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/me');
    assert.equal(res.status, 200);
    assert.equal(body.authenticated, true);
    assert.equal(body.email, 'drew1618t@gmail.com');
    assert.equal(body.role, 'family');
  });
});

test('/api/portfolio returns portfolio shape', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/portfolio');
    assert.equal(res.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.companies[0].ticker, 'TEST');
    assert.deepEqual(body.holdings, [{ ticker: 'TEST', shares: 1 }]);
  });
});

test('/api/non-portfolio-companies returns watchlist candidates', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/non-portfolio-companies');
    assert.equal(res.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.companies[0].ticker, 'MOCK');
    assert.equal(body.companies[0].qualityScore, 71);
  });
});

test('/api refresh endpoints are family-only', async () => {
  const generalApp = createApp({ accessAuth: makeAuth('general'), dependencies: makeDeps() });
  await withServer(generalApp, async baseUrl => {
    const refresh = await request(baseUrl, '/api/refresh', {
      headers: { accept: 'application/json' },
    });
    assert.equal(refresh.res.status, 403);
    assert.match(refresh.body.error, /family tier/);

    const liveRefresh = await request(baseUrl, '/api/live-portfolio/refresh', {
      headers: { accept: 'application/json' },
    });
    assert.equal(liveRefresh.res.status, 403);
    assert.match(liveRefresh.body.error, /family tier/);
  });

  const familyApp = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(familyApp, async baseUrl => {
    const refresh = await request(baseUrl, '/api/refresh');
    assert.equal(refresh.res.status, 200);
    assert.equal(refresh.body.message, 'Data refreshed');

    const liveRefresh = await request(baseUrl, '/api/live-portfolio/refresh');
    assert.equal(liveRefresh.res.status, 200);
    assert.deepEqual(liveRefresh.body.stocks, []);
  });
});

test('/api/family/taxes is blocked for non-family users and allowed for family users', async () => {
  const generalApp = createApp({ accessAuth: makeAuth('general'), dependencies: makeDeps() });
  await withServer(generalApp, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/family/taxes', {
      headers: { accept: 'application/json' },
    });
    assert.equal(res.status, 403);
    assert.match(body.error, /family tier/);
  });

  const familyApp = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(familyApp, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/family/taxes');
    assert.equal(res.status, 200);
    assert.equal(body.taxYear, 2026);
  });
});

test('/writing and /family render without crashing', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const writing = await request(baseUrl, '/writing');
    assert.equal(writing.res.status, 200);
    assert.match(writing.body, /Drew's Stock Journal/);
    assert.match(writing.body, /\/css\/writing\.css/);
    assert.match(writing.body, /\/js\/writing\.js/);

    const family = await request(baseUrl, '/family');
    assert.equal(family.res.status, 200);
    assert.match(family.body, /Taylor Family Hub/);
    assert.match(family.body, /\/css\/familyHub\.css/);
    assert.match(family.body, /\/js\/familyHub\.js/);
  });
});

test('/family animals pages render and old pigeons route redirects', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeAnimalStoreDeps() });
  await withServer(app, async baseUrl => {
    const animals = await request(baseUrl, '/family/animals');
    assert.equal(animals.res.status, 200);
    assert.match(animals.body, /<title>Animals<\/title>/);
    assert.match(animals.body, /\/js\/animals\.js/);

    const pets = await request(baseUrl, '/family/animals/pets');
    assert.equal(pets.res.status, 200);
    assert.match(pets.body, /<title>Pets<\/title>/);
    assert.match(pets.body, /\/js\/pets\.js/);

    const pigeons = await request(baseUrl, '/family/animals/pigeons');
    assert.equal(pigeons.res.status, 200);
    assert.match(pigeons.body, /<title>Pigeons<\/title>/);
    assert.match(pigeons.body, /href="\/family\/animals"/);

    const oldPigeons = await request(baseUrl, '/family/pigeons');
    assert.equal(oldPigeons.res.status, 302);
    assert.equal(oldPigeons.res.headers.get('location'), '/family/animals/pigeons');
  });
});

test('/api/family/animals/summary returns combined pets and pigeons shape', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeAnimalStoreDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/api/family/animals/summary');
    assert.equal(res.status, 200);
    assert.equal(body.pets.total, 1);
    assert.equal(body.pigeons.total, 1);
    assert.equal(body.dueItems.length, 2);
    assert.equal(body.overdueCount, 1);
    assert.equal(body.completedItems.length, 1);
    assert.deepEqual(body.dueItems.map(item => item.source).sort(), ['pet', 'pigeon']);
  });
});

test('/family/animals and animals API are blocked for non-family users', async () => {
  const app = createApp({ accessAuth: makeAuth('general'), dependencies: makeAnimalStoreDeps() });
  await withServer(app, async baseUrl => {
    const page = await request(baseUrl, '/family/animals', {
      headers: { accept: 'application/json' },
    });
    assert.equal(page.res.status, 403);

    const api = await request(baseUrl, '/api/family/animals/summary', {
      headers: { accept: 'application/json' },
    });
    assert.equal(api.res.status, 403);
  });
});

test('unknown app routes fall back to dashboard html', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/unknown-dashboard-route');
    assert.equal(res.status, 200);
    assert.match(body, /Portfolio Dashboard/);
  });
});

test('home page renders authenticated family links instead of static public index', async () => {
  const app = createApp({ accessAuth: makeAuth('family'), dependencies: makeDeps() });
  await withServer(app, async baseUrl => {
    const { res, body } = await request(baseUrl, '/');
    assert.equal(res.status, 200);
    assert.match(body, /Access Tier <strong>Family<\/strong>/);
    assert.match(body, /1 company tracked/);
    assert.doesNotMatch(body, /Eleven companies tracked/);
    assert.match(body, /href="\/writing"/);
    assert.doesNotMatch(body, /id="access-role">General/);
  });
});

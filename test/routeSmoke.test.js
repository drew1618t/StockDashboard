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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('WPR In lists only new positions, while existing holdings remain visible', async () => {
  const feed = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/wpr/wpr_feed.json'), 'utf8'));
  // Pin the current slide so weekly feed publishes do not change what this test asserts.
  const holding = (ticker, weight, previous, status) => ({
    ticker, company_name: ticker, weight_pct: weight, previous_weight_pct: previous,
    change_pct: previous == null ? null : Math.round((weight - previous) * 10) / 10,
    slide_status: previous == null ? 'new_on_slide' : 'on_both_slides',
    disclosed_decision: { status, video_id: 'fixture0001' },
  });
  feed.current = {
    snapshot_date: '2026-10-11',
    previous_snapshot_date: '2026-10-04',
    reported_metrics: {},
    holdings: [
      holding('ALAB', 16.8, 16.9, 'held_no_new_thesis'),
      holding('MTSI', 5.4, 3.9, 'added'),
      holding('FPS', 1.1, null, 'new_position'),
    ],
    departed: [],
  };
  const elements = { 'wpr-app': {}, 'wpr-sub': {} };
  // Render the actual browser script with the published feed and no live portfolio.
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/wpr.js'), 'utf8'), {
    document: {
      getElementById: id => elements[id],
      querySelectorAll: () => [],
    },
    localStorage: { getItem: () => null },
    fetch: async url => ({ ok: true, json: async () => url === '/api/wpr/feed' ? feed : null }),
  });
  await new Promise(resolve => setImmediate(resolve));

  const html = elements['wpr-app'].innerHTML;
  const inBlock = html.match(/<div class="block">([\s\S]*?)(?=<div class="block">)/)[1];
  const inTickers = Array.from(inBlock.matchAll(/class="tk">([^<]+)</g), match => match[1]);
  assert.deepEqual(inTickers, ['FPS']);
  assert.match(html, /class="tk">ALAB<\/td>/);
  assert.match(html, /class="tk">MTSI<\/td>/);
  assert.match(html, /Added to[\s\S]*?class="tk">MTSI<\/span>/);
});

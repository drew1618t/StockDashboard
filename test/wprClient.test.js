const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('WPR In lists only new positions, while existing holdings remain visible', async () => {
  const feed = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/wpr/wpr_feed.json'), 'utf8'));
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

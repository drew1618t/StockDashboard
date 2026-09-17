const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { createApp } = require('../server/createApp');
const { createWprFeed } = require('../server/wprFeed');
const { renderMarkdown } = require('../server/wprMarkdown');

/** Give every request a logged-in general user, as Cloudflare Access would. */
function generalAuth(req, res, next) {
  req.user = { email: 'friend@example.org', role: 'general' };
  next();
}

/** Start an ephemeral server, run the callback against it, then close it. */
async function withServer(app, callback) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

/** Build a temporary content/wpr bundle with a feed and one report. */
function createWprFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-routes-'));
  const bundle = path.join(root, 'transcripts', '2026-09-13_gj2AlI4J6Q0');
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(path.join(bundle, 'report.md'), '# Report\n\nSee [evidence](evidence.md) and [E01].\n\n| Company | Weight |\n|---|---:|\n| SIMO | 17.7% |\n');
  fs.writeFileSync(path.join(bundle, 'transcript.md'), '# Transcript\n\nHello.');
  fs.writeFileSync(path.join(root, 'secret.md'), 'not served');

  const feed = {
    current: {
      snapshot_date: '2026-09-13',
      previous_snapshot_date: '2026-09-06',
      reported_metrics: { ytd_return_pct: 28 },
      holdings: [{ ticker: 'SIMO', company_name: 'Silicon Motion', weight_pct: 17.7, previous_weight_pct: 16.1, change_pct: 1.6, slide_status: 'on_both_slides', disclosed_decision: null }],
      departed: [],
    },
    snapshots: [],
    weekly_changes: [],
    videos: [
      {
        video_id: 'gj2AlI4J6Q0',
        date: '2026-09-13',
        title: 'Two new portfolio companies',
        url: 'https://www.youtube.com/watch?v=gj2AlI4J6Q0',
        report_path: 'transcripts/2026-09-13_gj2AlI4J6Q0/report.md',
        transcript_path: 'transcripts/2026-09-13_gj2AlI4J6Q0/transcript.md',
        evidence_path: null,
      },
      {
        video_id: 'escape00000',
        date: '2026-09-01',
        title: 'Bad path',
        url: null,
        report_path: 'transcripts/../secret.md',
        transcript_path: 'secret.md',
        evidence_path: null,
      },
    ],
  };
  fs.writeFileSync(path.join(root, 'wpr_feed.json'), JSON.stringify(feed));
  return root;
}

function makeApp(root) {
  return createApp({
    accessAuth: generalAuth,
    dependencies: { wprFeed: createWprFeed({ wprContentDir: root }) },
  });
}

test('WPR pages and feed are served to a general user', async () => {
  const root = createWprFixture();
  await withServer(makeApp(root), async baseUrl => {
    const page = await fetch(`${baseUrl}/wpr`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /wpr-app/);

    const feed = await fetch(`${baseUrl}/api/wpr/feed`);
    assert.equal(feed.status, 200);
    const body = await feed.json();
    assert.equal(body.current.holdings[0].ticker, 'SIMO');

    const videos = await fetch(`${baseUrl}/wpr/videos`);
    const videosHtml = await videos.text();
    assert.equal(videos.status, 200);
    assert.match(videosHtml, /September 2026/);
    assert.match(videosHtml, /Two new portfolio companies/);
  });
});

test('video report renders Markdown with rewritten links', async () => {
  const root = createWprFixture();
  await withServer(makeApp(root), async baseUrl => {
    const report = await fetch(`${baseUrl}/wpr/videos/gj2AlI4J6Q0`);
    assert.equal(report.status, 200);
    const html = await report.text();
    assert.match(html, /<h1>Report<\/h1>/);
    assert.match(html, /href="\/wpr\/videos\/gj2AlI4J6Q0\/evidence"/);
    assert.match(html, /href="\/wpr\/videos\/gj2AlI4J6Q0\/evidence#E01"/);
    assert.match(html, /<td class="num">17.7%<\/td>/);

    const transcript = await fetch(`${baseUrl}/wpr/videos/gj2AlI4J6Q0/transcript`);
    assert.equal(transcript.status, 200);
    assert.match(await transcript.text(), /<h1>Transcript<\/h1>/);

    // Evidence is listed as unavailable in the feed, so it must 404 rather than guess a file.
    const evidence = await fetch(`${baseUrl}/wpr/videos/gj2AlI4J6Q0/evidence`);
    assert.equal(evidence.status, 404);
  });
});

test('feed paths outside the bundle transcripts folder are refused', async () => {
  const root = createWprFixture();
  await withServer(makeApp(root), async baseUrl => {
    assert.equal((await fetch(`${baseUrl}/wpr/videos/escape00000`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/wpr/videos/escape00000/transcript`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/wpr/videos/not-a-valid-id`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/wpr/videos/unknown0000`)).status, 404);
  });
});

test('missing feed yields a helpful API error and an empty archive', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-empty-'));
  await withServer(makeApp(root), async baseUrl => {
    const feed = await fetch(`${baseUrl}/api/wpr/feed`);
    assert.equal(feed.status, 404);
    assert.match((await feed.json()).error, /publish/);
    const videos = await fetch(`${baseUrl}/wpr/videos`);
    assert.equal(videos.status, 200);
    assert.match(await videos.text(), /No videos published yet/);
  });
});

test('markdown renderer escapes HTML and drops links into WPR data folders', () => {
  const html = renderMarkdown('## Title <b>\n\nSee [slide](../../../data/raw/x.png) and **bold** `code`.\n\n> quoted\n\n- one\n- two\n', '/wpr/videos/abc');
  assert.match(html, /<h2>Title &lt;b&gt;<\/h2>/);
  assert.doesNotMatch(html, /data\/raw/);
  assert.match(html, /See slide and <strong>bold<\/strong> <code>code<\/code>\./);
  assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test('published report links preserve report routes, cross-video citations, and timestamps', () => {
  const html = renderMarkdown('[Report](report.md) [Earlier](../2026-09-06_xAvMFbo9OlI/evidence.md#E14) [Time](https://www.youtube.com/watch?v=abc&t=45s)\n\n[E01]: evidence.md#E01\n', '/wpr/videos/N_MDoqO79Z0');
  assert.match(html, /href="\/wpr\/videos\/N_MDoqO79Z0"/);
  assert.match(html, /href="\/wpr\/videos\/xAvMFbo9OlI\/evidence#E14"/);
  assert.match(html, /watch\?v=abc&amp;t=45s/);
  assert.doesNotMatch(html, /&amp;amp;|evidence\.md|\/N_MDoqO79Z0\/report/);
});

/**
 * server/wprPage.js - Server-rendered shells for the WPR section.
 *
 * Three pages share one chrome: the main positions page (rendered client-side
 * by public/js/wpr.js from /api/wpr/feed), the video archive, and one video's
 * report, transcript, or evidence register rendered from Markdown.
 */

const { escapeHtml } = require('./utils/html');
const { renderMarkdown } = require('./wprMarkdown');

/** Format an ISO date as "Sep 13, 2026" without timezone drift. */
function formatDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Wrap page content in the shared WPR chrome. */
function renderShell(title, body, options = {}) {
  const scripts = options.scripts || [];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/css/wpr.css">
</head>
<body>
  <header class="wpr-header">
    <a class="brand" href="/wpr">WPR</a>
    <nav><a href="/">Home</a><a href="/dashboard">Dashboard</a><a href="/wpr/videos">Videos</a></nav>
  </header>
  <main class="wpr-main${options.narrow ? ' wpr-main--narrow' : ''}">
${body}
  </main>
${scripts.map(src => `  <script src="${escapeHtml(src)}"></script>`).join('\n')}
</body>
</html>`;
}

/** Main positions page. The holdings block is filled in by the browser. */
function renderWprPage() {
  const body = `    <h1>This week</h1>
    <p class="sub" id="wpr-sub">Loading WPR's latest allocation slide.</p>
    <div id="wpr-app"></div>`;
  return renderShell('WPR', body, { scripts: ['/js/wpr.js'] });
}

/** Video archive page, grouped by month, newest first. */
function renderVideosPage(videos) {
  const list = Array.isArray(videos) ? videos.slice() : [];
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  let rows = '';
  let currentMonth = '';
  for (const video of list) {
    const month = String(video.date || '').slice(0, 7);
    if (month !== currentMonth) {
      currentMonth = month;
      const [year, monthNumber] = month.split('-').map(Number);
      const label = Number.isFinite(year) && Number.isFinite(monthNumber)
        ? new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        : 'Undated';
      rows += `    <div class="month">${escapeHtml(label)}</div>\n`;
    }
    const base = `/wpr/videos/${encodeURIComponent(video.video_id)}`;
    const links = [];
    if (video.report_path) links.push(`<a href="${base}">Report</a>`);
    if (video.transcript_path) links.push(`<a href="${base}/transcript">Transcript</a>`);
    if (video.url) links.push(`<a href="${escapeHtml(video.url)}" target="_blank" rel="noopener">YouTube</a>`);
    rows += `    <div class="video"><span class="d">${escapeHtml(formatDate(video.date))}</span><span>${escapeHtml(video.title || video.video_id)}</span><span class="links">${links.join('')}</span></div>\n`;
  }
  if (!rows) rows = '    <p class="sub">No videos published yet.</p>\n';

  const body = `    <h1>Videos</h1>
    <p class="sub">Reports and transcripts from WPR's channel.</p>
${rows}`;
  return renderShell('WPR videos', body);
}

/** One video's report, transcript, or evidence register. */
function renderVideoPage(video, kind, markdown) {
  const base = `/wpr/videos/${encodeURIComponent(video.video_id)}`;
  const tabs = [
    ['report', 'Report', video.report_path],
    ['transcript', 'Transcript', video.transcript_path],
    ['evidence', 'Evidence', video.evidence_path],
  ].filter(([, , available]) => available)
    .map(([key, label]) => `<a href="${base}${key === 'report' ? '' : `/${key}`}"${key === kind ? ' class="on"' : ''}>${label}</a>`);
  if (video.url) tabs.push(`<a href="${escapeHtml(video.url)}" target="_blank" rel="noopener">YouTube</a>`);

  const body = `    <p class="sub"><a href="/wpr/videos">All videos</a> · ${escapeHtml(formatDate(video.date))}</p>
    <div class="tabs">${tabs.join('')}</div>
    <article class="md">
${renderMarkdown(markdown, base)}
    </article>`;
  return renderShell(`${video.title || video.video_id} · WPR`, body, { narrow: true });
}

module.exports = { renderWprPage, renderVideosPage, renderVideoPage, formatDate };

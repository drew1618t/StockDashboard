const { escapeHtml } = require('./utils/html');
const { groupReportsByYearMonth } = require('./agentWorkReports');

function renderProjectsPage() {
  return renderShell('Projects', `
    <div class="spread">
      <aside class="mast">
        <div class="kicker">Projects &middot; 2026</div>
        <div class="rule"></div>
        <h1>A quiet <em>index</em> of ongoing work.</h1>
        <p class="stand">Build logs, archives, and experiments &mdash; gathered with intention and arranged for the family.</p>
        <div class="now-reading">
          <span class="label">Currently &mdash;</span>
          <span class="target" id="now-reading">I. Agent Work Logs</span>
        </div>
      </aside>

      <main class="idx">
        <div class="idx-head">
          <span>Index</span>
          <span>One entry</span>
        </div>

        <a href="/family/projects/agent-work" class="entry" data-name="I. Agent Work Logs">
          <div class="num">I.</div>
          <div class="body">
            <h2>Agent Work Logs</h2>
            <p>Daily, monthly, and yearly summaries of Codex and Claude work &mdash; a searchable archive of every agent-assisted session.</p>
            <div class="tags"><span>Archive</span><span>Live</span></div>
          </div>
          <div class="meta"><strong>&rarr;</strong>Open</div>
        </a>

        <div class="placeholder">More to follow.</div>
      </main>
    </div>

    <script>
      const target = document.getElementById('now-reading');
      document.querySelectorAll('.entry').forEach(el => {
        el.addEventListener('mouseenter', () => {
          target.style.opacity = '0';
          setTimeout(() => {
            target.textContent = el.dataset.name;
            target.style.opacity = '1';
          }, 150);
        });
      });
    </script>
  `);
}

function renderAgentWorkArchivePage(reports) {
  const groups = groupReportsByYearMonth(reports);
  const reportMarkup = groups.map(group => `
    <section class="year-group">
      <div class="year-head">
        <div class="year-numeral">${escapeHtml(group.year)}</div>
        <div class="year-rule"></div>
      </div>
      ${group.months.map(month => `
        <div class="month-group">
          <h3>${month.month === 'year' ? 'Yearly Summary' : escapeHtml(month.month)}</h3>
          <div class="report-grid">
            ${month.reports.map(renderReportCard).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `).join('');

  return renderShell('Agent Work Logs', `
    <div class="archive-hero">
      <aside class="mast">
        <div class="kicker">Projects &middot; I.</div>
        <div class="rule"></div>
        <h1>Agent <em>Work</em> Logs.</h1>
        <p class="stand">Daily, monthly, and yearly records of agent-assisted work &mdash; searchable by date, month, year, or report type.</p>
      </aside>

      <aside class="search-pane">
        <div class="search-head">
          <span>Search the archive</span>
          <span class="count">${reports.length} report${reports.length === 1 ? '' : 's'}</span>
        </div>
        <input class="search" id="report-search" type="search" placeholder="Search date, month, year, or report type&hellip;" autocomplete="off">
        <div class="search-foot"><a href="/family/projects">&larr; Back to Projects</a></div>
      </aside>
    </div>

    ${reports.length ? reportMarkup : '<section class="empty">No agent work reports found yet.</section>'}

    <script>
      const input = document.getElementById('report-search');
      input?.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        document.querySelectorAll('[data-report-card]').forEach(card => {
          card.hidden = query && !card.dataset.search.includes(query);
        });
      });
    </script>
  `);
}

function renderAgentWorkReportViewerPage(report) {
  return renderShell(`Agent Work Log ${report.label}`, `
    <div class="viewer-head">
      <div>
        <div class="kicker">${escapeHtml(report.type)} report</div>
        <div class="rule"></div>
        <h1>${escapeHtml(report.label)}</h1>
      </div>
      <nav class="actions">
        <a href="/family/projects/agent-work">&larr; Archive</a>
        <a href="${escapeHtml(report.rawHref)}">Open raw &rarr;</a>
      </nav>
    </div>
    <iframe class="viewer-frame" src="${escapeHtml(report.rawHref)}" title="Agent work report ${escapeHtml(report.label)}"></iframe>
  `);
}

function renderReportCard(report) {
  const title = report.type === 'daily'
    ? `Daily ${report.label}`
    : report.type === 'monthly'
      ? `Monthly ${report.label}`
      : `Yearly ${report.label}`;
  const search = `${report.type} ${report.label} ${report.year} ${report.month || ''} ${report.day || ''}`.toLowerCase();
  return `
    <a class="report-card" href="${escapeHtml(report.href)}" data-report-card data-search="${escapeHtml(search)}">
      <span class="rc-type">${escapeHtml(report.type)}</span>
      <strong class="rc-title">${escapeHtml(title)}</strong>
      <small class="rc-file">${escapeHtml(report.fileName)}</small>
    </a>
  `;
}

function renderShell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Cormorant+SC:wght@400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root{
      --paper:#F4EFE6;
      --paper-soft:#EBE4D6;
      --paper-warm:#F8F2E7;
      --ink:#1C1A17;
      --muted:#8A7F6E;
      --brass:#B89968;
      --brass-soft:#D9C7A4;
      --brass-deep:#9C7F4E;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:var(--paper);color:var(--ink);font-family:'Inter',sans-serif;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;letter-spacing:.005em}
    body{background-image:radial-gradient(ellipse at top,rgba(255,255,255,.45),transparent 55%);min-height:100vh}
    a{color:inherit;text-decoration:none}
    .top{max-width:1440px;margin:0 auto;padding:20px 56px;display:flex;justify-content:space-between;align-items:center;font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.22em;color:var(--muted);border-bottom:1px solid var(--brass-soft)}
    .top a:hover{color:var(--brass)}
    .top .dot{display:inline-block;width:4px;height:4px;background:var(--brass);border-radius:50%;margin:0 12px;vertical-align:middle}
    .top nav{display:flex;align-items:center}
    .mast .kicker{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.3em;color:var(--brass)}
    .mast .rule{width:48px;height:1px;background:var(--brass);margin:14px 0 20px}
    .mast h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:3.2rem;line-height:1.02;letter-spacing:-0.01em}
    .mast h1 em{font-style:italic;color:var(--brass)}
    .mast .stand{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;color:var(--muted);font-size:1.15rem;line-height:1.5;margin:18px 0 0;max-width:380px}
    .spread{max-width:1440px;margin:0 auto;padding:48px 56px 64px;display:grid;grid-template-columns:38% 1fr;gap:64px;min-height:calc(100vh - 110px)}
    .spread .mast{position:sticky;top:32px;align-self:start;padding-right:24px;border-right:1px solid var(--brass-soft)}
    .spread .now-reading{margin-top:32px;padding-top:20px;border-top:1px solid var(--brass-soft);font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.22em;color:var(--muted)}
    .spread .now-reading .label{display:block;margin-bottom:8px}
    .spread .now-reading .target{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:1.35rem;letter-spacing:-0.005em;color:var(--ink);text-transform:none;transition:opacity .3s ease}
    .idx{padding-top:8px}
    .idx-head{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.26em;color:var(--muted);display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--brass-soft)}
    .entry{display:grid;grid-template-columns:54px 1fr auto;gap:24px;align-items:center;padding:24px 0;border-bottom:1px solid var(--brass-soft);position:relative;transition:padding-left .3s ease}
    .entry::before{content:"";position:absolute;left:-14px;top:0;bottom:0;width:2px;background:var(--brass);transform:scaleY(0);transform-origin:top;transition:transform .35s ease}
    .entry:hover{padding-left:12px}
    .entry:hover::before{transform:scaleY(1)}
    .entry .num{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:1.6rem;color:var(--brass);letter-spacing:-0.01em}
    .entry .body h2{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.55rem;line-height:1.15;letter-spacing:-0.005em;margin-bottom:6px}
    .entry .body p{color:var(--muted);font-size:13.5px;line-height:1.5;max-width:520px}
    .entry .tags{font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.22em;color:var(--brass);margin-top:8px}
    .entry .tags span+span::before{content:"\\00B7";color:var(--muted);margin:0 8px}
    .entry .meta{text-align:right;font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.2em;color:var(--muted);white-space:nowrap}
    .entry .meta strong{display:block;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:1.35rem;letter-spacing:0;color:var(--ink);text-transform:none;margin-bottom:2px}
    .placeholder{padding:28px 0;font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--muted);font-size:1rem;text-align:center}
    .archive-hero{max-width:1440px;margin:0 auto;padding:48px 56px 32px;display:grid;grid-template-columns:1fr 380px;gap:64px;align-items:start}
    .search-pane{background:var(--paper-soft);border:1px solid var(--brass-soft);padding:24px 22px;align-self:start}
    .search-head{display:flex;justify-content:space-between;align-items:center;font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.26em;color:var(--brass);padding-bottom:14px;border-bottom:1px solid var(--brass-soft);margin-bottom:14px}
    .search-head .count{color:var(--muted)}
    .search{width:100%;padding:12px 14px;border:1px solid var(--brass-soft);background:var(--paper-warm);border-radius:0;font:inherit;font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:var(--ink);transition:border-color .2s ease}
    .search::placeholder{color:var(--muted);font-style:italic}
    .search:focus{outline:none;border-color:var(--brass)}
    .search-foot{margin-top:14px;font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.22em}
    .search-foot a{color:var(--brass)}
    .search-foot a:hover{color:var(--brass-deep)}
    .year-group{max-width:1440px;margin:0 auto;padding:32px 56px 0}
    .year-head{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;margin-bottom:24px}
    .year-numeral{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:3.2rem;line-height:1;color:var(--brass);letter-spacing:-0.01em}
    .year-rule{height:1px;background:var(--brass-soft)}
    .month-group{margin-bottom:32px}
    .month-group h3{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.28em;color:var(--muted);font-weight:400;padding-bottom:10px;border-bottom:1px solid var(--brass-soft);margin-bottom:14px}
    .report-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
    .report-card{background:var(--paper-warm);border:1px solid var(--brass-soft);padding:16px 18px;display:flex;flex-direction:column;gap:6px;transition:background .2s ease,border-color .2s ease}
    .report-card:hover{background:#FBF6EB;border-color:var(--brass)}
    .rc-type{font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.24em;color:var(--brass);text-transform:capitalize}
    .rc-title{font-family:'Cormorant Garamond',serif;font-weight:500;font-style:normal;font-size:1.15rem;letter-spacing:-0.005em;color:var(--ink)}
    .rc-file{font-family:'Inter',sans-serif;font-size:11px;color:var(--muted);overflow-wrap:anywhere;letter-spacing:0}
    .empty{max-width:1440px;margin:0 auto;padding:64px 56px;text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--muted);font-size:1.2rem}
    .viewer-head{max-width:1440px;margin:0 auto;padding:36px 56px 18px;display:flex;justify-content:space-between;align-items:flex-end;gap:32px;border-bottom:1px solid var(--brass-soft)}
    .viewer-head .kicker{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.3em;color:var(--brass);text-transform:capitalize}
    .viewer-head .rule{width:48px;height:1px;background:var(--brass);margin:12px 0 14px}
    .viewer-head h1{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:2.4rem;line-height:1;letter-spacing:-0.005em}
    .viewer-head .actions{display:flex;gap:24px;font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.22em;padding-bottom:6px}
    .viewer-head .actions a{color:var(--brass)}
    .viewer-head .actions a:hover{color:var(--brass-deep)}
    .viewer-frame{display:block;width:calc(100% - 112px);max-width:1440px;margin:24px auto 56px;min-height:78vh;border:1px solid var(--brass-soft);background:#fff}
    [hidden]{display:none !important}
    @media(max-width:1000px){
      .spread{grid-template-columns:1fr;gap:32px;padding:32px 24px}
      .spread .mast{position:static;padding-right:0;border-right:none;border-bottom:1px solid var(--brass-soft);padding-bottom:24px}
      .archive-hero{grid-template-columns:1fr;gap:32px;padding:32px 24px 24px}
      .year-group{padding:24px 24px 0}
      .top{padding:16px 24px}
      .viewer-head{flex-direction:column;align-items:flex-start;padding:24px}
      .viewer-frame{width:calc(100% - 48px)}
    }
  </style>
</head>
<body>
  <header class="top">
    <nav><a href="/">Home</a><span class="dot"></span><a href="/family">Family</a><span class="dot"></span><a href="/family/projects">Projects</a></nav>
    <div>${escapeHtml(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div>
  </header>
  ${body}
</body>
</html>`;
}

module.exports = {
  renderAgentWorkArchivePage,
  renderAgentWorkReportViewerPage,
  renderProjectsPage,
};

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
          <span>3 entries</span>
        </div>

        <a href="/projects/agent-work" class="entry" data-name="I. Agent Work Logs">
          <div class="num">I.</div>
          <div class="body">
            <h2>Agent Work Logs</h2>
            <p>Daily, monthly, and yearly summaries of Codex and Claude work &mdash; a searchable archive of every agent-assisted session.</p>
            <div class="tags"><span>Archive</span><span>Live</span></div>
          </div>
          <div class="meta"><strong>&rarr;</strong>Open</div>
        </a>

        <a href="/projects/security-system" class="entry" data-name="II. Security System">
          <div class="num">II.</div>
          <div class="body">
            <h2>Security System</h2>
            <p>Lot 23A camera planning, NVR configuration, Pi reverse proxy notes, and the current install checklist.</p>
            <div class="tags"><span>Planning</span><span>Map</span><span>NVR</span></div>
          </div>
          <div class="meta"><strong>&rarr;</strong>Status</div>
        </a>

        <a href="/projects/mosquito-trap" class="entry" data-name="III. Mosquito Trap">
          <div class="num">III.</div>
          <div class="body">
            <h2>DIY CO2 Mosquito Trap</h2>
            <p>Build plan for an outdoor CO2, lactic acid, light, and airflow mosquito trap for Serra Grande.</p>
            <div class="tags"><span>Build</span><span>Yard</span><span>Aedes</span></div>
          </div>
          <div class="meta"><strong>&rarr;</strong>Plan</div>
        </a>
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

function renderSecuritySystemPage() {
  const statusCards = [
    ['Current phase', 'Planning / configuration', 'Prototype planner, Frigate configuration, and proxy notes are drafted.'],
    ['Hardware target', 'Mini PC NVR', 'Frigate and Mosquitto on a Debian 12 Intel N100 box with VAAPI and OpenVINO.'],
    ['Pi role', 'Reverse proxy later', 'The Raspberry Pi will route protected app traffic to Frigate and go2rtc after the NVR address is final.'],
    ['Camera plan', '8 cameras', 'PoE cameras on an isolated 10.0.10.0/24 subnet, with the NVR at 10.0.10.1.'],
  ];
  const todoItems = [
    ['done', 'Draft Frigate + Mosquitto Docker Compose stack'],
    ['done', 'Lay out camera names, IPs, and detection roles'],
    ['done', 'Create yard/camera planner and tablet dashboard prototypes'],
    ['todo', 'Replace placeholder Mini PC NVR IP in the Pi nginx proxy config'],
    ['todo', 'Set real RTSP password through the NVR .env file'],
    ['todo', 'Verify Intelbras RTSP URL paths on the actual cameras'],
    ['todo', 'Mount and validate the surveillance drive at /mnt/surveillance'],
    ['todo', 'Deploy the NVR stack and confirm Frigate/go2rtc streams'],
  ];

  return renderShell('Security System', `
    <div class="project-detail">
      <div class="viewer-head project-title">
        <div>
          <div class="kicker">Projects &middot; II.</div>
          <div class="rule"></div>
          <h1>Security <em>System</em>.</h1>
          <p class="project-lead">A read-only snapshot of the Lot 23A security project: where the camera plan, NVR setup, Pi proxy, and installation checklist stand right now.</p>
        </div>
        <nav class="actions">
          <a href="/projects">&larr; Projects</a>
        </nav>
      </div>

      <section class="status-grid" aria-label="Security system status">
        ${statusCards.map(([label, value, detail]) => `
          <article class="status-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(detail)}</p>
          </article>
        `).join('')}
      </section>

      <section class="project-section">
        <div class="section-title">
          <span>Lot 23A Map</span>
          <small>Static planning view</small>
        </div>
        ${renderSecurityMap()}
      </section>

      <section class="project-section split">
        <div>
          <div class="section-title">
            <span>Checklist</span>
            <small>Manual v1 status</small>
          </div>
          <div class="checklist">
            ${todoItems.map(([state, text]) => `
              <div class="check-item ${state === 'done' ? 'is-done' : ''}">
                <span class="check-mark">${state === 'done' ? 'Done' : 'Next'}</span>
                <span>${escapeHtml(text)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <aside class="notes-panel">
          <div class="section-title">
            <span>System Shape</span>
            <small>Not live yet</small>
          </div>
          <p><strong>NVR:</strong> Frigate records, detects, and restreams camera feeds through go2rtc.</p>
          <p><strong>MQTT:</strong> Mosquitto is planned for event messaging from Frigate.</p>
          <p><strong>Pi:</strong> nginx will eventually proxy camera UI/API traffic, but live camera feeds and Frigate polling are intentionally out of this status page.</p>
        </aside>
      </section>
    </div>
  `);
}

function renderSecurityMap() {
  const cameras = [
    ['Walkway', 286, 460, 'existing'],
    ['Street Left', 208, 102, 'existing'],
    ['Street Right', 208, 102, 'existing'],
    ['Yard Left', 328, 338, 'existing'],
    ['Yard Right', 328, 338, 'existing'],
    ['Door', 256, 344, 'existing'],
    ['Gate', 122, 112, 'planned'],
    ['Backyard', 496, 460, 'planned'],
  ];
  const cameraMarkup = cameras.map(([label, x, y, kind], index) => `
    <g class="map-camera ${kind}">
      <circle cx="${x}" cy="${y}" r="${kind === 'planned' ? 8 : 6}"></circle>
      <text x="${x + 10}" y="${y - 10}">${escapeHtml(label)}</text>
      <text class="map-id" x="${x - 3}" y="${y + 4}">${index + 1}</text>
    </g>
  `).join('');

  return `
    <div class="map-wrap">
      <svg class="security-map" viewBox="40 48 680 600" role="img" aria-label="Lot 23A static camera planning map">
        <rect class="map-bg" x="40" y="48" width="680" height="600" rx="0"></rect>
        <text class="map-label" x="96" y="84">Street</text>
        <polygon class="planner-outline" points="100,120 640,120 418,600 280,480 100,480"></polygon>
        <polygon class="property-outline" points="100,120 640,120 496,600 280,480 100,480"></polygon>
        <polyline class="lot-divider" points="280,120 280,480"></polyline>
        <rect class="house" x="280" y="368" width="224" height="92"></rect>
        <text class="structure-label" x="354" y="420">House</text>
        <rect class="structure gate" x="105" y="116" width="35" height="8"></rect>
        <text class="structure-label small" x="95" y="108">Car gate</text>
        <circle class="pole" cx="208" cy="102" r="8"></circle>
        <line class="pole-line" x1="208" y1="102" x2="208" y2="120"></line>
        <text class="structure-label small" x="173" y="82">Camera pole</text>
        <rect class="structure" x="271" y="120" width="26" height="23"></rect>
        <text class="structure-label small" x="256" y="112">Pump house</text>
        <rect class="structure gate" x="380" y="116" width="11" height="8"></rect>
        <text class="structure-label small" x="368" y="108">Ped gate</text>
        <rect class="deck" x="249" y="337" width="163" height="31"></rect>
        <rect class="deck" x="249" y="368" width="31" height="58"></rect>
        <text class="structure-label small" x="253" y="330">Deck</text>
        <circle class="coverage planned" cx="122" cy="112" r="78"></circle>
        <circle class="coverage planned" cx="496" cy="460" r="76"></circle>
        <circle class="coverage" cx="208" cy="102" r="88"></circle>
        <circle class="coverage" cx="328" cy="338" r="70"></circle>
        <circle class="coverage" cx="286" cy="460" r="58"></circle>
        ${cameraMarkup}
      </svg>
      <div class="map-legend">
        <span><i class="line planned-outline"></i>Planner boundary</span>
        <span><i class="dot existing"></i>Existing mount reused</span>
        <span><i class="dot planned"></i>Planned/new camera</span>
        <span><i class="line"></i>Coverage estimate</span>
      </div>
    </div>
  `;
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
        <div class="search-foot"><a href="/projects">&larr; Back to Projects</a></div>
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
        <a href="/projects/agent-work">&larr; Archive</a>
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
    .project-detail{max-width:1440px;margin:0 auto;padding-bottom:64px}
    .project-title{align-items:flex-start}
    .project-title h1 em{font-style:italic;color:var(--brass)}
    .project-lead{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;color:var(--muted);font-size:1.15rem;line-height:1.5;margin-top:14px;max-width:680px}
    .status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:24px 56px 8px}
    .status-card{background:var(--paper-warm);border:1px solid var(--brass-soft);padding:18px 18px 20px;min-height:154px}
    .status-card span,.section-title small{display:block;font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.24em;color:var(--brass);text-transform:uppercase}
    .status-card strong{display:block;font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:500;line-height:1.05;margin:12px 0 8px;color:var(--ink)}
    .status-card p,.notes-panel p{color:var(--muted);font-size:13px;line-height:1.55}
    .project-section{padding:28px 56px 0}
    .project-section.split{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:24px;align-items:start}
    .section-title{display:flex;justify-content:space-between;align-items:end;gap:24px;padding-bottom:12px;border-bottom:1px solid var(--brass-soft);margin-bottom:14px}
    .section-title span{font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:500;line-height:1;color:var(--ink)}
    .map-wrap,.checklist,.notes-panel{background:var(--paper-soft);border:1px solid var(--brass-soft)}
    .map-wrap{padding:14px}
    .security-map{display:block;width:100%;height:auto;background:var(--paper-warm);border:1px solid var(--brass-soft)}
    .map-bg{fill:#fbf6eb}
    .planner-outline{fill:none;stroke:rgba(138,127,110,.45);stroke-width:1.5;stroke-dasharray:8 8}
    .property-outline{fill:rgba(184,153,104,.08);stroke:var(--brass-deep);stroke-width:2}
    .lot-divider{fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:7 7}
    .house{fill:rgba(28,26,23,.08);stroke:var(--ink);stroke-width:1.5}
    .structure{fill:rgba(184,153,104,.22);stroke:var(--brass-deep);stroke-width:1}
    .structure.gate{fill:rgba(28,26,23,.18)}
    .pole{fill:rgba(184,153,104,.28);stroke:var(--brass-deep);stroke-width:1.5}
    .pole-line{stroke:var(--brass-deep);stroke-width:1}
    .deck{fill:rgba(184,153,104,.16);stroke:var(--brass);stroke-width:1}
    .coverage{fill:rgba(184,153,104,.12);stroke:rgba(156,127,78,.45);stroke-width:1;stroke-dasharray:5 5}
    .coverage.planned{fill:rgba(28,26,23,.08);stroke:rgba(28,26,23,.35)}
    .map-camera circle{stroke:var(--paper-warm);stroke-width:2;fill:var(--brass-deep)}
    .map-camera.planned circle{fill:var(--ink)}
    .map-camera text{font-family:'Inter',sans-serif;font-size:12px;fill:var(--ink);letter-spacing:0}
    .map-camera .map-id{font-size:9px;fill:var(--paper-warm);font-weight:500}
    .map-label,.structure-label{font-family:'Cormorant SC',serif;font-size:12px;letter-spacing:.18em;fill:var(--muted);text-transform:uppercase}
    .structure-label.small{font-size:9px}
    .map-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;color:var(--muted);font-size:12px}
    .map-legend span{display:inline-flex;align-items:center;gap:7px}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--brass-deep);display:inline-block}
    .dot.planned{background:var(--ink)}
    .line{width:18px;border-top:1px dashed var(--brass-deep);display:inline-block}
    .line.planned-outline{border-color:var(--muted)}
    .checklist{padding:8px 18px}
    .check-item{display:grid;grid-template-columns:54px 1fr;gap:14px;align-items:start;padding:13px 0;border-bottom:1px solid var(--brass-soft);color:var(--ink)}
    .check-item:last-child{border-bottom:none}
    .check-mark{font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.22em;color:var(--muted)}
    .check-item.is-done .check-mark{color:var(--brass-deep)}
    .notes-panel{padding:18px}
    .notes-panel p+p{margin-top:12px}
    .notes-panel strong{color:var(--ink);font-weight:500}
    [hidden]{display:none !important}
    @media(max-width:1000px){
      .spread{grid-template-columns:1fr;gap:32px;padding:32px 24px}
      .spread .mast{position:static;padding-right:0;border-right:none;border-bottom:1px solid var(--brass-soft);padding-bottom:24px}
      .archive-hero{grid-template-columns:1fr;gap:32px;padding:32px 24px 24px}
      .year-group{padding:24px 24px 0}
      .top{padding:16px 24px}
      .viewer-head{flex-direction:column;align-items:flex-start;padding:24px}
      .viewer-frame{width:calc(100% - 48px)}
      .status-grid{grid-template-columns:1fr 1fr;padding:24px}
      .project-section{padding:24px 24px 0}
      .project-section.split{grid-template-columns:1fr}
    }
    @media(max-width:640px){
      .entry{grid-template-columns:44px 1fr;gap:14px}
      .entry .meta{grid-column:2;text-align:left}
      .status-grid{grid-template-columns:1fr}
      .section-title{display:block}
      .section-title small{margin-top:6px}
      .map-legend{display:grid;gap:8px}
    }
  </style>
</head>
<body>
  <header class="top">
    <nav><a href="/">Home</a><span class="dot"></span><a href="/family">Family</a><span class="dot"></span><a href="/projects">Projects</a></nav>
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
  renderSecuritySystemPage,
};

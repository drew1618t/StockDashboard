const { escapeHtml } = require('./utils/html');
const { groupReportsByYearMonth } = require('./agentWorkReports');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
            <p>Daily, weekly, monthly, and yearly summaries of Codex and Claude work &mdash; a searchable archive of every agent-assisted session.</p>
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

function reportTitle(report) {
  return report.type === 'daily'
    ? `Daily ${report.label}`
    : report.type === 'weekly'
      ? `Weekly ${report.label}`
      : report.type === 'monthly'
        ? `Monthly ${report.label}`
        : `Yearly ${report.label}`;
}

function shortMonth(month) {
  return MONTH_NAMES[Number(month) - 1].slice(0, 3);
}

function shelfWhenLabel(report) {
  if (report.type === 'daily') {
    return `${shortMonth(report.month)} ${Number(report.day)}, ${report.year}`;
  }
  if (report.type === 'weekly') {
    const sameMonth = report.month === report.endMonth && report.year === report.endYear;
    return sameMonth
      ? `${shortMonth(report.month)} ${Number(report.day)} &ndash; ${Number(report.endDay)}`
      : `${shortMonth(report.month)} ${Number(report.day)} &ndash; ${shortMonth(report.endMonth)} ${Number(report.endDay)}`;
  }
  if (report.type === 'monthly') {
    return `${MONTH_NAMES[Number(report.month) - 1]} ${report.year}`;
  }
  return report.year;
}

function reportEndDate(report) {
  if (report.type === 'daily') return Date.UTC(+report.year, +report.month - 1, +report.day);
  if (report.type === 'weekly') return Date.UTC(+report.endYear, +report.endMonth - 1, +report.endDay);
  if (report.type === 'monthly') return Date.UTC(+report.year, +report.month, 0);
  return Date.UTC(+report.year, 11, 31);
}

function agoLabel(report, now) {
  const diff = Math.floor((now - reportEndDate(report)) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return 'last week';
  if (diff < 30) return `${Math.round(diff / 7)} weeks ago`;
  if (diff < 60) return 'last month';
  if (diff < 365) return `${Math.round(diff / 30)} months ago`;
  if (diff < 730) return 'last year';
  return `${Math.round(diff / 365)} years ago`;
}

function renderLatestShelf(reports, now) {
  const latestByType = {};
  for (const report of reports) {
    if (!latestByType[report.type]) latestByType[report.type] = report;
  }
  const cards = ['daily', 'weekly', 'monthly', 'yearly']
    .filter(type => latestByType[type])
    .map(type => {
      const report = latestByType[type];
      return `
        <a href="${escapeHtml(report.href)}" class="shelf-card">
          <span class="corner tl"></span><span class="corner br"></span>
          <div class="type">${escapeHtml(type)}</div>
          <div class="when">${shelfWhenLabel(report)}</div>
          <div class="ago">${escapeHtml(agoLabel(report, now))}</div>
        </a>
      `;
    });
  if (!cards.length) return '';
  return `
    <section class="shelf">
      <div class="shelf-head"><span>Most Recent</span><span>One of each</span></div>
      <div class="shelf-grid">${cards.join('')}</div>
    </section>
  `;
}

function renderCalendarPane(reports, now) {
  const months = new Map();
  for (const report of reports) {
    if (report.type !== 'daily') continue;
    const key = `${report.year}-${report.month}`;
    if (!months.has(key)) months.set(key, new Map());
    months.get(key).set(Number(report.day), report.href);
  }
  if (!months.size) {
    return `
      <aside class="cal-pane">
        <div class="pane-head"><span>Calendar</span></div>
        <p class="cal-empty">No daily logs yet.</p>
      </aside>
    `;
  }

  const today = new Date(now);
  const todayKey = {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
    day: today.getUTCDate(),
  };

  const keys = [...months.keys()].sort().reverse();
  const blocks = keys.map((key, index) => {
    const [year, month] = key.split('-').map(Number);
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    return `
      <div class="mc-block" data-cal-block data-label="${escapeHtml(label)}"${index === 0 ? '' : ' hidden'}>
        <div class="mc-dow"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        ${renderCalendarWeeks(year, month, months.get(key), todayKey)}
      </div>
    `;
  });

  const firstKey = keys[0].split('-').map(Number);
  return `
    <aside class="cal-pane">
      <div class="pane-head">
        <span id="cal-label">${escapeHtml(`${MONTH_NAMES[firstKey[1] - 1]} ${firstKey[0]}`)}</span>
        <span class="mc-nav"><span id="cal-prev" title="earlier">&larr;</span><span id="cal-next" title="later">&rarr;</span></span>
      </div>
      ${blocks.join('')}
    </aside>
  `;
}

function renderCalendarWeeks(year, month, days, todayKey) {
  const startDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<span class="mc-day blank"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const href = days.get(day);
    const isToday = todayKey.year === year && todayKey.month === month && todayKey.day === day;
    const todayClass = isToday ? ' today' : '';
    if (href) {
      cells.push(`<a class="mc-day has${todayClass}" href="${escapeHtml(href)}">${day}</a>`);
    } else {
      cells.push(`<span class="mc-day${todayClass}">${day}</span>`);
    }
  }
  while (cells.length % 7) cells.push('<span class="mc-day blank"></span>');
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(`<div class="mc-week">${cells.slice(i, i + 7).join('')}</div>`);
  }
  return weeks.join('');
}

function renderMonthGroup(month) {
  const heading = month.month === 'year' ? 'Yearly Summary' : MONTH_NAMES[Number(month.month) - 1];
  const dailies = month.reports.filter(report => report.type === 'daily');
  const others = month.reports.filter(report => report.type !== 'daily');
  const othersMarkup = others.length
    ? `<div class="report-grid">${others.map(renderReportCard).join('')}</div>`
    : '';
  const dailiesMarkup = dailies.length
    ? `
      <button class="daily-toggle" data-daily-toggle onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        <span>Show ${dailies.length} daily log${dailies.length === 1 ? '' : 's'}</span><span class="chev">&rarr;</span>
      </button>
      <div class="daily-wrap" data-daily-wrap>
        <div class="report-grid">${dailies.map(renderReportCard).join('')}</div>
      </div>
    `
    : '';
  return `
    <div class="month-group">
      <h3>${escapeHtml(heading)}</h3>
      ${othersMarkup}
      ${dailiesMarkup}
    </div>
  `;
}

function renderAgentWorkArchivePage(reports) {
  const now = Date.now();
  const groups = groupReportsByYearMonth(reports);
  const reportMarkup = groups.map(group => `
    <section class="year-group">
      <div class="year-head">
        <div class="year-numeral">${escapeHtml(group.year)}</div>
        <div class="year-rule"></div>
      </div>
      ${group.months.map(month => renderMonthGroup(month)).join('')}
    </section>
  `).join('');

  return renderShell('Agent Work Logs', `
    <div class="archive-hero">
      <aside class="mast">
        <div class="kicker">Projects &middot; I.</div>
        <div class="rule"></div>
        <h1>Agent <em>Work</em> Logs.</h1>
        <p class="stand">Daily, weekly, monthly, and yearly records of agent-assisted work.</p>
      </aside>

      <aside class="search-pane">
        <div class="search-head">
          <span>Search the archive</span>
          <span class="count">${reports.length} report${reports.length === 1 ? '' : 's'}</span>
        </div>
        <input class="search" id="report-search" type="search" placeholder="Search date, month, year, or report type&hellip;" autocomplete="off">
        <div class="tabs" id="type-tabs">
          <button class="tab active" data-type="all">All</button>
          <button class="tab" data-type="daily">Daily</button>
          <button class="tab" data-type="weekly">Weekly</button>
          <button class="tab" data-type="monthly">Monthly</button>
          <button class="tab" data-type="yearly">Yearly</button>
        </div>
        <div class="search-foot"><a href="/projects">&larr; Back to Projects</a></div>
      </aside>

      ${renderCalendarPane(reports, now)}
    </div>

    ${renderLatestShelf(reports, now)}

    ${reports.length ? reportMarkup : '<section class="empty">No agent work reports found yet.</section>'}

    <script>
      const input = document.getElementById('report-search');
      const tabs = document.querySelectorAll('#type-tabs .tab');
      let activeType = 'all';

      function applyFilters() {
        const query = input ? input.value.trim().toLowerCase() : '';
        document.querySelectorAll('[data-report-card]').forEach(card => {
          const typeOk = activeType === 'all' || card.dataset.type === activeType;
          const queryOk = !query || card.dataset.search.includes(query);
          card.hidden = !(typeOk && queryOk);
        });
        document.querySelectorAll('[data-daily-wrap]').forEach(wrap => {
          wrap.classList.toggle('open', activeType === 'daily' || query.length > 0);
        });
        document.querySelectorAll('[data-daily-toggle]').forEach(btn => {
          btn.style.display = ((activeType === 'all' || activeType === 'daily') && !query) ? '' : 'none';
          btn.classList.toggle('open', activeType === 'daily');
        });
      }

      input?.addEventListener('input', applyFilters);
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          activeType = tab.dataset.type;
          applyFilters();
        });
      });

      const calBlocks = [...document.querySelectorAll('[data-cal-block]')];
      const calLabel = document.getElementById('cal-label');
      const calPrev = document.getElementById('cal-prev');
      const calNext = document.getElementById('cal-next');
      let calIdx = 0;
      function showCal(i) {
        calIdx = i;
        calBlocks.forEach((block, j) => { block.hidden = j !== i; });
        if (calLabel) calLabel.textContent = calBlocks[i].dataset.label;
        if (calPrev) calPrev.style.opacity = i === calBlocks.length - 1 ? '.3' : '1';
        if (calNext) calNext.style.opacity = i === 0 ? '.3' : '1';
      }
      calPrev?.addEventListener('click', () => { if (calIdx < calBlocks.length - 1) showCal(calIdx + 1); });
      calNext?.addEventListener('click', () => { if (calIdx > 0) showCal(calIdx - 1); });
      if (calBlocks.length) showCal(0);
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
  const search = `${report.type} ${report.label} ${report.year} ${report.month || ''} ${report.day || ''}`.toLowerCase();
  return `
    <a class="report-card" href="${escapeHtml(report.href)}" data-report-card data-type="${escapeHtml(report.type)}" data-search="${escapeHtml(search)}">
      <span class="rc-type">${escapeHtml(report.type)}</span>
      <strong class="rc-title">${escapeHtml(reportTitle(report))}</strong>
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
    .archive-hero{max-width:1440px;margin:0 auto;padding:48px 56px 24px;display:grid;grid-template-columns:1fr 340px 280px;gap:48px;align-items:start}
    .search-pane,.cal-pane{background:var(--paper-soft);border:1px solid var(--brass-soft);padding:24px 22px;align-self:start}
    .search-head,.pane-head{display:flex;justify-content:space-between;align-items:center;font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.26em;color:var(--brass);padding-bottom:14px;border-bottom:1px solid var(--brass-soft);margin-bottom:14px}
    .search-head .count{color:var(--muted)}
    .search{width:100%;padding:12px 14px;border:1px solid var(--brass-soft);background:var(--paper-warm);border-radius:0;font:inherit;font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:var(--ink);transition:border-color .2s ease}
    .search::placeholder{color:var(--muted);font-style:italic}
    .search:focus{outline:none;border-color:var(--brass)}
    .search-foot{margin-top:14px;font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.22em}
    .search-foot a{color:var(--brass)}
    .search-foot a:hover{color:var(--brass-deep)}
    .tabs{display:flex;gap:4px;margin-top:14px;flex-wrap:wrap}
    .tab{font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.2em;color:var(--muted);padding:7px 12px;border:1px solid transparent;background:none;cursor:pointer;transition:all .2s}
    .tab:hover{color:var(--brass-deep)}
    .tab.active{color:var(--brass-deep);border-color:var(--brass);background:var(--paper-warm)}
    .mc-nav{display:flex;gap:10px}
    .mc-nav span{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--brass-deep);cursor:pointer;font-size:1rem;line-height:1;letter-spacing:0;user-select:none}
    .mc-nav span:hover{color:var(--ink)}
    .mc-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-family:'Cormorant SC',serif;font-size:8.5px;letter-spacing:.08em;color:var(--muted);text-align:center;margin-bottom:3px}
    .mc-week{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}
    .mc-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:10.5px;color:var(--muted);background:var(--paper-warm)}
    .mc-day.has{background:var(--brass-soft);color:var(--ink);font-weight:500;transition:all .15s}
    .mc-day.has:hover{background:var(--brass);color:#fff}
    .mc-day.blank{background:none}
    .mc-day.today{outline:1px solid var(--brass-deep);outline-offset:-1px}
    .cal-empty{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--muted)}
    .shelf{max-width:1440px;margin:0 auto;padding:8px 56px}
    .shelf-head{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.26em;color:var(--muted);display:flex;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--brass-soft);margin-bottom:16px}
    .shelf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .shelf-card{position:relative;background:var(--paper-warm);border:1px solid var(--brass-soft);padding:20px;transition:all .25s}
    .shelf-card:hover{background:#FBF6EB;border-color:var(--brass)}
    .shelf-card .corner{position:absolute;width:12px;height:12px;border:1.5px solid var(--brass);transition:all .3s}
    .shelf-card .tl{top:-1px;left:-1px;border-right:none;border-bottom:none}
    .shelf-card .br{bottom:-1px;right:-1px;border-left:none;border-top:none}
    .shelf-card:hover .corner{width:18px;height:18px;border-color:var(--brass-deep)}
    .shelf-card .type{font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.24em;color:var(--brass);text-transform:capitalize}
    .shelf-card .when{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:1.35rem;margin-top:6px}
    .shelf-card .ago{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;color:var(--muted);font-size:.95rem;margin-top:2px}
    .year-group{max-width:1440px;margin:0 auto;padding:28px 56px 0}
    .year-head{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;margin-bottom:20px}
    .year-numeral{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:3.2rem;line-height:1;color:var(--brass);letter-spacing:-0.01em}
    .year-rule{height:1px;background:var(--brass-soft)}
    .month-group{margin-bottom:26px}
    .month-group h3{font-family:'Cormorant SC',serif;font-size:11px;letter-spacing:.28em;color:var(--muted);font-weight:400;padding-bottom:10px;border-bottom:1px solid var(--brass-soft);margin-bottom:14px}
    .report-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
    .report-card{background:var(--paper-warm);border:1px solid var(--brass-soft);padding:16px 18px;display:flex;flex-direction:column;gap:6px;transition:background .2s ease,border-color .2s ease}
    .report-card:hover{background:#FBF6EB;border-color:var(--brass)}
    .rc-type{font-family:'Cormorant SC',serif;font-size:10px;letter-spacing:.24em;color:var(--brass);text-transform:capitalize}
    .rc-title{font-family:'Cormorant Garamond',serif;font-weight:500;font-style:normal;font-size:1.15rem;letter-spacing:-0.005em;color:var(--ink)}
    .rc-file{font-family:'Inter',sans-serif;font-size:11px;color:var(--muted);overflow-wrap:anywhere;letter-spacing:0}
    .daily-toggle{font-family:'Cormorant SC',serif;font-size:10.5px;letter-spacing:.22em;color:var(--brass-deep);background:none;border:1px solid var(--brass-soft);padding:10px 16px;cursor:pointer;width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center;margin-top:12px;transition:border-color .2s ease,background .2s ease}
    .daily-toggle:hover{border-color:var(--brass);background:var(--paper-warm)}
    .daily-toggle .chev{font-family:'Cormorant Garamond',serif;font-style:italic;transition:transform .25s}
    .daily-toggle.open .chev{transform:rotate(90deg)}
    .daily-wrap{display:none;margin-top:12px}
    .daily-wrap.open{display:block}
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
    @media(max-width:1180px){
      .archive-hero{grid-template-columns:1fr 1fr;gap:32px}
      .archive-hero .mast{grid-column:1/-1}
    }
    @media(max-width:1000px){
      .spread{grid-template-columns:1fr;gap:32px;padding:32px 24px}
      .spread .mast{position:static;padding-right:0;border-right:none;border-bottom:1px solid var(--brass-soft);padding-bottom:24px}
      .archive-hero{padding:32px 24px 16px}
      .shelf{padding:8px 24px}
      .shelf-grid{grid-template-columns:repeat(2,1fr)}
      .year-group{padding:24px 24px 0}
      .top{padding:16px 24px}
      .viewer-head{flex-direction:column;align-items:flex-start;padding:24px}
      .viewer-frame{width:calc(100% - 48px)}
      .status-grid{grid-template-columns:1fr 1fr;padding:24px}
      .project-section{padding:24px 24px 0}
      .project-section.split{grid-template-columns:1fr}
    }
    @media(max-width:680px){
      .archive-hero{grid-template-columns:1fr}
      .archive-hero .mast{grid-column:auto}
    }
    @media(max-width:640px){
      .entry{grid-template-columns:44px 1fr;gap:14px}
      .entry .meta{grid-column:2;text-align:left}
      .shelf-grid{grid-template-columns:1fr 1fr}
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

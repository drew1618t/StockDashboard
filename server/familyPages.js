const {
  renderPersonHealthPage: renderPersonHealthPageView,
  renderPersonHealthSectionPage: renderPersonHealthSectionPageView,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
} = require('./healthPageViews');
const { escapeHtml } = require('./utils/html');

function renderHubHealthCard(summary) {
  if (!summary) return '';
  return `<a class="health-person" href="/family/health/${escapeHtml(summary.slug)}">
            <div class="person-name">
              <span class="person-initial">${escapeHtml(summary.name.slice(0, 1))}</span> ${escapeHtml(summary.name)}
            </div>
            <div class="health-icon-wrap" aria-hidden="true">
              <div class="health-icon">
                <svg viewBox="0 0 64 64" role="presentation" focusable="false">
                  <path class="health-icon-heart" d="M32 54c-1.4 0-2.7-.5-3.8-1.4C18.5 44.7 10 36.8 10 26.9 10 19.8 15.7 14 22.8 14c3.7 0 7.2 1.7 9.2 4.5 2-2.8 5.5-4.5 9.2-4.5C48.3 14 54 19.8 54 26.9c0 9.9-8.5 17.8-18.2 25.7-1.1.9-2.4 1.4-3.8 1.4Z"/>
                  <path class="health-icon-cross" d="M35.5 23.5v7h7v3h-7v7h-3v-7h-7v-3h7v-7h3Z"/>
                </svg>
              </div>
            </div>
            <div class="health-cta">Open ${escapeHtml(summary.name)}'s Health</div>
          </a>`;
}

function emailToName(email) {
  if (!email) return 'Andrew & Kaili';
  const prefix = email.split('@')[0].toLowerCase();
  if (prefix.startsWith('drew') || prefix.startsWith('andrew')) return 'Andrew';
  if (prefix.startsWith('kaili')) return 'Kaili';
  return prefix.slice(0, 1).toUpperCase() + prefix.slice(1);
}

function renderFamilyHubPage(healthSummaries = {}, healthHubData = {}, user = null) {
  const andrewCard = renderHubHealthCard(healthSummaries.andrew || {
    slug: 'andrew',
    name: 'Andrew',
  });
  const kailiCard = renderHubHealthCard(healthSummaries.kaili || {
    slug: 'kaili',
    name: 'Kaili',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Taylor Family Hub</title>
  <script>
    (function() {
      var bs = localStorage.getItem('family-bento-scheme');
      if (!bs) bs = 'peach';
      document.documentElement.setAttribute('data-bento', bs);
    })();
  </script>
  <link rel="stylesheet" href="/css/familyHub.css?v=1">
</head>
<body>
  <!-- Color Scheme Picker -->
  <div class="bento-palette">
    <span class="palette-label">Palette</span>
    <div class="bento-swatch" data-scheme="peach" title="Peach & Indigo" onclick="switchScheme('peach')"></div>
    <div class="bento-swatch" data-scheme="sage" title="Sage & Rose" onclick="switchScheme('sage')"></div>
    <div class="bento-swatch" data-scheme="midnight" title="Midnight & Gold" onclick="switchScheme('midnight')"></div>
    <div class="bento-swatch" data-scheme="nordic" title="Nordic" onclick="switchScheme('nordic')"></div>
  </div>

  <div class="hub-wrap" data-user-name="${escapeHtml(emailToName(user?.email))}">
    <!-- Navigation -->
    <nav class="hub-nav">
      <a href="/">Home</a>
      <a href="/dashboard">Stock Dashboard</a>
      <a href="/family/animals">Animals</a>
    </nav>

    <!-- Greeting -->
    <div class="hub-greeting">
      <span id="greeting-text">Good evening, ${escapeHtml(emailToName(user?.email))}.</span>
      <span class="greeting-sub" id="greeting-sub"></span>
    </div>

    <!-- Main Grid -->
    <main class="hub-grid">

      <!-- CAMERAS -->
      <section class="hub-cameras panel">
        <div class="panel-label">Cameras</div>
        <div class="cam-grid">
          <div class="cam-feed">
            <div class="cam-status"></div>
            <span class="cam-icon">&#9706;</span>
            <span class="cam-name">Front Door</span>
          </div>
          <div class="cam-feed">
            <div class="cam-status"></div>
            <span class="cam-icon">&#9706;</span>
            <span class="cam-name">Backyard</span>
          </div>
          <div class="cam-feed">
            <div class="cam-status"></div>
            <span class="cam-icon">&#9706;</span>
            <span class="cam-name">Garage</span>
          </div>
        </div>
      </section>

      <!-- HEALTH / MEDICAL -->
      <section class="hub-health panel">
        <div class="panel-label">Health</div>
        <div class="health-grid">
          ${andrewCard}
          ${kailiCard}
        </div>
      </section>

      <!-- ANIMALS -->
      <section class="hub-animals panel">
        <div class="panel-label">Animals <span style="opacity:0.45; font-weight:400; margin-left:8px; font-size:10px;" id="animal-med-count"></span></div>
        <a class="animal-hub-card" href="/family/animals">
          <div>
            <strong>Medication Check</strong>
            <span>Pets and pigeons due today</span>
          </div>
          <div class="animal-hub-count" id="animal-due-count">--</div>
        </a>
        <div class="animal-hub-links">
          <a href="/family/animals/pets">Pets</a>
          <a href="/family/animals/pigeons">Pigeons</a>
        </div>
      </section>

      <!-- TODOS -->
      <section class="hub-todos panel">
        <div class="panel-label">Todos <span style="opacity:0.4; font-weight:400; margin-left:8px; font-size:10px;" id="todo-count"></span></div>
        <div class="todo-sections" id="todo-sections"></div>
        <div class="todo-add">
          <input type="text" id="todo-input" placeholder="Add a task..." />
          <select id="todo-section">
            <option value="Short Term">Short Term</option>
            <option value="Long Term">Long Term</option>
          </select>
          <select id="todo-category" style="display:none;">
          </select>
          <select id="todo-assignee">
            <option value="">--</option>
            <option value="A">A</option>
            <option value="K">K</option>
          </select>
          <button onclick="addTodo()">Add</button>
        </div>
      </section>

      <!-- SHARED NOTES / PINBOARD -->
      <section class="hub-notes panel">
        <div class="panel-label">Pinboard</div>
        <div class="notes-list" id="pinboard-list">
          <div class="notes-empty">Loading pinboard...</div>
        </div>
        <div class="note-add">
          <textarea id="pinboard-input" placeholder="Add something for the family..."></textarea>
          <div class="note-add-controls">
            <select id="pinboard-author">
              <option value="Andrew">Andrew</option>
              <option value="Kaili">Kaili</option>
            </select>
            <button onclick="addPinboardNote()">Add New</button>
          </div>
        </div>
      </section>

    </main>

  </div>

  <script src="/js/familyHub.js?v=1"></script>
</body>
</html>`;
}

function renderFamilyLayout(title, description, cards = []) {
  const cardMarkup = cards.map(card => `
      <${card.href ? 'a' : 'article'} class="card"${card.href ? ` href="${card.href}" style="text-decoration:none; color:inherit;"` : ''}>
        <h2>${card.title}</h2>
        <p>${card.description}</p>
      </${card.href ? 'a' : 'article'}>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0f1c30;
      --panel-border: rgba(255, 255, 255, 0.08);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #7dd3fc;
      --accent-2: #f97316;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(125, 211, 252, 0.12), transparent 32%),
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 28%),
        linear-gradient(180deg, #040b16, var(--bg));
    }
    main {
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(2rem, 5vw, 3.5rem);
      line-height: 1;
    }
    .lead {
      max-width: 720px;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 28px;
    }
    .links a {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 0 16px;
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--panel-border);
      border-radius: 999px;
      text-decoration: none;
    }
    .links a.primary {
      background: linear-gradient(90deg, rgba(125, 211, 252, 0.16), rgba(249, 115, 22, 0.18));
      border-color: rgba(125, 211, 252, 0.28);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .card {
      min-height: 180px;
      padding: 22px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
      border: 1px solid var(--panel-border);
      backdrop-filter: blur(8px);
    }
    .card h2 {
      margin: 0 0 10px;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }
    .card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    @media (max-width: 640px) {
      main { padding-top: 32px; }
      .links a { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Family Tier</div>
    <h1>${title}</h1>
    <p class="lead">${description}</p>
    <div class="links">
      <a class="primary" href="/family">Family Hub</a>
      <a href="/family/health">Health</a>
      <a href="/family/todos">ToDos</a>
      <a href="/family/cameras">Cameras</a>
      <a href="/">Home</a>
    </div>
    <section class="grid">${cardMarkup}</section>
  </main>
</body>
</html>`;
}

function renderFamilySectionPage(title, description) {
  return renderFamilyLayout(title, description, [
    {
      title: 'Protected Placeholder',
      description: 'The route boundary and authorization are live. This page is ready for the actual feature implementation.',
    },
  ]);
}

function renderFamilyHealthChooserPage() {
  return renderFamilyLayout('Family Health', 'Choose whose health dashboard you want to open.', [
    {
      title: 'Andrew',
      description: 'Open Andrew health notes, appointments, and reference documents.',
      href: '/family/health/andrew',
    },
    {
      title: 'Kaili',
      description: 'Open Kaili health notes, appointments, and reference documents.',
      href: '/family/health/kaili',
    },
  ]);
}

module.exports = {
  renderFamilyHubPage,
  renderFamilySectionPage,
  renderFamilyHealthChooserPage,
  renderPersonHealthPage: renderPersonHealthPageView,
  renderPersonHealthSectionPage: renderPersonHealthSectionPageView,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
};

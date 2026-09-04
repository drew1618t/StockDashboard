const {
  renderPersonHealthPage: renderPersonHealthPageView,
  renderPersonHealthSectionPage: renderPersonHealthSectionPageView,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
} = require('./healthPageViews');
const { escapeHtml } = require('./utils/html');

const HEART_MARK = `<svg viewBox="0 0 64 64" role="presentation" focusable="false" aria-hidden="true">
              <path class="heart" d="M32 54c-1.4 0-2.7-.5-3.8-1.4C18.5 44.7 10 36.8 10 26.9 10 19.8 15.7 14 22.8 14c3.7 0 7.2 1.7 9.2 4.5 2-2.8 5.5-4.5 9.2-4.5C48.3 14 54 19.8 54 26.9c0 9.9-8.5 17.8-18.2 25.7-1.1.9-2.4 1.4-3.8 1.4Z"/>
              <path class="cross" d="M35.5 23.5v7h7v3h-7v7h-3v-7h-7v-3h7v-7h3Z"/>
            </svg>`;

// Map a login email to the family member's display name.
function emailToName(email) {
  if (!email) return 'Andrew & Kaili';
  const prefix = email.split('@')[0].toLowerCase();
  if (prefix.startsWith('drew') || prefix.startsWith('andrew')) return 'Andrew';
  if (prefix.startsWith('kaili')) return 'Kaili';
  return prefix.slice(0, 1).toUpperCase() + prefix.slice(1);
}

// The two people the hub is built around. `key` matches the todo assignee letters.
function personFor(name) {
  return name === 'Kaili'
    ? { slug: 'kaili', name: 'Kaili', key: 'K' }
    : { slug: 'andrew', name: 'Andrew', key: 'A' };
}

// One person's column: name, health link, and a container the browser script fills with their tasks.
function renderPersonColumn(person, role, greetWord) {
  const isMe = role === 'me';
  return `<div class="person-col ${role}" data-who="${person.key}">
        <div class="person-head ${role}${isMe ? ' on' : ''}" data-who="${person.key}">
          <div class="greet"${isMe ? ' id="greet-word"' : ''}>${escapeHtml(greetWord)}</div>
          <div class="name">${escapeHtml(person.name)}</div>
          <div class="under"></div>
          <a class="health" href="/family/health/${escapeHtml(person.slug)}">
            ${HEART_MARK}
            <div><b>Health</b><span>Notes, appointments, imaging, records</span></div>
          </a>
        </div>
        <div class="person-tasks ${role}${isMe ? ' on' : ''}" id="tasks-${person.key}" data-who="${person.key}">
          <div class="tasks-empty">Loading...</div>
        </div>
      </div>`;
}

// Family hub: the signed-in person on the left, shared household items in the spine, the other person on the right.
// On phones the same markup reflows into a single sheet (see public/css/familyHub.css).
function renderFamilyHubPage(healthSummaries = {}, healthHubData = {}, user = null) {
  const me = personFor(emailToName(user?.email));
  const them = me.key === 'A' ? personFor('Kaili') : personFor('Andrew');
  const meName = (healthSummaries[me.slug] && healthSummaries[me.slug].name) || me.name;
  const themName = (healthSummaries[them.slug] && healthSummaries[them.slug].name) || them.name;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Taylor Family Hub</title>
  <link rel="stylesheet" href="/css/familyHub.css?v=2">
</head>
<body>
<div class="wrap" data-user-name="${escapeHtml(meName)}" data-me="${me.key}" data-them="${them.key}" data-them-name="${escapeHtml(themName)}">
  <div class="top">
    <span class="brand">Taylor Family Hub</span>
    <nav>
      <a href="/">Home</a>
      <a href="/dashboard">Stock Dashboard</a>
      <a href="/dashboard#private">Investments</a>
      <a href="/projects">Projects</a>
      <a href="/family/animals">Animals</a>
    </nav>
    <span class="date" id="top-date"></span>
  </div>

  <!-- Phone only. On desktop the greeting lives in the signed-in person's column. -->
  <header class="masthead">
    <div class="dateline" id="dateline"></div>
    <h1 id="greeting-text">Good evening, ${escapeHtml(meName)}.</h1>
    <p class="strip">
      <a href="#" data-go="today" id="strip-animals"></a>
      <a href="#" data-go="tasks" id="strip-tasks"></a>
      <a href="#" data-go="board" id="strip-board"></a>
    </p>
  </header>

  <div class="eyebrow today"><span class="no">01</span> Today <span class="sp">Animals and cameras</span></div>
  <div class="eyebrow tasks"><span class="no">02</span> Tasks <span class="sp">Tap a name</span></div>
  <div class="eyebrow board"><span class="no">03</span> Pinboard</div>

  <div class="cols">
      ${renderPersonColumn({ ...me, name: meName }, 'me', 'Good evening')}

      <div class="spine">
        <div class="blk animals">
          <div class="h">Animals <b id="animal-med-count"></b></div>
          <a class="due" href="/family/animals">
            <span class="n" id="animal-due-count">--</span>
            <p>meds due today<small>open the medication check</small></p>
          </a>
          <div id="animal-due-list"></div>
          <div class="links"><a href="/family/animals/pets">Pets</a><a href="/family/animals/pigeons">Pigeons</a></div>
        </div>

        <div class="blk pinboard">
          <div class="h">Pinboard <b id="pinboard-count"></b></div>
          <div id="pinboard-list"><div class="notes-empty">Loading pinboard...</div></div>
          <form class="pinadd" onsubmit="addPinboardNote(); return false;">
            <textarea id="pinboard-input" placeholder="Add something for the family..."></textarea>
            <div class="r">
              <select id="pinboard-author">
                <option value="Andrew"${me.key === 'A' ? ' selected' : ''}>Andrew</option>
                <option value="Kaili"${me.key === 'K' ? ' selected' : ''}>Kaili</option>
              </select>
              <button type="submit">Pin</button>
            </div>
          </form>
        </div>

        <div class="blk unassigned" id="unassigned-blk" hidden>
          <div class="h">Unassigned <b id="unassigned-count"></b></div>
          <div id="tasks-none"></div>
        </div>

        <div class="blk cameras">
          <div class="h">Cameras <b>not connected</b></div>
          <div class="cams">
            <div class="cam off"><span>Front door</span><i></i></div>
            <div class="cam off"><span>Backyard</span><i></i></div>
            <div class="cam off"><span>Garage</span><i></i></div>
          </div>
        </div>

        <form class="blk addtask add" onsubmit="addTodo(); return false;">
          <input type="text" id="todo-input" placeholder="Add a task..." autocomplete="off" />
          <div class="r">
            <select id="todo-section">
              <option value="Short Term">Short term</option>
              <option value="Long Term">Long term</option>
            </select>
            <select id="todo-category" style="display:none;"></select>
            <select id="todo-assignee">
              <option value="">Anyone</option>
              <option value="A">Andrew</option>
              <option value="K">Kaili</option>
            </select>
            <button type="submit">Add</button>
          </div>
          <div class="catrow">
            <button type="button" class="ghost" onclick="showAddCategory()">+ Category</button>
            <span id="add-cat-row" style="display:none;">
              <input type="text" id="new-cat-input" placeholder="Category name..." />
              <button type="button" onclick="addCategory()">Add</button>
            </span>
          </div>
        </form>
      </div>

      ${renderPersonColumn({ ...them, name: themName }, 'them', 'And')}
  </div>
</div>

<script src="/js/familyHub.js?v=2"></script>
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

function renderFamilyHubPage() {
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
  <style>
    /* ============================
       FONT FACES (self-hosted)
       ============================ */
    @font-face {
      font-family: 'DM Sans';
      font-style: normal;
      font-weight: 400 700;
      font-display: swap;
      src: url('/fonts/dm-sans-400.woff2') format('woff2');
    }

    /* ============================
       RESET & BASE
       ============================ */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      font-family: 'DM Sans', -apple-system, sans-serif;
      color: var(--b-text);
      background: var(--b-bg);
      transition: background 0.4s ease, color 0.4s ease;
    }

    /* ============================
       COLOR SCHEMES
       ============================ */

    /* Peach & Indigo */
    [data-bento="peach"] {
      --b-bg: #1a1a2e;
      --b-tile: #252540;
      --b-text: #f0ede8;
      --b-muted: rgba(240,237,232,0.4);
      --b-dim: rgba(240,237,232,0.6);
      --b-accent: #e8a87c;
      --b-accent-rgb: 232,168,124;
      --b-secondary: #a78bfa;
      --b-cam-bg: #1a1a2e;
      --b-switcher-bg: rgba(37,37,64,0.9);
    }

    /* Sage & Rose */
    [data-bento="sage"] {
      --b-bg: #1a2420;
      --b-tile: #243530;
      --b-text: #e8ede6;
      --b-muted: rgba(232,237,230,0.4);
      --b-dim: rgba(232,237,230,0.6);
      --b-accent: #8fbc8f;
      --b-accent-rgb: 143,188,143;
      --b-secondary: #d4859a;
      --b-cam-bg: #1a2420;
      --b-switcher-bg: rgba(36,53,48,0.9);
    }

    /* Midnight & Gold */
    [data-bento="midnight"] {
      --b-bg: #141420;
      --b-tile: #1e1e32;
      --b-text: #eae6f0;
      --b-muted: rgba(234,230,240,0.4);
      --b-dim: rgba(234,230,240,0.6);
      --b-accent: #d4a843;
      --b-accent-rgb: 212,168,67;
      --b-secondary: #6b8cce;
      --b-cam-bg: #141420;
      --b-switcher-bg: rgba(30,30,50,0.9);
    }

    /* Nordic */
    [data-bento="nordic"] {
      --b-bg: #1c2028;
      --b-tile: #272d38;
      --b-text: #e0e4ea;
      --b-muted: rgba(224,228,234,0.4);
      --b-dim: rgba(224,228,234,0.6);
      --b-accent: #7eb8d4;
      --b-accent-rgb: 126,184,212;
      --b-secondary: #c49070;
      --b-cam-bg: #1c2028;
      --b-switcher-bg: rgba(39,45,56,0.9);
    }

    /* ============================
       PALETTE PICKER
       ============================ */
    .bento-palette {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      display: flex;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 12px;
      background: var(--b-switcher-bg);
      border: 1px solid rgba(var(--b-accent-rgb),0.15);
    }
    .palette-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--b-muted);
      align-self: center;
      margin-right: 4px;
    }
    .bento-swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .bento-swatch:hover { transform: scale(1.15); }
    .bento-swatch.active { border-color: white; transform: scale(1.15); }
    .bento-swatch[data-scheme="peach"] { background: linear-gradient(135deg, #e8a87c 50%, #a78bfa 50%); }
    .bento-swatch[data-scheme="sage"] { background: linear-gradient(135deg, #8fbc8f 50%, #d4859a 50%); }
    .bento-swatch[data-scheme="midnight"] { background: linear-gradient(135deg, #d4a843 50%, #6b8cce 50%); }
    .bento-swatch[data-scheme="nordic"] { background: linear-gradient(135deg, #7eb8d4 50%, #c49070 50%); }

    /* ============================
       LAYOUT
       ============================ */
    .hub-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }
    .hub-greeting {
      padding: 48px 0 8px;
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      font-weight: 700;
      color: var(--b-text);
      line-height: 1.2;
    }
    .hub-greeting .greeting-sub {
      display: block;
      font-size: 14px;
      font-weight: 400;
      color: var(--b-muted);
      margin-top: 8px;
      letter-spacing: 0.02em;
    }
    .hub-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 16px;
      margin-top: 20px;
    }
    .hub-cameras { grid-column: 1; grid-row: 1 / 3; }
    .hub-health { grid-column: 2; grid-row: 1; }
    .hub-notes { grid-column: 3; grid-row: 1; }
    .hub-todos { grid-column: 2 / 4; grid-row: 2; }

    .hub-nav {
      display: flex;
      gap: 12px;
      padding: 24px;
      justify-content: center;
    }
    .hub-nav a {
      text-decoration: none;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 8px 20px;
      border-radius: 12px;
      color: var(--b-muted);
      font-family: 'DM Sans', sans-serif;
      border: 1px solid rgba(var(--b-accent-rgb),0.12);
      transition: all 0.2s ease;
    }
    .hub-nav a:hover { color: var(--b-accent); border-color: rgba(var(--b-accent-rgb),0.3); }

    /* ============================
       PANELS / TILES
       ============================ */
    .panel {
      background: var(--b-tile);
      border: none;
      border-radius: 20px;
      padding: 22px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.25);
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .panel:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    }
    .panel-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
      color: var(--b-accent);
    }

    /* ============================
       CAMERAS
       ============================ */
    .cam-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .cam-feed {
      aspect-ratio: 16/10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      background: var(--b-cam-bg);
      border-radius: 14px;
    }
    .cam-feed .cam-icon { font-size: 28px; opacity: 0.4; margin-bottom: 6px; color: var(--b-accent); }
    .cam-feed .cam-name { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.6; }
    .cam-feed .cam-status {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
    }

    /* ============================
       HEALTH
       ============================ */
    .health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .health-person {
      padding: 14px;
      border-radius: 14px;
      background: rgba(var(--b-accent-rgb),0.06);
    }
    .health-person .person-name {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--b-text);
    }
    .person-initial {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      background: var(--b-accent);
      color: var(--b-bg);
    }
    .health-row {
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      color: var(--b-dim);
    }
    .health-row span:last-child { font-weight: 600; }

    /* ============================
       TODOS
       ============================ */
    .todo-list { list-style: none; }
    .todo-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .todo-item:hover { background: rgba(var(--b-accent-rgb),0.06); }
    .todo-check {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      border: 2px solid rgba(var(--b-accent-rgb),0.35);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--b-accent);
      transition: all 0.15s ease;
    }
    .todo-item.done .todo-check { background: rgba(var(--b-accent-rgb),0.2); border-color: var(--b-accent); }
    .todo-item.done .todo-text { text-decoration: line-through; opacity: 0.5; }
    .todo-assignee {
      margin-left: auto;
      font-size: 10px;
      font-weight: 700;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .todo-assignee.assignee-a { background: var(--b-accent); color: var(--b-bg); }
    .todo-assignee.assignee-k { background: var(--b-secondary); color: var(--b-bg); }

    /* ============================
       NOTES
       ============================ */
    .notes-list { display: flex; flex-direction: column; gap: 10px; }
    .note-item {
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      background: rgba(var(--b-accent-rgb),0.06);
    }
    .note-meta {
      font-size: 10px;
      margin-bottom: 6px;
      opacity: 0.6;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .note-from-a .note-meta { color: var(--b-accent); }
    .note-from-k .note-meta { color: var(--b-secondary); }

    /* ============================
       RESPONSIVE
       ============================ */
    @media (max-width: 900px) {
      .hub-grid {
        grid-template-columns: 1fr 1fr;
      }
      .hub-cameras { grid-column: 1 / 3; grid-row: auto; }
      .hub-health { grid-column: 1; grid-row: auto; }
      .hub-notes { grid-column: 2; grid-row: auto; }
      .hub-todos { grid-column: 1 / 3; grid-row: auto; }
    }
    @media (max-width: 600px) {
      .bento-palette { top: auto; bottom: 16px; right: 50%; transform: translateX(50%); }
      .hub-wrap { padding: 0 14px 80px; }
      .hub-greeting { padding-top: 24px; }
      .hub-grid { grid-template-columns: 1fr; }
      .hub-cameras,
      .hub-health,
      .hub-notes,
      .hub-todos { grid-column: 1; }
      .cam-grid { grid-template-columns: 1fr; }
      .health-grid { grid-template-columns: 1fr; }
    }
  </style>
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

  <div class="hub-wrap">
    <!-- Greeting -->
    <div class="hub-greeting">
      <span id="greeting-text">Good evening, Andrew & Kaili.</span>
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
          <div class="health-person">
            <div class="person-name">
              <span class="person-initial">A</span> Andrew
            </div>
            <div class="health-row"><span>Status</span><span>All good</span></div>
            <div class="health-row"><span>Next Appt</span><span>Apr 12</span></div>
            <div class="health-row"><span>Last Check</span><span>Feb 8</span></div>
          </div>
          <div class="health-person">
            <div class="person-name">
              <span class="person-initial">K</span> Kaili
            </div>
            <div class="health-row"><span>Status</span><span>All good</span></div>
            <div class="health-row"><span>Next Appt</span><span>Mar 28</span></div>
            <div class="health-row"><span>Last Check</span><span>Jan 15</span></div>
          </div>
        </div>
      </section>

      <!-- TODOS -->
      <section class="hub-todos panel">
        <div class="panel-label">Todos <span style="opacity:0.4; font-weight:400; margin-left:8px; font-size:10px;" id="todo-count"></span></div>
        <ul class="todo-list">
          <li class="todo-item" onclick="toggleTodo(this)">
            <span class="todo-check"></span>
            <span class="todo-text">Grocery run &mdash; Costco list on fridge</span>
            <span class="todo-assignee assignee-k">K</span>
          </li>
          <li class="todo-item" onclick="toggleTodo(this)">
            <span class="todo-check"></span>
            <span class="todo-text">Schedule vet appointment for Luna</span>
            <span class="todo-assignee assignee-a">A</span>
          </li>
          <li class="todo-item done" onclick="toggleTodo(this)">
            <span class="todo-check">&#10003;</span>
            <span class="todo-text">Pay rent</span>
            <span class="todo-assignee assignee-a">A</span>
          </li>
          <li class="todo-item" onclick="toggleTodo(this)">
            <span class="todo-check"></span>
            <span class="todo-text">Call plumber about kitchen faucet</span>
            <span class="todo-assignee assignee-k">K</span>
          </li>
          <li class="todo-item" onclick="toggleTodo(this)">
            <span class="todo-check"></span>
            <span class="todo-text">Order new air filters</span>
            <span class="todo-assignee assignee-a">A</span>
          </li>
          <li class="todo-item done" onclick="toggleTodo(this)">
            <span class="todo-check">&#10003;</span>
            <span class="todo-text">Book anniversary dinner</span>
            <span class="todo-assignee assignee-k">K</span>
          </li>
          <li class="todo-item" onclick="toggleTodo(this)">
            <span class="todo-check"></span>
            <span class="todo-text">Renew car registration</span>
            <span class="todo-assignee assignee-a">A</span>
          </li>
        </ul>
      </section>

      <!-- SHARED NOTES / PINBOARD -->
      <section class="hub-notes panel">
        <div class="panel-label">Pinboard</div>
        <div class="notes-list">
          <div class="note-item note-from-k">
            <div class="note-meta">Kaili &middot; Today</div>
            <div>Don't forget your mom's birthday is next Thursday! I already got a card, just need you to sign it.</div>
          </div>
          <div class="note-item note-from-a">
            <div class="note-meta">Andrew &middot; Yesterday</div>
            <div>Wi-Fi password changed to the usual format. Also moved the router to the office shelf.</div>
          </div>
          <div class="note-item note-from-k">
            <div class="note-meta">Kaili &middot; Mar 18</div>
            <div>Leftover pasta is in the blue container, second shelf. It's really good, don't skip it.</div>
          </div>
        </div>
      </section>

    </main>

    <!-- Navigation -->
    <nav class="hub-nav">
      <a href="/dashboard">Stock Dashboard</a>
      <a href="/">Home</a>
    </nav>
  </div>

  <script>
    /* ------ Color Scheme Switcher ------ */
    function switchScheme(scheme) {
      document.documentElement.setAttribute('data-bento', scheme);
      localStorage.setItem('family-bento-scheme', scheme);
      updateSwatches();
    }
    function updateSwatches() {
      var current = document.documentElement.getAttribute('data-bento') || 'peach';
      document.querySelectorAll('.bento-swatch').forEach(function(sw) {
        sw.classList.toggle('active', sw.getAttribute('data-scheme') === current);
      });
    }
    updateSwatches();

    /* ------ Time-Aware Greeting ------ */
    (function() {
      var hour = new Date().getHours();
      var greeting = 'Good evening';
      if (hour < 12) greeting = 'Good morning';
      else if (hour < 17) greeting = 'Good afternoon';

      var el = document.getElementById('greeting-text');
      if (el) el.textContent = greeting + ', Andrew & Kaili.';

      var sub = document.getElementById('greeting-sub');
      if (sub) {
        var opts = { weekday: 'long', month: 'long', day: 'numeric' };
        sub.textContent = new Date().toLocaleDateString('en-US', opts);
      }
    })();

    /* ------ Todo Toggle ------ */
    function toggleTodo(el) {
      el.classList.toggle('done');
      var check = el.querySelector('.todo-check');
      if (el.classList.contains('done')) {
        check.innerHTML = '&#10003;';
      } else {
        check.innerHTML = '';
      }
      updateTodoCount();
    }
    function updateTodoCount() {
      var total = document.querySelectorAll('.todo-item').length;
      var done = document.querySelectorAll('.todo-item.done').length;
      var el = document.getElementById('todo-count');
      if (el) el.textContent = done + '/' + total + ' done';
    }
    updateTodoCount();
  </script>
</body>
</html>`;
}

function renderFamilyLayout(title, description, cards = []) {
  const cardMarkup = cards.map(card => `
      <article class="card">
        <h2>${card.title}</h2>
        <p>${card.description}</p>
      </article>`).join('');

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
      <a href="/family/medical">Medical</a>
      <a href="/family/todos">ToDos</a>
      <a href="/family/cameras">Cameras</a>
      <a href="/dashboard">Dashboard</a>
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

module.exports = {
  renderFamilyHubPage,
  renderFamilySectionPage,
};

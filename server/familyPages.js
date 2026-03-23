const {
  renderPersonHealthPage: renderPersonHealthPageView,
  renderPersonHealthSectionPage: renderPersonHealthSectionPageView,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
} = require('./healthPageViews');

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

function renderFamilyHubPage(healthSummaries = {}, healthHubData = {}) {
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
      display: block;
      padding: 14px;
      border-radius: 14px;
      background: rgba(var(--b-accent-rgb),0.06);
      color: inherit;
      text-decoration: none;
      border: 1px solid transparent;
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      position: relative;
      text-align: center;
    }
    .health-person:hover {
      transform: translateY(-2px);
      border-color: rgba(var(--b-accent-rgb),0.28);
      background: rgba(var(--b-accent-rgb),0.1);
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
    .health-icon-wrap {
      display: flex;
      justify-content: center;
      margin: 14px 0 10px;
    }
    .health-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      background: rgba(var(--b-accent-rgb),0.12);
      color: var(--b-accent);
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .health-icon svg {
      width: 34px;
      height: 34px;
      display: block;
    }
    .health-icon-heart {
      fill: rgba(var(--b-accent-rgb),0.22);
      stroke: var(--b-accent);
      stroke-width: 2.4;
      stroke-linejoin: round;
    }
    .health-icon-cross {
      fill: var(--b-accent);
    }
    .health-cta {
      margin-top: 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--b-accent);
    }

    /* ============================
       TODOS
       ============================ */
    .todo-sections { display: flex; flex-direction: column; gap: 20px; }
    .todo-section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--b-accent);
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(var(--b-accent-rgb),0.15);
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .todo-section-title.completed-title { color: var(--b-dim); opacity: 0.7; }
    .todo-category-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--b-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 10px 0 4px 2px;
    }
    .todo-list { list-style: none; }
    .todo-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
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
      margin-top: 2px;
    }
    .todo-item.done .todo-check { background: rgba(var(--b-accent-rgb),0.2); border-color: var(--b-accent); }
    .todo-item.done .todo-text { text-decoration: line-through; opacity: 0.5; }
    .todo-content { flex: 1; min-width: 0; }
    .todo-note {
      font-size: 11px;
      color: var(--b-muted);
      margin-top: 2px;
      font-style: italic;
    }
    .todo-completed-date {
      font-size: 10px;
      color: var(--b-muted);
      margin-top: 2px;
    }
    .todo-assignee {
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
    .todo-delete {
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      color: var(--b-muted);
      font-size: 14px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .todo-item:hover .todo-delete { opacity: 0.7; }
    .todo-delete:hover { color: #ef4444; }

    /* Project expand/collapse */
    .todo-project-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: var(--b-secondary);
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(var(--b-accent-rgb),0.08);
      border: none;
      font-family: 'DM Sans', sans-serif;
      margin-top: 4px;
      transition: background 0.15s;
    }
    .todo-project-toggle:hover { background: rgba(var(--b-accent-rgb),0.15); }
    .todo-project-toggle .arrow { transition: transform 0.2s; display: inline-block; }
    .todo-project-toggle .arrow.open { transform: rotate(90deg); }

    .todo-project-body {
      margin: 8px 0 4px 28px;
      padding: 12px 16px;
      border-radius: 14px;
      background: rgba(var(--b-accent-rgb),0.04);
      border: 1px solid rgba(var(--b-accent-rgb),0.08);
      display: none;
    }
    .todo-project-body.open { display: block; }

    .project-goal {
      font-size: 12px;
      color: var(--b-dim);
      font-style: italic;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(var(--b-accent-rgb),0.08);
    }

    .project-phase {
      margin-bottom: 12px;
    }
    .project-phase-name {
      font-size: 11px;
      font-weight: 700;
      color: var(--b-accent);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .project-phase-progress {
      font-size: 10px;
      font-weight: 400;
      color: var(--b-muted);
      margin-left: 6px;
      text-transform: none;
      letter-spacing: 0;
    }

    .sub-task-list { list-style: none; }
    .sub-task-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .sub-task-item:hover { background: rgba(var(--b-accent-rgb),0.06); }
    .sub-check {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 2px solid rgba(var(--b-accent-rgb),0.3);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: var(--b-accent);
    }
    .sub-task-item.done .sub-check { background: rgba(var(--b-accent-rgb),0.2); border-color: var(--b-accent); }
    .sub-task-item.done .sub-text { text-decoration: line-through; opacity: 0.5; }
    .sub-delete {
      width: 16px; height: 16px; border: none; background: transparent;
      color: var(--b-muted); font-size: 12px; cursor: pointer;
      border-radius: 3px; display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s; margin-left: auto;
    }
    .sub-task-item:hover .sub-delete { opacity: 1; }
    .sub-delete:hover { color: #ef4444; }

    .sub-add-row {
      display: flex; gap: 6px; margin-top: 6px; align-items: center;
    }
    .sub-add-row input {
      flex: 1; padding: 5px 10px; border-radius: 8px;
      border: 1px solid rgba(var(--b-accent-rgb),0.15);
      background: rgba(var(--b-accent-rgb),0.03);
      color: var(--b-text); font-family: 'DM Sans', sans-serif;
      font-size: 11px; outline: none;
    }
    .sub-add-row input::placeholder { color: var(--b-muted); }
    .sub-add-row button {
      padding: 5px 10px; border-radius: 8px; border: none;
      background: rgba(var(--b-accent-rgb),0.15); color: var(--b-accent);
      font-family: 'DM Sans', sans-serif; font-size: 11px; cursor: pointer;
    }
    .sub-add-row button:hover { background: rgba(var(--b-accent-rgb),0.25); }

    .project-section-label {
      font-size: 10px; font-weight: 700; color: var(--b-dim);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 10px 0 4px;
    }

    .decision-log { margin-top: 8px; }
    .decision-entry {
      font-size: 11px; color: var(--b-dim); padding: 3px 0;
      display: flex; gap: 8px;
    }
    .decision-date { color: var(--b-muted); flex-shrink: 0; font-size: 10px; }
    .decision-add-row {
      display: flex; gap: 6px; margin-top: 6px; align-items: center;
    }
    .decision-add-row input {
      flex: 1; padding: 5px 10px; border-radius: 8px;
      border: 1px solid rgba(var(--b-accent-rgb),0.15);
      background: rgba(var(--b-accent-rgb),0.03);
      color: var(--b-text); font-family: 'DM Sans', sans-serif;
      font-size: 11px; outline: none;
    }
    .decision-add-row input::placeholder { color: var(--b-muted); }
    .decision-add-row button {
      padding: 5px 10px; border-radius: 8px; border: none;
      background: rgba(var(--b-accent-rgb),0.15); color: var(--b-accent);
      font-family: 'DM Sans', sans-serif; font-size: 11px; cursor: pointer;
    }

    /* Add category inline */
    .add-cat-row {
      display: inline-flex; gap: 6px; align-items: center; margin-left: 12px;
    }
    .add-cat-row input {
      width: 120px; padding: 4px 8px; border-radius: 8px;
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      background: rgba(var(--b-accent-rgb),0.04);
      color: var(--b-text); font-family: 'DM Sans', sans-serif;
      font-size: 11px; outline: none;
    }
    .add-cat-row button {
      padding: 4px 10px; border-radius: 8px; border: none;
      background: rgba(var(--b-accent-rgb),0.15); color: var(--b-accent);
      font-family: 'DM Sans', sans-serif; font-size: 11px; cursor: pointer;
    }
    .add-cat-btn {
      font-size: 11px; color: var(--b-accent); cursor: pointer;
      background: rgba(var(--b-accent-rgb),0.1); border: 1px solid rgba(var(--b-accent-rgb),0.2);
      font-family: 'DM Sans', sans-serif;
      margin-left: 8px; padding: 3px 10px; border-radius: 8px;
      transition: background 0.15s, border-color 0.15s;
      font-weight: 600;
    }
    .add-cat-btn:hover { background: rgba(var(--b-accent-rgb),0.2); border-color: rgba(var(--b-accent-rgb),0.35); }

    /* Action button (make project / expand project) */
    .todo-action-btn {
      width: 22px; height: 22px; border: none; background: transparent;
      color: var(--b-muted); font-size: 13px; cursor: pointer;
      border-radius: 4px; display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .todo-item:hover .todo-action-btn { opacity: 0.7; }
    .todo-action-btn:hover { color: var(--b-secondary); opacity: 1 !important; }

    /* Project setup modal */
    .project-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
    }
    .project-modal {
      background: var(--b-tile); border-radius: 20px; padding: 28px;
      width: min(500px, 90vw); max-height: 80vh; overflow-y: auto;
      box-shadow: 0 16px 48px rgba(0,0,0,0.4);
      border: 1px solid rgba(var(--b-accent-rgb),0.15);
    }
    .project-modal h3 {
      font-size: 16px; font-weight: 700; color: var(--b-accent); margin-bottom: 16px;
    }
    .project-modal label {
      display: block; font-size: 11px; font-weight: 700; color: var(--b-dim);
      text-transform: uppercase; letter-spacing: 0.06em; margin: 12px 0 4px;
    }
    .project-modal input, .project-modal textarea {
      width: 100%; padding: 8px 12px; border-radius: 10px;
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      background: rgba(var(--b-accent-rgb),0.04);
      color: var(--b-text); font-family: 'DM Sans', sans-serif; font-size: 13px;
      outline: none; resize: vertical;
    }
    .project-modal textarea { min-height: 60px; }
    .project-modal .phase-row {
      display: flex; gap: 6px; align-items: center; margin: 4px 0;
    }
    .project-modal .phase-row input { flex: 1; }
    .project-modal .phase-remove {
      background: none; border: none; color: var(--b-muted); cursor: pointer;
      font-size: 16px; padding: 4px;
    }
    .project-modal .phase-remove:hover { color: #ef4444; }
    .project-modal .add-phase-btn {
      font-size: 12px; color: var(--b-accent); cursor: pointer;
      background: rgba(var(--b-accent-rgb),0.1); border: 1px solid rgba(var(--b-accent-rgb),0.2);
      font-family: 'DM Sans', sans-serif; padding: 4px 12px; border-radius: 8px;
      margin-top: 6px;
    }
    .project-modal-actions {
      display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;
    }
    .project-modal-actions button {
      padding: 8px 18px; border-radius: 10px; border: none;
      font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer;
    }
    .project-modal-actions .cancel-btn {
      background: transparent; color: var(--b-muted);
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
    }
    .project-modal-actions .create-btn {
      background: var(--b-accent); color: var(--b-bg);
    }

    /* Add todo form */
    .todo-add {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .todo-add input[type="text"] {
      flex: 1;
      min-width: 150px;
      padding: 9px 14px;
      border-radius: 10px;
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      background: rgba(var(--b-accent-rgb),0.04);
      color: var(--b-text);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }
    .todo-add input[type="text"]::placeholder { color: var(--b-muted); }
    .todo-add input[type="text"]:focus { border-color: rgba(var(--b-accent-rgb),0.5); }
    .todo-add select {
      padding: 9px 10px;
      border-radius: 10px;
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      background: var(--b-tile);
      color: var(--b-text);
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }
    .todo-add button {
      padding: 9px 16px;
      border-radius: 10px;
      border: none;
      background: var(--b-accent);
      color: var(--b-bg);
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .todo-add button:hover { opacity: 0.85; }

    /* ============================
       NOTES
       ============================ */
    .notes-list { display: flex; flex-direction: column; gap: 12px; }
    .notes-empty {
      padding: 14px;
      border-radius: 14px;
      background: rgba(var(--b-accent-rgb),0.04);
      color: var(--b-muted);
      font-size: 13px;
    }
    .note-item {
      padding: 16px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.55;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.04);
    }
    .note-head {
      display: grid;
      gap: 12px;
    }
    .note-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .note-meta {
      font-size: 10px;
      margin-bottom: 0;
      opacity: 0.6;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .note-from-a .note-meta { color: var(--b-accent); }
    .note-from-k .note-meta { color: var(--b-secondary); }
    .note-text {
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.6;
      color: var(--b-text);
    }
    .note-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .note-btn {
      border: 1px solid rgba(var(--b-accent-rgb),0.2);
      background: transparent;
      color: var(--b-dim);
      border-radius: 999px;
      padding: 5px 11px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
    }
    .note-btn:hover {
      color: var(--b-text);
      border-color: rgba(var(--b-accent-rgb),0.45);
      background: rgba(var(--b-accent-rgb),0.08);
    }
    .note-btn.note-delete-btn:hover {
      color: #fecaca;
      border-color: rgba(239,68,68,0.45);
      background: rgba(239,68,68,0.12);
    }
    .note-add { display: grid; gap: 10px; margin-top: 14px; }
    .note-add-controls {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .note-add textarea,
    .note-edit textarea,
    .note-add select,
    .note-edit select {
      width: 100%;
      border: 1px solid rgba(var(--b-accent-rgb),0.18);
      background: rgba(19,19,34,0.92);
      color: var(--b-text);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      resize: vertical;
      min-height: 44px;
    }
    .note-add select option,
    .note-edit select option {
      background: #1f2034;
      color: #f0ede8;
    }
    .note-add textarea,
    .note-edit textarea {
      min-height: 72px;
    }
    .note-add textarea:focus,
    .note-edit textarea:focus,
    .note-add select:focus,
    .note-edit select:focus {
      outline: none;
      border-color: rgba(var(--b-accent-rgb),0.5);
    }
    .note-add button,
    .note-edit-actions button {
      border: none;
      border-radius: 12px;
      background: var(--b-accent);
      color: var(--b-bg);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      padding: 0 14px;
      transition: opacity 0.15s;
    }
    .note-add select,
    .note-add button { min-height: 44px; }
    .note-add button { min-width: 110px; }
    .note-add button:hover,
    .note-edit-actions button:hover { opacity: 0.85; }
    .note-edit {
      display: grid;
      gap: 10px;
      margin-top: 8px;
    }
    .note-edit-top {
      display: grid;
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 10px;
    }
    .note-edit-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .note-edit-actions .secondary {
      background: transparent;
      color: var(--b-dim);
      border: 1px solid rgba(var(--b-accent-rgb),0.18);
    }

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
      .note-top,
      .note-edit-top,
      .note-add-controls { display: grid; grid-template-columns: 1fr; }
      .note-actions { justify-content: flex-start; }
      .note-add button { min-height: 44px; }
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
          ${andrewCard}
          ${kailiCard}
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

    /* ------ Todo API ------ */
    var Q = String.fromCharCode(39);
    var todoData = null;
    var pinboardData = null;
    var editingPinboardId = null;
    var expandedProjects = {};

    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function relDate(value) {
      var d = new Date(value);
      if (isNaN(d.getTime())) return '';
      var now = new Date();
      var diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
      if (diffDays <= 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function authorClass(author) {
      return String(author || '').toLowerCase().charAt(0) === 'k' ? 'note-from-k' : 'note-from-a';
    }

    function renderPinboard() {
      var container = document.getElementById('pinboard-list');
      if (!container) return;
      var notes = pinboardData && pinboardData.notes ? pinboardData.notes : [];
      if (!notes.length) {
        container.innerHTML = '<div class="notes-empty">Nothing pinned yet.</div>';
        return;
      }
      var html = '';
      notes.forEach(function(note) {
        var isEditing = editingPinboardId === note.id;
        html += '<div class="note-item ' + authorClass(note.author) + '">';
        if (isEditing) {
          html += '<div class="note-edit">'
            + '<div class="note-edit-top">'
            + '<select id="pinboard-edit-author-' + note.id + '">'
            + '<option value="Andrew"' + (note.author === 'Andrew' ? ' selected' : '') + '>Andrew</option>'
            + '<option value="Kaili"' + (note.author === 'Kaili' ? ' selected' : '') + '>Kaili</option>'
            + '</select>'
            + '<div class="note-meta">Editing note</div>'
            + '</div>'
            + '<textarea id="pinboard-edit-text-' + note.id + '">' + esc(note.text) + '</textarea>'
            + '<div class="note-edit-actions">'
            + '<button class="secondary" onclick="cancelEditPinboard()">Cancel</button>'
            + '<button onclick="savePinboardEdit(' + Q + note.id + Q + ')">Save</button>'
            + '</div>'
            + '</div>';
        } else {
          html += '<div class="note-head">'
            + '<div class="note-top">'
            + '<div class="note-meta">' + esc(note.author) + ' &middot; ' + esc(relDate(note.updatedAt || note.createdAt)) + '</div>'
            + '<div class="note-actions">'
            + '<button class="note-btn" onclick="startEditPinboard(' + Q + note.id + Q + ')">Edit</button>'
            + '<button class="note-btn note-delete-btn" onclick="deletePinboardNote(' + Q + note.id + Q + ')">Delete</button>'
            + '</div>'
            + '</div>'
            + '<div>'
            + '<div class="note-text">' + esc(note.text) + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
        }
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function loadPinboard() {
      fetch('/api/family/pinboard')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          pinboardData = data;
          renderPinboard();
        })
        .catch(function() {
          var container = document.getElementById('pinboard-list');
          if (container) container.innerHTML = '<div class="notes-empty">Could not load pinboard.</div>';
        });
    }

    function addPinboardNote() {
      var input = document.getElementById('pinboard-input');
      var author = document.getElementById('pinboard-author');
      var text = input.value.trim();
      if (!text) return;
      fetch('/api/family/pinboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, author: author.value })
      }).then(function() {
        input.value = '';
        loadPinboard();
      });
    }

    function startEditPinboard(id) {
      editingPinboardId = id;
      renderPinboard();
    }

    function cancelEditPinboard() {
      editingPinboardId = null;
      renderPinboard();
    }

    function savePinboardEdit(id) {
      var textEl = document.getElementById('pinboard-edit-text-' + id);
      var authorEl = document.getElementById('pinboard-edit-author-' + id);
      if (!textEl) return;
      var text = textEl.value.trim();
      if (!text) return;
      fetch('/api/family/pinboard/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, author: authorEl ? authorEl.value : 'Andrew' })
      }).then(function() {
        editingPinboardId = null;
        loadPinboard();
      });
    }

    function deletePinboardNote(id) {
      fetch('/api/family/pinboard/' + id, { method: 'DELETE' })
        .then(function() {
          if (editingPinboardId === id) editingPinboardId = null;
          loadPinboard();
        });
    }

    function renderSubTask(sub, parentId) {
      var cls = sub.done ? 'sub-task-item done' : 'sub-task-item';
      var check = sub.done ? '&#10003;' : '';
      return '<li class="' + cls + '">'
        + '<span class="sub-check" onclick="toggleTodo(' + Q + sub.id + Q + ')">' + check + '</span>'
        + '<span class="sub-text" onclick="toggleTodo(' + Q + sub.id + Q + ')">' + esc(sub.text) + '</span>'
        + '<button class="sub-delete" onclick="deleteTodo(' + Q + sub.id + Q + ')" title="Delete">&times;</button>'
        + '</li>';
    }

    function renderProject(t) {
      var p = t.project;
      var isOpen = expandedProjects[t.id];
      var arrowCls = isOpen ? 'arrow open' : 'arrow';
      var bodyCls = isOpen ? 'todo-project-body open' : 'todo-project-body';

      var html = '<button class="todo-project-toggle" onclick="toggleExpand(' + Q + t.id + Q + ')">'
        + '<span class="' + arrowCls + '">&#9654;</span> Project'
        + '</button>';
      html += '<div class="' + bodyCls + '" id="project-' + t.id + '">';

      if (p.goal) {
        html += '<div class="project-goal">' + esc(p.goal) + '</div>';
      }

      // Phases
      (p.phases || []).forEach(function(phase) {
        var items = phase.items || [];
        var doneCount = items.filter(function(s) { return s.done; }).length;
        html += '<div class="project-phase">';
        html += '<div class="project-phase-name">' + esc(phase.name)
          + '<span class="project-phase-progress">' + doneCount + '/' + items.length + '</span></div>';
        html += '<ul class="sub-task-list">';
        items.forEach(function(sub) {
          html += renderSubTask(sub, t.id);
        });
        html += '</ul>';
        html += '<div class="sub-add-row">'
          + '<input type="text" placeholder="Add sub-task..." id="sub-input-' + t.id + '-' + esc(phase.name) + '" '
          + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')" />'
          + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')">+</button>'
          + '</div>';
        html += '</div>';
      });

      // Ongoing
      if (p.ongoing && p.ongoing.length > 0) {
        html += '<div class="project-section-label">Ongoing</div>';
        html += '<ul class="sub-task-list">';
        p.ongoing.forEach(function(sub) {
          html += renderSubTask(sub, t.id);
        });
        html += '</ul>';
      }
      html += '<div class="sub-add-row">'
        + '<input type="text" placeholder="Add ongoing task..." id="sub-input-' + t.id + '-__ongoing" '
        + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')" />'
        + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')">+</button>'
        + '</div>';

      // Decision Log
      if (p.decisionLog && p.decisionLog.length > 0) {
        html += '<div class="project-section-label">Decision Log</div>';
        html += '<div class="decision-log">';
        p.decisionLog.forEach(function(entry) {
          html += '<div class="decision-entry">'
            + '<span class="decision-date">' + esc(entry.date) + '</span>'
            + '<span>' + esc(entry.entry) + '</span>'
            + '</div>';
        });
        html += '</div>';
      }
      html += '<div class="decision-add-row">'
        + '<input type="text" placeholder="Add decision note..." id="decision-input-' + t.id + '" '
        + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addDecision(' + Q + t.id + Q + ')" />'
        + '<button onclick="addDecision(' + Q + t.id + Q + ')">+</button>'
        + '</div>';

      html += '</div>';
      return html;
    }

    function renderItem(t) {
      var cls = t.done ? 'todo-item done' : 'todo-item';
      var check = t.done ? '&#10003;' : '';
      var assignee = t.assignee
        ? '<span class="todo-assignee assignee-' + t.assignee.toLowerCase() + '">' + esc(t.assignee) + '</span>'
        : '';
      var note = (t.note && !t.project) ? '<div class="todo-note">' + esc(t.note) + '</div>' : '';
      var projectNote = (t.note && t.project) ? '<div class="todo-note">' + esc(t.note) + '</div>' : '';
      var completed = '';
      if (t.done && t.completedAt) {
        var d = new Date(t.completedAt);
        completed = '<div class="todo-completed-date">completed ' + d.toLocaleDateString() + '</div>';
      }
      var projectHtml = t.project ? renderProject(t) : '';
      var actionBtn = '';
      if (t.project) {
        actionBtn = '<button class="todo-action-btn" onclick="event.stopPropagation();toggleExpand(' + Q + t.id + Q + ')" title="Expand project">&#9776;</button>';
      } else {
        actionBtn = '<button class="todo-action-btn" onclick="event.stopPropagation();showProjectModal(' + Q + t.id + Q + ',' + Q + esc(t.text) + Q + ')" title="Make project">&#9776;</button>';
      }
      return '<li class="' + cls + '" data-id="' + t.id + '">'
        + '<span class="todo-check" onclick="toggleTodo(' + Q + t.id + Q + ')">' + check + '</span>'
        + '<div class="todo-content">'
        + '<span class="todo-text" style="' + (t.project ? '' : 'cursor:pointer') + '"' + (t.project ? '' : ' onclick="toggleTodo(' + Q + t.id + Q + ')"') + '>' + esc(t.text) + '</span>'
        + projectNote + note + completed
        + projectHtml
        + '</div>'
        + assignee
        + actionBtn
        + '<button class="todo-delete" onclick="deleteTodo(' + Q + t.id + Q + ')" title="Delete">&times;</button>'
        + '</li>';
    }

    function renderAllSections(data) {
      todoData = data;
      var container = document.getElementById('todo-sections');
      var html = '';
      var totalItems = 0;
      var totalDone = 0;

      (data.sections || []).forEach(function(section) {
        if (section.name === 'Long Term') {
          html += '<div class="todo-section-title">' + esc(section.name)
            + '<button class="add-cat-btn" onclick="showAddCategory()" title="Add category">+ Category</button>'
            + '<span class="add-cat-row" id="add-cat-row" style="display:none;">'
            + '<input type="text" id="new-cat-input" placeholder="Category name..." onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addCategory()" />'
            + '<button onclick="addCategory()">Add</button>'
            + '</span>'
            + '</div>';
          (section.categories || []).forEach(function(cat) {
            if (!cat.items || cat.items.length === 0) return;
            html += '<div class="todo-category-title">' + esc(cat.name) + '</div>';
            html += '<ul class="todo-list">';
            cat.items.forEach(function(t) {
              totalItems++;
              if (t.done) totalDone++;
              html += renderItem(t);
            });
            html += '</ul>';
          });
        } else {
          if (section.name === 'Recently Completed' && (!section.items || section.items.length === 0)) return;
          var titleCls = section.name === 'Recently Completed' ? 'todo-section-title completed-title' : 'todo-section-title';
          html += '<div class="' + titleCls + '">' + esc(section.name) + '</div>';
          html += '<ul class="todo-list">';
          (section.items || []).forEach(function(t) {
            totalItems++;
            if (t.done) totalDone++;
            html += renderItem(t);
          });
          html += '</ul>';
        }
      });

      container.innerHTML = html;
      var countEl = document.getElementById('todo-count');
      if (countEl) countEl.textContent = totalDone + '/' + totalItems + ' done';
      updateCategoryDropdown();
    }

    function updateCategoryDropdown() {
      var sectionSel = document.getElementById('todo-section');
      var catSel = document.getElementById('todo-category');
      if (sectionSel.value === 'Long Term' && todoData) {
        var lt = todoData.sections.find(function(s) { return s.name === 'Long Term'; });
        var cats = (lt && lt.categories) || [];
        catSel.innerHTML = cats.map(function(c) {
          return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
        }).join('');
        catSel.style.display = '';
      } else {
        catSel.style.display = 'none';
      }
    }

    function loadTodos() {
      fetch('/api/family/todos')
        .then(function(r) { return r.json(); })
        .then(renderAllSections)
        .catch(function() {
          document.getElementById('todo-sections').innerHTML = '<p style="padding:12px;opacity:0.5;">Could not load todos</p>';
        });
    }

    function toggleTodo(id) {
      fetch('/api/family/todos/' + id + '/toggle', { method: 'PATCH' })
        .then(function() { loadTodos(); });
    }

    function deleteTodo(id) {
      fetch('/api/family/todos/' + id, { method: 'DELETE' })
        .then(function() { loadTodos(); });
    }

    function addTodo() {
      var input = document.getElementById('todo-input');
      var assigneeSel = document.getElementById('todo-assignee');
      var sectionSel = document.getElementById('todo-section');
      var catSel = document.getElementById('todo-category');
      var text = input.value.trim();
      if (!text) return;
      var body = {
        text: text,
        assignee: assigneeSel.value || null,
        section: sectionSel.value
      };
      if (sectionSel.value === 'Long Term' && catSel.value) {
        body.category = catSel.value;
      }
      fetch('/api/family/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function() {
        input.value = '';
        assigneeSel.value = '';
        loadTodos();
      });
    }

    function toggleExpand(id) {
      expandedProjects[id] = !expandedProjects[id];
      var body = document.getElementById('project-' + id);
      var btn = body ? body.previousElementSibling : null;
      if (body) body.classList.toggle('open');
      if (btn) {
        var arrow = btn.querySelector('.arrow');
        if (arrow) arrow.classList.toggle('open');
      }
    }

    function addSubTask(parentId, phaseName) {
      var input = document.getElementById('sub-input-' + parentId + '-' + phaseName);
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;
      fetch('/api/family/todos/' + parentId + '/subtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: phaseName, text: text })
      }).then(function() {
        input.value = '';
        loadTodos();
      });
    }

    function addDecision(parentId) {
      var input = document.getElementById('decision-input-' + parentId);
      if (!input) return;
      var entry = input.value.trim();
      if (!entry) return;
      fetch('/api/family/todos/' + parentId + '/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: entry })
      }).then(function() {
        input.value = '';
        loadTodos();
      });
    }

    /* ------ Project Modal ------ */
    var projectModalPhases = ['Phase 1'];

    function showProjectModal(id, name) {
      projectModalPhases = ['Phase 1'];
      var overlay = document.createElement('div');
      overlay.className = 'project-modal-overlay';
      overlay.id = 'project-modal-overlay';
      overlay.onclick = function(e) { if (e.target === overlay) closeProjectModal(); };
      overlay.innerHTML = '<div class="project-modal">'
        + '<h3>Make "' + esc(name) + '" a Project</h3>'
        + '<label>Goal</label>'
        + '<input type="text" id="pm-goal" placeholder="What is the end goal?" />'
        + '<label>Phases</label>'
        + '<div id="pm-phases"></div>'
        + '<button class="add-phase-btn" onclick="addModalPhase()">+ Add Phase</button>'
        + '<div class="project-modal-actions">'
        + '<button class="cancel-btn" onclick="closeProjectModal()">Cancel</button>'
        + '<button class="create-btn" onclick="createProject(' + Q + id + Q + ')">Create Project</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(overlay);
      renderModalPhases();
      document.getElementById('pm-goal').focus();
    }

    function renderModalPhases() {
      var container = document.getElementById('pm-phases');
      if (!container) return;
      container.innerHTML = projectModalPhases.map(function(p, i) {
        return '<div class="phase-row">'
          + '<input type="text" class="pm-phase-input" value="' + esc(p) + '" '
          + 'oninput="projectModalPhases[' + i + ']=this.value" '
          + 'placeholder="Phase name..." />'
          + (projectModalPhases.length > 1
            ? '<button class="phase-remove" onclick="removeModalPhase(' + i + ')">&times;</button>'
            : '')
          + '</div>';
      }).join('');
    }

    function addModalPhase() {
      projectModalPhases.push('Phase ' + (projectModalPhases.length + 1));
      renderModalPhases();
    }

    function removeModalPhase(i) {
      projectModalPhases.splice(i, 1);
      renderModalPhases();
    }

    function closeProjectModal() {
      var overlay = document.getElementById('project-modal-overlay');
      if (overlay) overlay.remove();
    }

    function createProject(id) {
      var goal = document.getElementById('pm-goal').value.trim();
      var phases = projectModalPhases
        .map(function(p) { return p.trim(); })
        .filter(function(p) { return p.length > 0; })
        .map(function(p) { return { name: p, items: [] }; });
      if (phases.length === 0) phases = [{ name: 'Phase 1', items: [] }];
      fetch('/api/family/todos/' + id + '/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal, phases: phases, ongoing: [], decisionLog: [] })
      }).then(function() {
        closeProjectModal();
        expandedProjects[id] = true;
        loadTodos();
      });
    }

    function showAddCategory() {
      var row = document.getElementById('add-cat-row');
      if (row) {
        row.style.display = row.style.display === 'none' ? 'inline-flex' : 'none';
        if (row.style.display !== 'none') {
          var inp = document.getElementById('new-cat-input');
          if (inp) inp.focus();
        }
      }
    }

    function addCategory() {
      var input = document.getElementById('new-cat-input');
      if (!input) return;
      var name = input.value.trim();
      if (!name) return;
      fetch('/api/family/todos/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
      }).then(function() {
        input.value = '';
        document.getElementById('add-cat-row').style.display = 'none';
        loadTodos();
      });
    }

    // Show/hide category dropdown based on section selection
    document.getElementById('todo-section').addEventListener('change', updateCategoryDropdown);

    // Submit on Enter key
    document.getElementById('todo-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addTodo();
    });

    loadTodos();
    document.getElementById('pinboard-input').addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addPinboardNote();
    });
    loadPinboard();
  </script>
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReminderItem(item) {
  return `<li class="health-list-item">
    <div>
      <strong>${escapeHtml(item.label)}</strong>
      <div class="health-meta">${escapeHtml(item.note || '')}</div>
    </div>
    <div class="health-chip">${escapeHtml(item.dueDate || item.status || 'Open')}</div>
  </li>`;
}

function renderBulletItem(item) {
  return `<li class="health-list-item">
    <div>
      <strong>${escapeHtml(item.title || 'Untitled')}</strong>
      <div class="health-meta">${escapeHtml(item.summary || '')}</div>
    </div>
    <div class="health-chip">${escapeHtml(item.date_of_service || 'Undated')}</div>
  </li>`;
}

function renderFileItem(item, basePath) {
  const href = `${basePath}/report/${encodeURIComponent(item.fileName)}`;
  return `<li class="health-list-item">
    <div>
      <strong>${escapeHtml(item.fileName)}</strong>
      <div class="health-meta">${escapeHtml(item.ext.replace('.', '').toUpperCase())} report</div>
    </div>
    <a class="health-link-inline" href="${href}">Open</a>
  </li>`;
}

function renderPersonHealthPage(healthData) {
  const { person, reminders, bloodworkReport, latestImaging, immunizations, concerns, reportFiles, latestLabs } = healthData;
  const basePath = `/family/health/${person.slug}`;
  const reminderMarkup = reminders.length
    ? reminders.map(renderReminderItem).join('')
    : '<li class="health-list-item"><div><strong>No reminders yet</strong><div class="health-meta">No due items were derived from the current records.</div></div></li>';
  const imagingMarkup = latestImaging.length
    ? latestImaging.slice(0, 3).map(renderBulletItem).join('')
    : '<li class="health-list-item"><div><strong>No imaging found</strong><div class="health-meta">No imaging reports or findings are currently in the database.</div></div></li>';
  const vaccineMarkup = immunizations.length
    ? immunizations.slice(0, 4).map(renderBulletItem).join('')
    : '<li class="health-list-item"><div><strong>No vaccine history found</strong><div class="health-meta">Immunization records have not been ingested yet.</div></div></li>';
  const concernMarkup = concerns.length
    ? concerns.slice(0, 4).map(renderBulletItem).join('')
    : '<li class="health-list-item"><div><strong>No recent flagged concerns</strong><div class="health-meta">Nothing recent matched the current alert rules.</div></div></li>';
  const reportMarkup = reportFiles.length
    ? reportFiles.slice(0, 5).map(item => renderFileItem(item, basePath)).join('')
    : '<li class="health-list-item"><div><strong>No report files found</strong><div class="health-meta">The reports folder is empty.</div></div></li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(person.name)} Health</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111827;
      --panel: #182235;
      --panel-soft: rgba(255,255,255,0.03);
      --panel-border: rgba(255,255,255,0.08);
      --text: #edf2f7;
      --muted: #94a3b8;
      --accent: #7dd3fc;
      --accent-2: #f59e0b;
      --danger: #fca5a5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(125, 211, 252, 0.14), transparent 28%),
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.12), transparent 24%),
        linear-gradient(180deg, #09111f, var(--bg));
      font-family: "DM Sans", "Segoe UI", sans-serif;
    }
    main {
      width: min(1240px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 36px 0 72px;
    }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      font-size: clamp(2.2rem, 5vw, 4rem);
      line-height: 0.95;
    }
    .lead {
      margin-top: 14px;
      max-width: 68ch;
      color: var(--muted);
      line-height: 1.7;
      font-size: 1rem;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .links a, .health-link-inline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--text);
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--panel-border);
    }
    .links a.primary {
      background: linear-gradient(90deg, rgba(125,211,252,0.18), rgba(245,158,11,0.16));
      border-color: rgba(125,211,252,0.26);
    }
    .hero {
      display: grid;
      grid-template-columns: 1.25fr 0.9fr;
      gap: 16px;
      margin-bottom: 18px;
    }
    .hero-card, .health-card {
      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
      backdrop-filter: blur(10px);
    }
    .hero-card {
      padding: 28px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .stat {
      padding: 16px;
      border-radius: 18px;
      background: var(--panel-soft);
      border: 1px solid rgba(255,255,255,0.04);
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    .stat-value {
      margin-top: 6px;
      font-size: 1.35rem;
      color: var(--text);
    }
    .health-grid {
      display: grid;
      grid-template-columns: 1.45fr 1fr 1fr;
      grid-template-areas:
        "reminders bloodwork images"
        "findings vaccines reports";
      gap: 16px;
    }
    .card-reminders { grid-area: reminders; }
    .card-bloodwork { grid-area: bloodwork; }
    .card-images { grid-area: images; }
    .card-findings { grid-area: findings; }
    .card-vaccines { grid-area: vaccines; }
    .card-reports { grid-area: reports; }
    .health-card {
      padding: 22px;
    }
    .health-card.link-card {
      text-decoration: none;
      color: inherit;
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .health-card.link-card:hover {
      transform: translateY(-3px);
      border-color: rgba(125,211,252,0.3);
    }
    .card-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
    }
    .card-title {
      margin: 0 0 8px;
      font-size: 1.35rem;
      line-height: 1.1;
    }
    .card-copy {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .health-list {
      list-style: none;
      margin: 16px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .health-list-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--panel-soft);
      border: 1px solid rgba(255,255,255,0.04);
    }
    .health-meta {
      margin-top: 5px;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }
    .health-chip {
      flex-shrink: 0;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(125,211,252,0.1);
      color: var(--accent);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .flag-list {
      margin: 16px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.55;
    }
    .flag-list li + li { margin-top: 8px; }
    .mini-stat {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
      color: var(--muted);
      font-size: 0.95rem;
    }
    @media (max-width: 980px) {
      .hero {
        grid-template-columns: 1fr;
      }
      .health-grid {
        grid-template-columns: 1fr 1fr;
        grid-template-areas:
          "reminders reminders"
          "bloodwork images"
          "findings vaccines"
          "reports reports";
      }
    }
    @media (max-width: 640px) {
      main {
        width: min(100vw - 20px, 100%);
        padding-top: 20px;
      }
      .stats, .health-grid {
        grid-template-columns: 1fr;
      }
      .health-grid {
        grid-template-areas:
          "reminders"
          "bloodwork"
          "images"
          "findings"
          "vaccines"
          "reports";
      }
      .health-list-item {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <div>
        <div class="eyebrow">Family Health</div>
        <h1>${escapeHtml(person.name)} Health</h1>
        <p class="lead">Balanced bento overview of bloodwork, imaging, reminders, vaccine timing, and recent issues pulled from the ingested health database and report folder.</p>
      </div>
      <div class="links">
        <a href="/family" class="primary">Family Hub</a>
        <a href="/family/health">Switch Person</a>
        <a href="${basePath}/bloodwork">Bloodwork</a>
        <a href="${basePath}/images">Images</a>
      </div>
    </div>

    <section class="hero">
      <article class="hero-card">
        <div class="card-label">Snapshot</div>
        <h2 class="card-title">Health records anchored to live source material</h2>
        <p class="card-copy">The dashboard is using ${escapeHtml(person.name)}&#39;s health database, recent reports, and reminder rules so the top-level page stays actionable rather than document-heavy.</p>
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Latest bloodwork</div>
            <div class="stat-value">${escapeHtml(latestLabs ? latestLabs.date_of_service : 'Unknown')}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Flagged lab items</div>
            <div class="stat-value">${escapeHtml(String(bloodworkReport && bloodworkReport.flags ? bloodworkReport.flags.length : 0))}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Recent imaging items</div>
            <div class="stat-value">${escapeHtml(String(latestImaging.length))}</div>
          </div>
        </div>
      </article>
      <article class="hero-card">
        <div class="card-label">This year</div>
        <h2 class="card-title">What needs attention next</h2>
        <ul class="health-list">${reminderMarkup}</ul>
      </article>
    </section>

    <section class="health-grid">
      <article class="health-card card-reminders">
        <div class="card-label">Reminders</div>
        <h2 class="card-title">Due soon and due this year</h2>
        <p class="card-copy">Vaccines, annual bloodwork timing, and short-horizon follow-ups inferred from recent records.</p>
        <ul class="health-list">${reminderMarkup}</ul>
      </article>

      <a class="health-card link-card card-bloodwork" href="${basePath}/bloodwork">
        <div class="card-label">Bloodwork</div>
        <h2 class="card-title">Labs and blood panels</h2>
        <p class="card-copy">${escapeHtml(bloodworkReport && bloodworkReport.stats['Date Range']
          ? `Trend report available. Coverage: ${bloodworkReport.stats['Date Range']}.`
          : 'Open the bloodwork section for the report, trend summary, and flagged markers.')}</p>
        ${bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length ? `<ul class="flag-list">${bloodworkReport.flags.slice(0, 4).map(flag => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>` : ''}
        <div class="mini-stat">
          <span>Latest draw</span>
          <strong>${escapeHtml(latestLabs ? latestLabs.date_of_service : 'Unknown')}</strong>
        </div>
      </a>

      <a class="health-card link-card card-images" href="${basePath}/images">
        <div class="card-label">Images</div>
        <h2 class="card-title">Imaging and findings</h2>
        <p class="card-copy">Open the imaging section for recent studies, narrative findings, and linked report files.</p>
        <ul class="health-list">${imagingMarkup}</ul>
      </a>

      <article class="health-card card-findings">
        <div class="card-label">Findings</div>
        <h2 class="card-title">Recent concerns</h2>
        <p class="card-copy">This card surfaces recent abnormalities or follow-up-worthy findings from labs and imaging.</p>
        <ul class="health-list">${concernMarkup}</ul>
      </article>

      <article class="health-card card-vaccines">
        <div class="card-label">Vaccines</div>
        <h2 class="card-title">Recorded immunizations</h2>
        <p class="card-copy">Most recent vaccine entries pulled directly from the ingested immunization history.</p>
        <ul class="health-list">${vaccineMarkup}</ul>
      </article>

      <article class="health-card card-reports">
        <div class="card-label">Reports</div>
        <h2 class="card-title">Source documents</h2>
        <p class="card-copy">Quick access to bloodwork reports and imaging writeups sitting in the person-specific reports folder.</p>
        <ul class="health-list">${reportMarkup}</ul>
      </article>
    </section>
  </main>
</body>
</html>`;
}

function renderPersonHealthSectionPage(healthData, section) {
  const { person, bloodworkReport, latestImaging, reportFiles, latestLabs, concerns } = healthData;
  const basePath = `/family/health/${person.slug}`;
  const pageTitle = section === 'bloodwork' ? 'Bloodwork' : 'Images';
  const relatedReports = reportFiles.filter(file =>
    section === 'bloodwork'
      ? /bloodwork|lab/i.test(file.fileName)
      : /mri|ct|xray|ultra|imaging|report/i.test(file.fileName)
  );
  const listMarkup = section === 'bloodwork'
    ? (bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length
      ? bloodworkReport.flags.map(flag => `<li>${escapeHtml(flag)}</li>`).join('')
      : '<li>No flagged bloodwork markers were parsed from the current report.</li>')
    : (latestImaging.length
      ? latestImaging.map(item => `<li><strong>${escapeHtml(item.title)}</strong><br><span class="health-meta">${escapeHtml(item.date_of_service || 'Undated')} · ${escapeHtml(item.summary || '')}</span></li>`).join('')
      : '<li>No imaging findings are currently available.</li>');
  const reportMarkup = relatedReports.length
    ? relatedReports.map(item => renderFileItem(item, basePath)).join('')
    : '<li class="health-list-item"><div><strong>No matching report files</strong><div class="health-meta">Nothing in the reports folder matched this section yet.</div></div></li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(person.name)} ${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #152033;
      --border: rgba(255,255,255,0.08);
      --text: #edf2f7;
      --muted: #94a3b8;
      --accent: #7dd3fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: linear-gradient(180deg, #07101c, var(--bg));
      font-family: "DM Sans", "Segoe UI", sans-serif;
    }
    main {
      width: min(1080px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 36px 0 60px;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 22px;
    }
    .links a {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--text);
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
    }
    .panel {
      padding: 24px;
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
      border: 1px solid var(--border);
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
      margin-bottom: 16px;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    h1, h2 { margin: 0; }
    h1 { font-size: clamp(2rem, 4vw, 3.2rem); }
    .lead, .health-meta {
      color: var(--muted);
      line-height: 1.65;
    }
    .health-list {
      list-style: none;
      padding: 0;
      margin: 16px 0 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .health-list-item, .bullet-list li {
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .bullet-list {
      margin: 16px 0 0;
      padding-left: 18px;
      line-height: 1.6;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .stat {
      padding: 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    .stat-value {
      margin-top: 6px;
      font-size: 1.15rem;
    }
  </style>
</head>
<body>
  <main>
    <div class="links">
      <a href="${basePath}">${escapeHtml(person.name)} Health</a>
      <a href="${basePath}/bloodwork">Bloodwork</a>
      <a href="${basePath}/images">Images</a>
      <a href="/family/health">Switch Person</a>
    </div>

    <section class="panel">
      <div class="eyebrow">${escapeHtml(person.name)} ${escapeHtml(pageTitle)}</div>
      <h1>${escapeHtml(pageTitle)}</h1>
      <p class="lead">${section === 'bloodwork'
        ? 'Focused lab view with report-derived flags, recent draw timing, and direct links to bloodwork source files.'
        : 'Focused imaging view with recent findings, narrative summaries, and direct links to imaging source files.'}</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Latest date</div>
          <div class="stat-value">${escapeHtml(section === 'bloodwork' ? (latestLabs ? latestLabs.date_of_service : 'Unknown') : (latestImaging[0] ? latestImaging[0].date_of_service || 'Undated' : 'Unknown'))}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Source files</div>
          <div class="stat-value">${escapeHtml(String(relatedReports.length))}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Flagged items</div>
          <div class="stat-value">${escapeHtml(String(section === 'bloodwork' ? ((bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length) || 0) : concerns.length))}</div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>${section === 'bloodwork' ? 'Flags and trend highlights' : 'Recent imaging findings'}</h2>
      <ul class="bullet-list">${listMarkup}</ul>
    </section>

    <section class="panel">
      <h2>Related report files</h2>
      <ul class="health-list">${reportMarkup}</ul>
    </section>
  </main>
</body>
</html>`;
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

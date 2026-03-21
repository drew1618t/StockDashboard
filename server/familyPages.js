function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTodoList(items = []) {
  if (!items.length) return '<p>No tasks yet.</p>';
  return `<ul class="todo-list">${items
    .map(item => {
      const checked = item && item.done ? 'checked' : '';
      const text = item && typeof item.text === 'string' ? item.text : String(item || '');
      return `<li class="todo-item"><input type="checkbox" disabled ${checked}> <span>${escapeHtml(text)}</span></li>`;
    })
    .join('')}</ul>`;
}

function renderFamilyLayout(title, description, cards = []) {
  const cardMarkup = cards
    .map(
      card => `
      <article class="card">
        <h2>${card.title}</h2>
        <div>${card.description}</div>
      </article>`
    )
    .join('');

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
      --panel-border: rgba(255, 255, 255, 0.08);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #7dd3fc;
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
        linear-gradient(180deg, #040b16, #07111f);
    }
    main {
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }
    .eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: .16em; font-size: 12px; margin-bottom: 10px; }
    h1 { margin: 0 0 12px; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1; }
    .lead { max-width: 760px; color: var(--muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 28px; }
    .links { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
    .links a {
      display: inline-flex; align-items: center; min-height: 42px; padding: 0 16px; color: var(--text);
      background: rgba(255,255,255,0.04); border: 1px solid var(--panel-border); border-radius: 999px; text-decoration: none;
    }
    .links a.primary { background: linear-gradient(90deg, rgba(125,211,252,.16), rgba(249,115,22,.18)); border-color: rgba(125,211,252,.28); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card {
      min-height: 180px; padding: 22px; border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border: 1px solid var(--panel-border);
    }
    .card h2 { margin: 0 0 10px; font-size: 1rem; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); }
    .card > div { margin: 0; color: var(--muted); line-height: 1.6; }
    .todo-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .todo-item { display: flex; align-items: flex-start; gap: 10px; color: var(--text); line-height: 1.5; }
    .todo-item input { margin-top: 3px; accent-color: var(--accent); }
    .todo-next { margin-top: 10px; color: var(--muted); font-size: .95rem; border-left: 2px solid rgba(125,211,252,.35); padding-left: 10px; }
    @media (max-width: 640px) { main { padding-top: 32px; } .links a { width: 100%; justify-content: center; } }
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

function renderFamilyHubPage() {
  return renderFamilyLayout(
    'Family Operations Hub',
    'This area is reserved for family-tier users. It is the protected boundary for medical records, shared task tracking, and home camera access.',
    [
      { title: 'Medical', description: 'Future medical notes, appointments, and household health references should live under this protected route group only.' },
      { title: 'ToDos', description: 'Shared household tasks can be added here later without exposing them to the general dashboard audience.' },
      { title: 'Cameras', description: 'Camera feeds, snapshots, and related controls belong in this protected area and should never be mixed into general APIs.' },
    ]
  );
}

function renderFamilyTodoPage(todo = {}) {
  const sections = Array.isArray(todo.sections) ? todo.sections : [];

  const cards = sections.flatMap(section => {
    const sectionCards = [];

    if (section.items && section.items.length) {
      sectionCards.push({
        title: section.title,
        description: `${renderTodoList(section.items)}${section.next ? `<div class="todo-next">Next: ${escapeHtml(section.next)}</div>` : ''}`,
      });
    }

    if (Array.isArray(section.children)) {
      for (const child of section.children) {
        sectionCards.push({
          title: `${section.title} — ${child.title}`,
          description: `${renderTodoList(child.items || [])}${child.next ? `<div class="todo-next">Next: ${escapeHtml(child.next)}</div>` : ''}`,
        });
      }
    }

    if (!sectionCards.length) {
      sectionCards.push({
        title: section.title,
        description: '<p>No tasks yet.</p>',
      });
    }

    return sectionCards;
  });

  return renderFamilyLayout('Shared ToDos', 'Synced from TODO.md (single source of truth).', cards);
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
  renderFamilyTodoPage,
  renderFamilySectionPage,
};

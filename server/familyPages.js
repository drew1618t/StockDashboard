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

function renderFamilyHubPage() {
  return renderFamilyLayout(
    'Family Operations Hub',
    'This area is reserved for family-tier users. It is the protected boundary for medical records, shared task tracking, and home camera access.',
    [
      {
        title: 'Medical',
        description: 'Future medical notes, appointments, and household health references should live under this protected route group only.',
      },
      {
        title: 'ToDos',
        description: 'Shared household tasks can be added here later without exposing them to the general dashboard audience.',
      },
      {
        title: 'Cameras',
        description: 'Camera feeds, snapshots, and related controls belong in this protected area and should never be mixed into general APIs.',
      },
    ]
  );
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

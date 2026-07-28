const fs = require('fs');
const path = require('path');

const { escapeHtml } = require('./utils/html');

const DEFAULT_INVESTMENT_DOCUMENTS = {
  tracker: {
    fileName: 'four_account_portfolio_tracker.xlsx',
    label: 'Four-Account Portfolio Tracker',
    description: 'Current balances, account allocation, consolidated holdings, transaction history, and reconciliation checks.',
    relativePath: path.join(
      'outputs',
      'account-tracker-2026-07-28',
      'four_account_portfolio_tracker.xlsx'
    ),
  },
  study: {
    fileName: 'investment_success_first_buy_to_peak.xlsx',
    label: 'Investment Success Study',
    description: 'The complete account-level first-buy-to-peak analysis, including episode detail, exclusions, and methodology.',
    relativePath: path.join(
      'outputs',
      'investment-success-2026-07-28',
      'investment_success_first_buy_to_peak.xlsx'
    ),
  },
};

function getInvestmentDocuments(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const documents = options.investmentDocuments || DEFAULT_INVESTMENT_DOCUMENTS;

  return Object.entries(documents).map(([key, document]) => ({
    ...document,
    key,
    fullPath: path.resolve(rootDir, document.relativePath),
  }));
}

function findInvestmentDocument(key, options = {}) {
  return getInvestmentDocuments(options).find(document => document.key === key) || null;
}

function renderDocumentCard(document) {
  const available = fs.existsSync(document.fullPath);
  return `
    <article class="document-card" id="${escapeHtml(document.key)}">
      <div class="document-card__eyebrow">${document.key === 'tracker' ? 'Living record' : 'Research archive'}</div>
      <h2>${escapeHtml(document.label)}</h2>
      <p>${escapeHtml(document.description)}</p>
      <div class="document-card__meta">
        <span>Excel workbook</span>
        <span>${available ? 'Ready' : 'Unavailable on this server'}</span>
      </div>
      ${available
        ? `<a class="button" href="/family/investments/files/${encodeURIComponent(document.key)}">Download workbook</a>`
        : '<span class="button button--disabled" aria-disabled="true">Workbook unavailable</span>'}
    </article>`;
}

function renderFamilyInvestmentsPage(options = {}) {
  const documents = getInvestmentDocuments(options);
  const cards = documents.map(renderDocumentCard).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Family Portfolio</title>
  <link rel="stylesheet" href="/css/fonts.css?v=2">
  <style>
    :root {
      color-scheme: dark;
      --bg: #09111f;
      --panel: #111d30;
      --line: rgba(255,255,255,.11);
      --text: #f4f7fb;
      --muted: #9babc0;
      --accent: #7dd3fc;
      --accent-dark: #0c4a6e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 85% 0%, rgba(14,116,144,.2), transparent 34rem),
        var(--bg);
      color: var(--text);
      font-family: "Inter", "Segoe UI", sans-serif;
    }
    a { color: inherit; }
    .shell { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 72px; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--line);
    }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .topbar nav { display: flex; gap: 22px; color: var(--muted); font-size: 14px; }
    .topbar nav a { text-decoration: none; }
    .topbar nav a[aria-current="page"], .topbar nav a:hover { color: var(--text); }
    .hero { padding: 72px 0 42px; max-width: 760px; }
    .eyebrow, .document-card__eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .13em;
      text-transform: uppercase;
    }
    h1 { margin: 12px 0 16px; font-size: clamp(42px, 7vw, 72px); line-height: .98; letter-spacing: -.045em; }
    .hero p { color: var(--muted); font-size: 18px; line-height: 1.65; margin: 0; }
    .subnav {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      padding: 6px;
      width: fit-content;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,.025);
    }
    .subnav a {
      padding: 8px 13px;
      border-radius: 999px;
      color: var(--muted);
      font-size: 13px;
      text-decoration: none;
    }
    .subnav a:first-child { color: var(--text); background: rgba(125,211,252,.12); }
    .document-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .document-card {
      display: flex;
      min-height: 310px;
      flex-direction: column;
      padding: 30px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: linear-gradient(150deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
    }
    .document-card h2 { margin: 12px 0; font-size: 27px; letter-spacing: -.025em; }
    .document-card p { color: var(--muted); line-height: 1.65; margin: 0 0 28px; }
    .document-card__meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: auto;
      padding: 16px 0;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: 10px;
      background: var(--accent);
      color: var(--accent-dark);
      font-weight: 800;
      text-decoration: none;
    }
    .button--disabled { opacity: .45; }
    .privacy-note {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      margin-top: 22px;
      padding: 18px 20px;
      border: 1px solid rgba(125,211,252,.18);
      border-radius: 14px;
      background: rgba(14,116,144,.08);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }
    .privacy-note strong { color: var(--text); }
    @media (max-width: 720px) {
      .shell { width: min(100% - 28px, 1080px); }
      .topbar { align-items: flex-start; flex-direction: column; }
      .topbar nav { flex-wrap: wrap; gap: 12px 18px; }
      .hero { padding-top: 52px; }
      .document-grid { grid-template-columns: 1fr; }
      .subnav { max-width: 100%; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="/dashboard#family">Portfolio Viz</a>
      <nav aria-label="Family portfolio">
        <a href="/dashboard#family">Family Investing</a>
        <a href="/writing/investment-winners-what-the-data-says">Public study</a>
        <a href="/family" aria-current="page">Family Hub</a>
      </nav>
    </header>

    <section class="hero">
      <div class="eyebrow">Family-only portfolio records</div>
      <h1>Private detail, one quiet corner.</h1>
      <p>The main stock dashboard stays focused on company analysis. Household balances, account history, and transaction-derived research live here behind the family access boundary.</p>
    </section>

    <nav class="subnav" aria-label="Investment documents">
      <a href="#documents">Overview</a>
      <a href="#tracker">Account Tracker</a>
      <a href="#study">Success Study</a>
    </nav>

    <section class="document-grid" id="documents">
      ${cards}
    </section>

    <aside class="privacy-note">
      <strong>Private</strong>
      <span>These downloads contain account identifiers and detailed household financial information. They are intentionally excluded from the general Writing and Projects areas.</span>
    </aside>
  </main>
</body>
</html>`;
}

module.exports = {
  DEFAULT_INVESTMENT_DOCUMENTS,
  findInvestmentDocument,
  getInvestmentDocuments,
  renderFamilyInvestmentsPage,
};

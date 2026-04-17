function getDashboardDescription(companyCount) {
  const count = Number.isFinite(companyCount) ? companyCount : 0;
  const companyLabel = count === 1 ? 'company' : 'companies';

  if (count > 0) {
    return `Real-time growth portfolio analysis. ${count} ${companyLabel} tracked across revenue growth, valuation, profitability, and Saul's investing rules.`;
  }

  return "Real-time growth portfolio analysis. Portfolio companies tracked across revenue growth, valuation, profitability, and Saul's investing rules.";
}

function getPortfolioPositionCount(dataLoader) {
  if (dataLoader && typeof dataLoader.getPortfolioHoldings === 'function') {
    const holdings = dataLoader.getPortfolioHoldings();
    if (Array.isArray(holdings) && holdings.length > 0) return holdings.length;
  }

  if (dataLoader && typeof dataLoader.getCompanies === 'function') {
    const companies = dataLoader.getCompanies();
    if (Array.isArray(companies)) return companies.length;
  }

  return 0;
}

function renderHomePage(user, options = {}) {
  const roleLabel = user && user.role === 'family' ? 'Family' : 'General';
  const dashboardDescription = getDashboardDescription(options.dashboardCompanyCount);
  const familyCard = user && user.role === 'family'
    ? `
      <article class="card card--primary" onclick="window.location.href='/family'">
        <div class="card-corner"></div>
        <div class="card-shimmer"></div>
        <div class="card-stamp">Family</div>
        <h2 class="card-title">Family Hub</h2>
        <div class="card-line"></div>
        <p class="card-desc">Protected routes for medical information, shared household tasks, and security camera access.</p>
        <a href="/family" class="card-cta">Open</a>
        <a href="/family" class="card-link">
          Open Family Hub <i class="arrow">&rarr;</i>
        </a>
      </article>`
    : '';
  const pigeonsCard = user && user.role === 'family'
    ? `
      <article class="card" onclick="window.location.href='/family/pigeons'">
        <div class="card-corner"></div>
        <div class="card-shimmer"></div>
        <div class="card-stamp">Family</div>
        <h2 class="card-title">Pigeons</h2>
        <div class="card-line"></div>
        <p class="card-desc">Room-based medicine and supplement tracking for the birds Andrew and Kaili are caring for.</p>
        <a href="/family/pigeons" class="card-cta">Open</a>
        <a href="/family/pigeons" class="card-link">
          Open Pigeons <i class="arrow">&rarr;</i>
        </a>
      </article>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Andrew Taylor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <script>
    (function() {
      var t = localStorage.getItem('homepage-theme');
      if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    })();
  </script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #1a1a1a;
      --bg-card: #222222;
      --text: #f0e8d0;
      --text-muted: rgba(240, 232, 208, 0.7);
      --accent: #e0b84a;
      --accent-light: #f0d878;
      --accent-dim: rgba(224, 184, 74, 0.3);
      --border: rgba(224, 184, 74, 0.3);
      --border-light: rgba(224, 184, 74, 0.1);
      --font-heading: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
      --font-body: 'Cormorant Garamond', Georgia, serif;
      --font-body-weight: 400;
      --heading-weight: 900;
      --heading-transform: uppercase;
      --heading-spacing: 0.15em;
      --heading-size: clamp(2rem, 5vw, 3.2rem);
      --heading-line-height: 1.2;
      --tagline-style: italic;
      --tagline-weight: 400;
      --tagline-spacing: 0.08em;
      --card-text-align: center;
      --card-padding: 44px 36px 40px;
      --card-radius: 0px;
      --page-max-width: 900px;
      --page-padding-top: 140px;
      --transition-speed: 0.4s;
    }
    [data-theme="light"] {
      --bg: #f5f0e8;
      --bg-card: #faf6ee;
      --text: #1a1a2e;
      --text-muted: #6b5e4f;
      --accent: #c44536;
      --accent-light: #d4554a;
      --accent-dim: rgba(196, 69, 54, 0.3);
      --border: #d4c9b8;
      --border-light: #e8e0d0;
      --font-heading: 'Fraunces', Georgia, serif;
      --font-body: 'Inter', Georgia, serif;
      --heading-transform: none;
      --heading-spacing: -0.02em;
      --heading-size: 3.8rem;
      --heading-line-height: 1.05;
      --tagline-spacing: 0.01em;
      --card-text-align: left;
      --card-padding: 36px 32px 32px;
      --page-max-width: 800px;
      --page-padding-top: 100px;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      font-weight: var(--font-body-weight);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      transition: background var(--transition-speed) ease, color var(--transition-speed) ease;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 18px;
      border: 1px solid var(--accent-dim);
      pointer-events: none;
      z-index: 100;
      opacity: 1;
      transition: opacity var(--transition-speed) ease;
    }
    body::after {
      content: '';
      position: fixed;
      inset: 14px;
      border: 1px solid var(--border-light);
      pointer-events: none;
      z-index: 100;
      opacity: 1;
      transition: opacity var(--transition-speed) ease;
    }
    [data-theme="light"] body::before {
      inset: 0;
      border: none;
      background-image:
        url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
      background-size: 256px 256px;
      z-index: 1000;
    }
    [data-theme="light"] body::after { opacity: 0; }
    .page {
      max-width: var(--page-max-width);
      margin: 0 auto;
      padding: var(--page-padding-top) 48px 80px;
      position: relative;
      transition: max-width var(--transition-speed) ease, padding var(--transition-speed) ease;
    }
    .theme-toggle {
      position: fixed;
      top: 28px;
      right: 28px;
      z-index: 200;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1.5px solid var(--accent-dim);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      color: var(--accent);
      transition: border-color 0.3s, color 0.3s, background 0.3s, transform 0.3s;
      line-height: 1;
    }
    .theme-toggle:hover {
      border-color: var(--accent);
      background: rgba(224, 184, 74, 0.08);
      transform: scale(1.08);
    }
    [data-theme="light"] .theme-toggle:hover { background: rgba(196, 69, 54, 0.06); }
    .theme-toggle .icon-sun,
    .theme-toggle .icon-moon { position: absolute; transition: opacity 0.3s, transform 0.3s; }
    .theme-toggle .icon-sun { opacity: 1; transform: rotate(0deg); }
    .theme-toggle .icon-moon { opacity: 0; transform: rotate(-90deg); }
    [data-theme="light"] .theme-toggle .icon-sun { opacity: 0; transform: rotate(90deg); }
    [data-theme="light"] .theme-toggle .icon-moon { opacity: 1; transform: rotate(0deg); }
    .dark-only { display: block; opacity: 1; transition: opacity var(--transition-speed) ease; }
    [data-theme="light"] .dark-only { display: none !important; }
    .light-only { display: none !important; }
    [data-theme="light"] .light-only { display: block !important; }
    .sunburst {
      display: flex;
      justify-content: center;
      margin-bottom: 40px;
      opacity: 0;
      animation: fadeIn 1s ease-out 0.1s forwards;
    }
    .sunburst-inner { position: relative; width: 60px; height: 60px; }
    .sunburst-ray {
      position: absolute;
      width: 1.5px;
      height: 28px;
      background: var(--accent);
      left: 50%;
      top: 50%;
      transform-origin: bottom center;
      opacity: 0.5;
    }
    .sunburst-ray:nth-child(1)  { transform: translateX(-50%) translateY(-100%) rotate(0deg); }
    .sunburst-ray:nth-child(2)  { transform: translateX(-50%) translateY(-100%) rotate(30deg); }
    .sunburst-ray:nth-child(3)  { transform: translateX(-50%) translateY(-100%) rotate(60deg); }
    .sunburst-ray:nth-child(4)  { transform: translateX(-50%) translateY(-100%) rotate(90deg); }
    .sunburst-ray:nth-child(5)  { transform: translateX(-50%) translateY(-100%) rotate(120deg); }
    .sunburst-ray:nth-child(6)  { transform: translateX(-50%) translateY(-100%) rotate(150deg); }
    .sunburst-ray:nth-child(7)  { transform: translateX(-50%) translateY(-100%) rotate(180deg); }
    .sunburst-ray:nth-child(8)  { transform: translateX(-50%) translateY(-100%) rotate(210deg); }
    .sunburst-ray:nth-child(9)  { transform: translateX(-50%) translateY(-100%) rotate(240deg); }
    .sunburst-ray:nth-child(10) { transform: translateX(-50%) translateY(-100%) rotate(270deg); }
    .sunburst-ray:nth-child(11) { transform: translateX(-50%) translateY(-100%) rotate(300deg); }
    .sunburst-ray:nth-child(12) { transform: translateX(-50%) translateY(-100%) rotate(330deg); }
    .sunburst-center {
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--accent);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .hero {
      text-align: center;
      margin-bottom: 64px;
      opacity: 0;
      animation: fadeIn 0.9s ease-out 0.3s forwards;
    }
    [data-theme="light"] .hero { margin-bottom: 80px; }
    .hero h1 {
      font-family: var(--font-heading);
      font-weight: var(--heading-weight);
      font-size: var(--heading-size);
      color: var(--accent);
      text-transform: var(--heading-transform);
      letter-spacing: var(--heading-spacing);
      line-height: var(--heading-line-height);
      margin-bottom: 16px;
      transition: color var(--transition-speed) ease;
    }
    [data-theme="light"] .hero h1 { color: var(--text); }
    .hero .tagline {
      font-family: var(--font-heading);
      font-style: var(--tagline-style);
      font-size: 1.15rem;
      color: var(--text-muted);
      letter-spacing: var(--tagline-spacing);
      transition: color var(--transition-speed) ease;
    }
    .divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin: 48px auto;
      max-width: 400px;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent-dim), transparent);
    }
    .divider .diamond {
      width: 8px;
      height: 8px;
      background: var(--accent);
      transform: rotate(45deg);
      flex-shrink: 0;
    }
    .rule-light {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 32px auto 0;
      max-width: 320px;
    }
    .rule-light::before,
    .rule-light::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .rule-light .ornament {
      font-size: 1.2rem;
      color: var(--accent);
      line-height: 1;
    }
    .section-label {
      text-align: center;
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--accent-dim);
      margin-bottom: 40px;
    }
    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
      margin-bottom: 64px;
    }
    [data-theme="light"] .cards { margin-bottom: 80px; }
    @media (min-width: 640px) {
      .cards { grid-template-columns: 1fr 1fr; }
      .cards .card:first-child { grid-column: 1 / -1; }
    }
    .card {
      position: relative;
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: var(--card-padding);
      text-align: var(--card-text-align);
      border-radius: var(--card-radius);
      overflow: hidden;
      opacity: 0;
      transform: scale(0.97);
      transition: background var(--transition-speed) ease, border-color var(--transition-speed) ease, box-shadow 0.3s ease;
    }
    .card.visible {
      opacity: 1;
      transform: scale(1);
      transition: opacity 0.7s ease-out, transform 0.7s ease-out, background var(--transition-speed) ease, border-color var(--transition-speed) ease;
    }
    .card--primary {
      border-width: 2px;
      border-color: var(--accent);
      cursor: pointer;
    }
    .card--primary:hover { box-shadow: 0 0 40px rgba(224, 184, 74, 0.08); }
    .card--placeholder { opacity: 0; }
    .card--placeholder.visible { opacity: 0.6; }
    .card--placeholder:hover { opacity: 0.8; }
    [data-theme="light"] .card {
      border: 2px solid var(--border);
      outline: 3px solid var(--border-light);
      outline-offset: -6px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04);
      transform: translateY(20px);
    }
    [data-theme="light"] .card.visible { transform: translateY(0); }
    [data-theme="light"] .card:hover {
      transform: translateY(-3px);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08);
    }
    [data-theme="light"] .card--primary {
      border-top: 4px solid var(--accent);
      border-left: 2px solid var(--border);
      border-right: 2px solid var(--border);
      border-bottom: 2px solid var(--border);
    }
    [data-theme="light"] .card--placeholder.visible { opacity: 0.75; }
    [data-theme="light"] .card--placeholder:hover { opacity: 0.9; }
    .card-corner {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .card::before,
    .card::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      border-color: var(--accent);
      border-style: solid;
      border-width: 0;
      transition: opacity var(--transition-speed) ease;
    }
    .card::before {
      top: 8px;
      left: 8px;
      border-top-width: 1px;
      border-left-width: 1px;
    }
    .card::after {
      top: 8px;
      right: 8px;
      border-top-width: 1px;
      border-right-width: 1px;
    }
    .card-corner::before,
    .card-corner::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      border-color: var(--accent);
      border-style: solid;
      border-width: 0;
      transition: opacity var(--transition-speed) ease;
    }
    .card-corner::before {
      bottom: 8px;
      left: 8px;
      border-bottom-width: 1px;
      border-left-width: 1px;
    }
    .card-corner::after {
      bottom: 8px;
      right: 8px;
      border-bottom-width: 1px;
      border-right-width: 1px;
    }
    [data-theme="light"] .card::before,
    [data-theme="light"] .card::after,
    [data-theme="light"] .card-corner::before,
    [data-theme="light"] .card-corner::after { opacity: 0; }
    .card-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 40%, rgba(224,184,74,0.04) 48%, rgba(224,184,74,0.08) 50%, rgba(224,184,74,0.04) 52%, transparent 60%);
      transform: translateX(-100%);
      transition: transform 0.7s ease;
      pointer-events: none;
    }
    .card:hover .card-shimmer { transform: translateX(100%); }
    [data-theme="light"] .card-shimmer { display: none; }
    .card-title {
      font-family: var(--font-heading);
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--accent);
      text-transform: var(--heading-transform);
      letter-spacing: 0.12em;
      margin-bottom: 6px;
      position: relative;
      transition: color var(--transition-speed) ease;
    }
    [data-theme="light"] .card-title {
      font-size: 1.35rem;
      letter-spacing: 0.04em;
      color: var(--text);
    }
    .card-line {
      width: 40px;
      height: 1px;
      background: var(--accent-dim);
      margin: 14px auto;
      transition: opacity var(--transition-speed) ease;
    }
    [data-theme="light"] .card-line { display: none; }
    .card-desc {
      font-family: var(--font-body);
      font-size: 0.95rem;
      color: var(--text-muted);
      line-height: 1.65;
      max-width: 480px;
      position: relative;
      transition: color var(--transition-speed) ease;
    }
    [data-theme="light"] .card-desc {
      font-size: 0.88rem;
      line-height: 1.55;
    }
    [data-theme="light"] .card--primary .card-desc { margin: 0; }
    .card-cta {
      display: inline-block;
      margin-top: 22px;
      padding: 10px 28px;
      border: 1px solid var(--accent);
      background: transparent;
      font-family: 'Cinzel Decorative', serif;
      font-weight: 400;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: var(--accent);
      text-decoration: none;
      transition: background 0.3s, color 0.3s;
      position: relative;
    }
    .card-cta:hover {
      background: var(--accent);
      color: var(--bg);
    }
    [data-theme="light"] .card-cta { display: none; }
    .card-link { display: none; }
    [data-theme="light"] .card-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
      text-decoration: none;
      transition: gap 0.3s ease;
    }
    [data-theme="light"] .card-link:hover { gap: 14px; }
    .card-link .arrow { font-style: normal; transition: transform 0.3s ease; }
    [data-theme="light"] .card-link:hover .arrow { transform: translateX(2px); }
    .card-forthcoming {
      display: inline-block;
      margin-top: 18px;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 600;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      color: var(--accent-dim);
      position: relative;
    }
    [data-theme="light"] .card-forthcoming { display: none; }
    .card-stamp { display: none; }
    [data-theme="light"] .card-stamp {
      display: block;
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--accent);
      color: var(--bg-card);
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700;
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      padding: 5px 10px;
      transform: rotate(-3deg);
      border: 1.5px dashed rgba(255,255,255,0.4);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    [data-theme="light"] .card:hover .card-stamp { transform: rotate(-1deg); }
    [data-theme="light"] .card-stamp--muted { background: var(--text-muted); }
    .bottom-rule {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 40px;
      max-width: 200px;
      margin-left: auto;
      margin-right: auto;
    }
    .bottom-rule::before,
    .bottom-rule::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .bottom-rule .ornament { font-size: 0.7rem; color: var(--border); }
    .access-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 22px;
      padding: 10px 14px;
      border: 1px solid var(--accent-dim);
      color: var(--text-muted);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.02);
    }
    .access-badge strong { color: var(--accent); font-weight: 700; }
    [data-theme="light"] .access-badge {
      background: rgba(255, 255, 255, 0.8);
      border-color: var(--border);
      color: var(--text-muted);
    }
    .footer-divider { margin-bottom: 32px; }
    footer {
      text-align: center;
      padding-bottom: 60px;
      opacity: 0;
      animation: fadeIn 0.8s ease-out 0.9s forwards;
    }
    footer p {
      font-family: var(--font-body);
      font-weight: 500;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--accent-dim);
      transition: color var(--transition-speed) ease;
    }
    [data-theme="light"] footer p {
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: none;
      color: var(--text-muted);
    }
    footer a { color: var(--accent-dim); text-decoration: none; transition: color 0.3s; }
    footer a:hover { color: var(--accent); }
    [data-theme="light"] footer a {
      color: var(--text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 768px) {
      body::before { inset: 10px; }
      body::after { inset: 6px; }
      .page { padding: 100px 28px 60px; }
      .hero h1 { font-size: 1.8rem; letter-spacing: 0.1em; }
      .sunburst-inner { width: 40px; height: 40px; }
      .sunburst-ray { height: 18px; }
      .card { padding: 32px 24px 28px; }
      .theme-toggle { top: 16px; right: 16px; width: 38px; height: 38px; font-size: 1rem; }
      [data-theme="light"] .page { padding: 64px 20px 40px; }
      [data-theme="light"] .hero h1 { font-size: 2.6rem; letter-spacing: -0.02em; }
      [data-theme="light"] .card { padding: 28px 24px 24px; }
    }
    @media (max-width: 480px) {
      .hero h1 { font-size: 1.5rem; }
      .hero .tagline { font-size: 0.95rem; }
      .card-title { font-size: 0.95rem; letter-spacing: 0.08em; }
      [data-theme="light"] .hero h1 { font-size: 2.1rem; }
      [data-theme="light"] .hero .tagline { font-size: 1rem; }
      [data-theme="light"] .card-title { font-size: 1.2rem; letter-spacing: 0.04em; }
    }
  </style>
</head>
<body>
  <button class="theme-toggle" aria-label="Toggle theme" title="Switch theme">
    <span class="icon-sun">&#9788;</span>
    <span class="icon-moon">&#9790;</span>
  </button>
  <div class="page">
    <div class="sunburst dark-only">
      <div class="sunburst-inner">
        <div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div>
        <div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div>
        <div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div><div class="sunburst-ray"></div>
        <div class="sunburst-center"></div>
      </div>
    </div>
    <header class="hero">
      <h1>Andrew Taylor</h1>
      <p class="tagline">Builder &middot; Investor &middot; Explorer</p>
      <p class="access-badge">Access Tier <strong>${roleLabel}</strong></p>
      <div class="rule-light light-only">
        <span class="ornament">&#10043;</span>
      </div>
    </header>
    <div class="divider dark-only">
      <span class="diamond"></span>
    </div>
    <p class="section-label dark-only">Explore</p>
    <section class="cards">
      <article class="card card--primary" onclick="window.location.href='/dashboard'">
        <div class="card-corner"></div>
        <div class="card-shimmer"></div>
        <div class="card-stamp">Live</div>
        <h2 class="card-title">Stock Dashboard</h2>
        <div class="card-line"></div>
        <p class="card-desc">${dashboardDescription}</p>
        <a href="/dashboard" class="card-cta">Enter</a>
        <a href="/dashboard" class="card-link">
          Open Dashboard <i class="arrow">&rarr;</i>
        </a>
      </article>
      ${familyCard}
      ${pigeonsCard}
      <article class="card card--placeholder">
        <div class="card-corner"></div>
        <div class="card-shimmer"></div>
        <div class="card-stamp card-stamp--muted">Soon</div>
        <h2 class="card-title">Projects</h2>
        <div class="card-line"></div>
        <p class="card-desc">Code, experiments, and things being built.</p>
        <span class="card-forthcoming">Forthcoming</span>
      </article>
      <article class="card" onclick="window.location.href='/writing'">
        <div class="card-corner"></div>
        <div class="card-shimmer"></div>
        <div class="card-stamp">Writing</div>
        <h2 class="card-title">Writing</h2>
        <div class="card-line"></div>
        <p class="card-desc">Thoughts on investing, technology, and curiosities.</p>
        <a href="/writing" class="card-cta">Open</a>
        <a href="/writing" class="card-link">
          Read articles <i class="arrow">&rarr;</i>
        </a>
      </article>
    </section>
    <div class="bottom-rule light-only">
      <span class="ornament">&#9670;</span>
    </div>
    <div class="divider footer-divider dark-only">
      <span class="diamond"></span>
    </div>
    <footer>
      <p>&copy; 2026 Andrew Taylor &middot; <a href="/privacy">Privacy</a></p>
    </footer>
  </div>
  <script>
    const toggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('homepage-theme', next);
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = Array.from(entry.target.parentElement.children).indexOf(entry.target);
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, idx * 160);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.card').forEach(card => observer.observe(card));
  </script>
</body>
</html>`;
}

module.exports = {
  getDashboardDescription,
  getPortfolioPositionCount,
  renderHomePage,
};

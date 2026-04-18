const fs = require('fs');
const path = require('path');

function assetVersion(relativePath) {
  try {
    const assetPath = path.join(__dirname, '..', 'public', relativePath);
    return String(Math.floor(fs.statSync(assetPath).mtimeMs));
  } catch (err) {
    return '1';
  }
}

function renderAnimalsPage(user) {
  const userName = user && user.email ? user.email.split('@')[0] : 'family';
  const cssVersion = assetVersion('css/animals.css');
  const jsVersion = assetVersion('js/animals.js');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Animals</title>
  <link rel="stylesheet" href="/css/animals.css?v=${cssVersion}">
</head>
<body>
  <main class="animal-page">
    <div class="topbar">
      <a href="/family">&larr; Family Hub</a>
      <a href="/">Home</a>
    </div>
    <header>
      <div class="eyebrow">Family Animals</div>
      <h1>Animals</h1>
      <p class="lead">Medication and care tracking for pets and pigeons.</p>
    </header>

    <section class="summary-grid" id="animal-summary-grid"></section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <h2>Needs Medication</h2>
          <p>Pets and pigeons due now or today.</p>
        </div>
        <button class="ghost" data-action="refresh">Refresh</button>
      </div>
      <div class="dose-list" id="animal-due-list"></div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <h2>Completed Today</h2>
          <p>Medication already recorded today.</p>
        </div>
      </div>
      <div class="dose-list" id="animal-completed-list"></div>
    </section>

    <section class="section-block">
      <div class="animal-section-grid">
        <a class="section-card" href="/family/animals/pets">
          <span class="section-icon">Pets</span>
          <strong>Pets</strong>
          <span>Dogs, cats, preventatives, notes, weights, and photos.</span>
        </a>
        <a class="section-card" href="/family/animals/pigeons">
          <span class="section-icon">Pigeons</span>
          <strong>Pigeons</strong>
          <span>Room-first bird care, medication, notes, weights, and photos.</span>
        </a>
      </div>
    </section>
  </main>
  <div class="toast" id="toast"></div>
  <script>window.ANIMAL_USER = ${JSON.stringify(userName)};</script>
  <script src="/js/animals.js?v=${jsVersion}"></script>
</body>
</html>`;
}

module.exports = {
  renderAnimalsPage,
};

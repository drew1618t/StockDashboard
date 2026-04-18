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

function renderPetsPage(user) {
  const userName = user && user.email ? user.email.split('@')[0] : 'family';
  const cssVersion = assetVersion('css/animals.css');
  const jsVersion = assetVersion('js/pets.js');
  const chartVersion = assetVersion('vendor/chart.umd.min.js');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pets</title>
  <link rel="stylesheet" href="/css/animals.css?v=${cssVersion}">
</head>
<body>
  <main class="animal-page pet-page">
    <div class="topbar">
      <a href="/family/animals">&larr; Animals</a>
      <a href="/">Home</a>
    </div>
    <header>
      <div class="eyebrow">Family Pets</div>
      <h1>Pets</h1>
      <p class="lead">Medicine, preventatives, notes, weights, and photos for cats and dogs.</p>
    </header>

    <section class="summary-grid" id="pet-summary-grid"></section>

    <section class="view active" id="view-overview">
      <div class="section-head">
        <div>
          <h2>Overview</h2>
          <p>What needs attention today.</p>
        </div>
        <button class="ghost" data-action="refresh">Refresh</button>
      </div>
      <div class="dose-list" id="pet-due-list"></div>
      <div class="section-head"><div><h3>Completed today</h3></div></div>
      <div class="dose-list" id="pet-completed-list"></div>
      <div class="section-head"><div><h3>No meds today</h3></div></div>
      <div class="dose-list" id="pet-skipped-list"></div>
    </section>

    <section class="view" id="view-pets">
      <div class="section-head">
        <div>
          <h2>Pets</h2>
          <p>Search by name, type, breed, notes, or medication history.</p>
        </div>
      </div>
      <div class="filters">
        <label>Search <input id="pet-search" type="search" placeholder="Name, breed, notes..."></label>
        <label>Type <select id="pet-type-filter">
          <option value="">All types</option>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
          <option value="other">Other</option>
        </select></label>
        <label>Status <select id="pet-status-filter">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deceased">Deceased</option>
        </select></label>
      </div>
      <div class="animal-list" id="pet-list"></div>
    </section>

    <section class="view" id="view-add">
      <div class="section-head">
        <div>
          <h2>New Pet</h2>
          <p>Add the profile first, then add medications, notes, weights, and photos.</p>
        </div>
      </div>
      <form class="panel" id="new-pet-form">
        <div class="form-grid" id="new-pet-fields"></div>
        <div class="form-actions"><button class="primary" type="submit">Save Pet</button></div>
      </form>
    </section>

    <section class="view" id="view-stats">
      <div class="section-head">
        <div>
          <h2>Stats</h2>
          <p>Pet and medication counts.</p>
        </div>
      </div>
      <div class="stats-grid" id="pet-stats-grid"></div>
    </section>

    <section class="view" id="view-detail">
      <div id="pet-detail"></div>
    </section>
  </main>

  <nav class="bottom-nav">
    <button class="active" data-view="overview">Overview</button>
    <button data-view="pets">Pets</button>
    <button data-view="add">Add Pet</button>
    <button data-view="stats">Stats</button>
  </nav>

  <div class="modal-backdrop" id="modal-backdrop">
    <div class="modal">
      <h3 id="modal-title">Confirm</h3>
      <p class="lead" id="modal-message"></p>
      <div class="modal-actions">
        <button class="ghost" data-modal-answer="false">Cancel</button>
        <button class="danger" id="modal-confirm" data-modal-answer="true">Confirm</button>
      </div>
    </div>
  </div>
  <div class="toast" id="toast"></div>
  <script>window.PET_USER = ${JSON.stringify(userName)};</script>
  <script src="/vendor/chart.umd.min.js?v=${chartVersion}"></script>
  <script src="/js/pets.js?v=${jsVersion}"></script>
</body>
</html>`;
}

module.exports = {
  renderPetsPage,
};

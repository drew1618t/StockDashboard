function renderPigeonsPage(user) {
  const userName = user && user.email ? user.email.split('@')[0] : 'family';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pigeons</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/pigeons.css">
</head>
<body>
  <main class="pigeon-page">
    <div class="topbar">
      <a href="/family">&larr; Family Hub</a>
      <a href="/">Home</a>
    </div>
    <header>
      <div class="eyebrow">Family Pigeons</div>
      <h1>Pigeons</h1>
      <p class="lead">Room-first medicine and supplement tracking for the birds you're caring for.</p>
    </header>

    <section class="summary-grid" id="summary-grid"></section>

    <section class="view active" id="view-rooms">
      <div class="section-head">
        <div>
          <h2>Rooms</h2>
          <p>Bring everything needed before walking into a room.</p>
        </div>
        <button class="ghost" data-action="refresh">Refresh</button>
      </div>
      <form class="room-add" id="add-room-form">
        <input name="name" placeholder="New room name..." required>
        <button class="primary" type="submit">Add Room</button>
      </form>
      <label class="inline-check">
        <input type="checkbox" id="show-all-active">
        Show all active meds
      </label>
      <div class="room-list" id="room-list"></div>
    </section>

    <section class="view" id="view-birds">
      <div class="section-head">
        <div>
          <h2>Birds</h2>
          <p>Search by bird, room, species, notes, or condition.</p>
        </div>
      </div>
      <div class="filters">
        <label>Search <input id="bird-search" type="search" placeholder="Blue, Computer Room..."></label>
        <label>Room <select id="bird-location-filter"></select></label>
        <label>Status <select id="bird-status-filter">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="critical">Critical</option>
          <option value="ready_for_release">Ready for release</option>
          <option value="permanent_resident">Permanent resident</option>
          <option value="released">Released</option>
          <option value="deceased">Deceased</option>
        </select></label>
      </div>
      <div class="bird-list" id="bird-list"></div>
    </section>

    <section class="view" id="view-add">
      <div class="section-head">
        <div>
          <h2>New Bird</h2>
          <p>Medication can be added now, and photos can be uploaded after the bird is saved.</p>
        </div>
      </div>
      <form class="panel" id="new-bird-form">
        <div class="form-grid" id="new-bird-fields"></div>
        <h3 class="form-section-title">Optional first med or supplement</h3>
        <div class="form-grid">
          <label>Type <select name="first_med_kind"><option value="medication">Medication</option><option value="supplement">Supplement</option></select></label>
          <label class="span-2">Name <input name="first_med_name" placeholder="Baytril, calcium, vitamin..."></label>
          <label>Dosage <input name="first_med_dosage" placeholder="0.1ml oral"></label>
          <label>Times per day <select name="first_med_frequency"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label>Start <input name="first_med_start_date" type="date"></label>
          <label>End <input name="first_med_end_date" type="date"></label>
          <label class="span-3">Notes <textarea name="first_med_notes" placeholder="Optional med notes"></textarea></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Save Bird</button></div>
      </form>
    </section>

    <section class="view" id="view-stats">
      <div class="section-head">
        <div>
          <h2>Stats</h2>
          <p>Rehab and medication counts at a glance.</p>
        </div>
      </div>
      <div class="stats-grid" id="stats-grid"></div>
    </section>

    <section class="view" id="view-detail">
      <div id="bird-detail"></div>
    </section>
  </main>

  <nav class="bottom-nav">
    <button class="active" data-view="rooms">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Rooms
    </button>
    <button data-view="birds">
      <svg viewBox="0 0 48 48"><path d="M12 29c4.5-10.5 13.5-15 24-12.5-2.5 9.5-8.5 16-19 16.5l-6 5"/><path d="M24 18c-2-4.5-5.5-7-10.5-7.5 1.2 4.5 3.8 7.5 8 9"/><path d="M34 17l6-3-3.5 5"/><path d="M23 33l-2.5 6"/><path d="M28 32l2 6"/><circle cx="31.5" cy="19.5" r="1"/></svg>
      Birds
    </button>
    <button data-view="add">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Bird
    </button>
    <button data-view="stats">
      <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      Stats
    </button>
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
  <script>window.PIGEON_USER = ${JSON.stringify(userName)};</script>
  <script src="/vendor/chart.umd.min.js"></script>
  <script src="/js/pigeons.js"></script>
</body>
</html>`;
}

module.exports = {
  renderPigeonsPage,
};

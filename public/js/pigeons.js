const PigeonApp = {
  state: {
    summary: null,
    locations: [],
    birds: [],
    currentBird: null,
    confirmResolve: null,
    birdLoadTimer: null,
  },

  init() {
    document.querySelectorAll('.bottom-nav button').forEach(button => {
      button.addEventListener('click', () => this.showView(button.dataset.view));
    });
    document.querySelector('[data-action="refresh"]').addEventListener('click', () => this.loadAll());
    document.getElementById('show-all-active').addEventListener('change', () => this.renderRooms());
    document.getElementById('bird-search').addEventListener('input', () => this.loadBirds());
    document.getElementById('bird-location-filter').addEventListener('change', () => this.loadBirds());
    document.getElementById('bird-status-filter').addEventListener('change', () => this.loadBirds());
    document.getElementById('new-bird-form').addEventListener('submit', event => this.createBird(event));
    document.getElementById('add-room-form').addEventListener('submit', event => this.createRoom(event));
    document.querySelectorAll('[data-modal-answer]').forEach(button => {
      button.addEventListener('click', () => this.closeModal(button.dataset.modalAnswer === 'true'));
    });
    this.loadAll().catch(err => this.showToast(err.message));
  },

  esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  formatDateTime(value) {
    if (!value) return '';
    return String(value).replace('T', ' ').slice(0, 16);
  },

  async api(path, options = {}) {
    const res = await fetch(path, options);
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch (err) { /* ignore */ }
      throw new Error(body.error || 'Request failed');
    }
    return res.status === 204 ? null : res.json();
  },

  showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('open');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('open'), 2200);
  },

  confirmModal(title, message, label) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').textContent = label || 'Confirm';
    document.getElementById('modal-backdrop').classList.add('open');
    return new Promise(resolve => {
      this.state.confirmResolve = resolve;
    });
  },

  closeModal(answer) {
    document.getElementById('modal-backdrop').classList.remove('open');
    if (this.state.confirmResolve) this.state.confirmResolve(!!answer);
    this.state.confirmResolve = null;
  },

  showView(view) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.querySelectorAll('.bottom-nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'birds') this.loadBirds();
    if (view === 'stats') this.renderStats();
    if (view === 'add') this.fillBirdForm('new-bird-fields', {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  statusDotColor(status) {
    const colors = {
      active: '#7A9E7E',
      critical: '#D4A03C',
      ready_for_release: '#5B8FAF',
      permanent_resident: '#7A9E7E',
      released: '#8B9E8B',
      deceased: '#999',
    };
    return colors[status] || '#999';
  },

  statusDotSvg(status) {
    const color = this.statusDotColor(status);
    return `<svg class="status-dot" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="${color}"/></svg>`;
  },

  metric(label, value, hot = false) {
    const cls = hot ? ' danger' : '';
    return `<div class="metric${cls}"><div class="metric-value">${this.esc(value)}</div><div class="metric-label">${this.esc(label)}</div></div>`;
  },

  renderSummary() {
    const s = this.state.summary || {};
    const overdue = (s.overdueDoses || []).length;
    document.getElementById('summary-grid').innerHTML =
      this.metric('Overdue', overdue, overdue > 0) +
      this.metric('Due today', (s.dueTodayDoses || []).length) +
      this.metric('Active birds', s.activeBirds || 0) +
      this.metric('Active meds', s.activeMeds || 0);
  },

  renderRooms() {
    const showAll = document.getElementById('show-all-active').checked;
    const rooms = (this.state.summary && this.state.summary.roomGroups) || [];
    const list = document.getElementById('room-list');
    if (!rooms.length) {
      list.innerHTML = '<div class="panel muted">No rooms or birds yet.</div>';
      return;
    }
    list.innerHTML = rooms.map(room => {
      const due = room.dueDoses || [];
      const active = room.activeMeds || [];
      const dueHtml = due.length
        ? due.map(dose => this.renderDose(dose)).join('')
        : '<p class="muted small">No doses due or overdue.</p>';
      const activeHtml = active.map(med => `
        <div class="med-card">
          <div class="row">
            <div>
              <strong>${this.esc(med.bird_name || med.case_number)}</strong>
              <div class="muted small">${this.esc(med.kind)}: ${this.esc(med.name)} ${this.esc(med.dosage || '')}</div>
            </div>
            <span class="pill">${this.esc(med.frequency_per_day)}x/day</span>
          </div>
        </div>
      `).join('');
      return `
        <article class="room-card">
          <div class="room-head">
            <div>
              <h3>${this.esc(room.location_name)}</h3>
              <div class="muted small">${this.esc(room.bird_count || 0)} birds, ${this.esc(room.active_med_count || 0)} active meds</div>
            </div>
            <span class="pill ${due.length ? 'hot' : 'ok'}">${due.length} due</span>
          </div>
          ${dueHtml}
          <div class="active-med-list ${showAll ? 'open' : ''}">${activeHtml || '<div class="muted small">No active meds.</div>'}</div>
        </article>`;
    }).join('');
  },

  renderDose(dose) {
    return `
      <div class="dose-row ${dose.overdue ? 'overdue' : ''}">
        <div>
          <div class="dose-bird">${this.esc(dose.bird_name || dose.case_number)}</div>
          <div class="dose-med">${this.esc(dose.kind)}: ${this.esc(dose.name)} ${this.esc(dose.dosage || '')}</div>
          <div class="dose-time ${dose.overdue ? 'overdue' : 'due'}">${dose.overdue ? 'Overdue' : 'Due'}: ${this.esc(this.formatDateTime(dose.scheduled_datetime))}</div>
        </div>
        <button class="primary" data-action="mark-dose" data-med-id="${Number(dose.medication_id)}" data-log-id="${Number(dose.log_id)}">Mark given</button>
      </div>`;
  },

  renderLocationOptions(selected = '', includeAll = false) {
    const all = includeAll ? '<option value="">All rooms</option>' : '';
    return all + this.state.locations.map(loc =>
      `<option value="${Number(loc.id)}"${String(loc.id) === String(selected) ? ' selected' : ''}>${this.esc(loc.name)}</option>`
    ).join('');
  },

  statusOptions(selected = 'active') {
    return ['active', 'critical', 'ready_for_release', 'permanent_resident', 'released', 'deceased']
      .map(status => `<option value="${status}"${status === selected ? ' selected' : ''}>${status.replace(/_/g, ' ')}</option>`)
      .join('');
  },

  birdFieldsHtml(bird = {}) {
    return `
      <label>Name <input name="name" value="${this.esc(bird.name || '')}" placeholder="Bird name"></label>
      <label>Species <input name="species" value="${this.esc(bird.species || 'Feral Pigeon')}"></label>
      <label>Room <select name="current_location_id">${this.renderLocationOptions(bird.current_location_id || '', false)}</select></label>
      <label>Status <select name="status">${this.statusOptions(bird.status || 'active')}</select></label>
      <label>Intake date <input type="date" name="intake_date" value="${this.esc(bird.intake_date || this.today())}"></label>
      <label>Found location <input name="location_found" value="${this.esc(bird.location_found || '')}"></label>
      <label>Initial weight <input type="number" step="0.1" name="initial_weight" value="${this.esc(bird.initial_weight || '')}"></label>
      <label>Breathing <input name="breathing" value="${this.esc(bird.breathing || '')}" placeholder="normal"></label>
      <label>Hydration <input name="hydration" value="${this.esc(bird.hydration || '')}" placeholder="good"></label>
      <label>Weight assessment <input name="weight_assessment" value="${this.esc(bird.weight_assessment || '')}"></label>
      <label>Injury type <input name="injury_type" value="${this.esc(bird.injury_type || '')}"></label>
      <label>Alert level <input name="alert_level" value="${this.esc(bird.alert_level || '')}"></label>
      <label class="span-3">Initial condition <textarea name="initial_condition">${this.esc(bird.initial_condition || '')}</textarea></label>
      <label class="span-3">Notes <textarea name="notes">${this.esc(bird.notes || '')}</textarea></label>`;
  },

  fillBirdForm(containerId, bird = {}) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = this.birdFieldsHtml(bird);
    const firstStart = document.querySelector('[name="first_med_start_date"]');
    const firstEnd = document.querySelector('[name="first_med_end_date"]');
    if (firstStart && !firstStart.value) firstStart.value = this.today();
    if (firstEnd && !firstEnd.value) firstEnd.value = this.today();
  },

  formToObject(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (value !== '') data[key] = value;
    });
    return data;
  },

  async createRoom(event) {
    event.preventDefault();
    const form = event.target;
    try {
      const room = await this.api('/api/family/pigeons/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(form)),
      });
      form.reset();
      this.showToast(`Room added: ${room.name}`);
      await this.loadAll();
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async createBird(event) {
    event.preventDefault();
    const form = event.target;
    const data = this.formToObject(form);
    const firstMed = data.first_med_name ? {
      kind: data.first_med_kind || 'medication',
      name: data.first_med_name,
      dosage: data.first_med_dosage || '',
      frequency_per_day: data.first_med_frequency || 1,
      start_date: data.first_med_start_date || this.today(),
      end_date: data.first_med_end_date || data.first_med_start_date || this.today(),
      notes: data.first_med_notes || '',
    } : null;
    Object.keys(data).forEach(key => {
      if (key.startsWith('first_med_')) delete data[key];
    });

    try {
      const bird = await this.api('/api/family/pigeons/birds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (firstMed) {
        await this.api(`/api/family/pigeons/birds/${bird.id}/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firstMed),
        });
      }
      form.reset();
      this.showToast('Bird saved');
      await this.loadAll();
      await this.openBird(bird.id);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async updateBird(event) {
    event.preventDefault();
    if (!this.state.currentBird) return;
    try {
      await this.api(`/api/family/pigeons/birds/${this.state.currentBird.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(event.target)),
      });
      this.showToast('Bird updated');
      const id = this.state.currentBird.id;
      await this.loadAll();
      await this.openBird(id);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async deleteBird(id) {
    const ok = await this.confirmModal('Delete bird', 'Delete this bird and its medications/photos from the tracker?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/pigeons/birds/${id}`, { method: 'DELETE' });
    this.showToast('Bird deleted');
    await this.loadAll();
    this.showView('birds');
  },

  renderBirds() {
    const list = document.getElementById('bird-list');
    if (!this.state.birds.length) {
      list.innerHTML = '<div class="panel muted">No birds match this view.</div>';
      return;
    }
    list.innerHTML = this.state.birds.map(bird => {
      const img = bird.first_photo
        ? `<img class="bird-photo" src="${this.esc(bird.first_photo)}" alt="">`
        : `<div class="bird-photo">${this.esc((bird.name || bird.case_number || '?').slice(0, 1).toUpperCase())}</div>`;
      const statusLabel = (bird.status || '').replace(/_/g, ' ');
      const noRoom = ['released', 'deceased'].includes(bird.status);
      const roomText = noRoom ? '' : (bird.location_name || 'Unassigned');
      return `
        <article class="bird-card" data-action="open-bird" data-bird-id="${Number(bird.id)}">
          ${img}
          <div>
            <div class="bird-line-1">
              <span class="bird-name">${this.esc(bird.name || 'Unnamed')}</span>
              <span class="muted small">${this.esc(bird.species)}</span>
            </div>
            <div class="bird-line-2">
              <span class="bird-status">${this.statusDotSvg(bird.status)}${this.esc(statusLabel)}</span>
              ${roomText ? `<span>${this.esc(roomText)}</span>` : ''}
              ${noRoom ? '' : `<span>${this.esc(bird.active_med_count || 0)} meds</span>`}
            </div>
          </div>
        </article>`;
    }).join('');
  },

  async openBird(id) {
    this.state.currentBird = await this.api(`/api/family/pigeons/birds/${id}`);
    this.renderBirdDetail();
    this.showView('detail');
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
  },

  renderBirdDetail() {
    const b = this.state.currentBird;
    const photos = (b.photos || []).map(photo => this.renderPhoto(photo)).join('') || '<div class="panel muted">No photos yet.</div>';
    const meds = (b.medications || []).map(med => this.renderMed(med)).join('') || '<div class="panel muted">No medications or supplements yet.</div>';
    document.getElementById('bird-detail').innerHTML = `
      <div class="section-head">
        <div>
          <h2>${this.esc(b.name || 'Unnamed')}</h2>
          <p>${this.esc(b.case_number)} - ${this.esc(b.species)} - ${this.esc(b.location_name || 'Unassigned')}</p>
        </div>
        <button data-view-jump="birds">Back</button>
      </div>
      <form class="panel" data-form="edit-bird">
        <div class="form-grid">${this.birdFieldsHtml(b)}</div>
        <div class="row form-actions">
          <button class="primary" type="submit">Save Changes</button>
          <button class="danger" type="button" data-action="delete-bird" data-bird-id="${Number(b.id)}">Delete Bird</button>
        </div>
      </form>
      <div class="section-head"><div><h3>Meds and supplements</h3><p>Stop or delete a medication when the plan changes.</p></div></div>
      ${this.medicationForm()}
      <div class="med-list">${meds}</div>
      <div class="section-head"><div><h3>Photos</h3><p>Upload photos from the phone camera or library.</p></div></div>
      ${this.photoForm()}
      <div class="photo-grid">${photos}</div>`;
    document.querySelector('[data-form="edit-bird"]').addEventListener('submit', event => this.updateBird(event));
    document.querySelector('[data-form="add-medication"]').addEventListener('submit', event => this.addMedication(event));
    document.querySelector('[data-form="upload-photo"]').addEventListener('submit', event => this.uploadPhoto(event));
  },

  medicationForm() {
    return `
      <form class="panel" data-form="add-medication">
        <div class="form-grid">
          <label>Type <select name="kind"><option value="medication">Medication</option><option value="supplement">Supplement</option></select></label>
          <label class="span-2">Name <input name="name" required></label>
          <label>Dosage <input name="dosage"></label>
          <label>Times per day <select name="frequency_per_day"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label>Start <input type="date" name="start_date" value="${this.today()}"></label>
          <label>End <input type="date" name="end_date" value="${this.today()}"></label>
          <label class="span-3">Notes <textarea name="notes"></textarea></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Add med</button></div>
      </form>`;
  },

  photoForm() {
    return `
      <form class="panel" data-form="upload-photo">
        <div class="form-grid">
          <label class="span-2">Photo <input type="file" name="photos" accept="image/*" capture="environment" required></label>
          <label>Type <select name="photo_type"><option value="progress">Progress</option><option value="intake">Intake</option><option value="release">Release</option></select></label>
          <label class="span-3">Description <input name="description"></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Upload Photo</button></div>
      </form>`;
  },

  renderMed(med) {
    const progress = med.total_doses ? Math.round((med.doses_given / med.total_doses) * 100) : 0;
    return `
      <article class="med-card">
        <div class="med-head">
          <div><h3>${this.esc(med.name)}</h3><div class="muted small">${this.esc(med.kind)} - ${this.esc(med.dosage || 'no dosage')}</div></div>
          <span class="pill ${med.active ? 'ok' : ''}">${med.active ? 'Active' : 'Stopped'}</span>
        </div>
        <div class="pill-row">
          <span class="pill">${this.esc(med.frequency_per_day)}x/day</span>
          <span class="pill">${this.esc(med.start_date)} to ${this.esc(med.end_date || '')}</span>
          <span class="pill ${med.overdue_count ? 'hot' : ''}">${this.esc(med.overdue_count || 0)} overdue</span>
          <span class="pill">${this.esc(med.doses_given || 0)}/${this.esc(med.total_doses || 0)} doses</span>
        </div>
        <div class="progress"><div style="width:${progress}%"></div></div>
        <div class="row form-actions">
          <button class="primary" data-action="mark-dose" data-med-id="${Number(med.id)}">Ad-hoc dose</button>
          <div>
            <button type="button" data-action="stop-med" data-med-id="${Number(med.id)}">Stop</button>
            <button class="danger" type="button" data-action="delete-med" data-med-id="${Number(med.id)}">Delete</button>
          </div>
        </div>
      </article>`;
  },

  renderPhoto(photo) {
    return `
      <article class="photo-card">
        <img src="${this.esc(photo.photo_path)}" alt="">
        <div>
          <div class="muted small">${this.esc(photo.photo_type || 'progress')} - ${this.esc(this.formatDateTime(photo.upload_date))}</div>
          <div>${this.esc(photo.description || '')}</div>
          <button class="danger" type="button" data-action="delete-photo" data-photo-id="${Number(photo.id)}">Delete</button>
        </div>
      </article>`;
  },

  async addMedication(event) {
    event.preventDefault();
    if (!this.state.currentBird) return;
    try {
      await this.api(`/api/family/pigeons/birds/${this.state.currentBird.id}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(event.target)),
      });
      event.target.reset();
      this.showToast('Medication added');
      const id = this.state.currentBird.id;
      await this.loadAll();
      await this.openBird(id);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async stopMedication(id) {
    const ok = await this.confirmModal('Stop medication', 'Stop this medication early? You can still see it as stopped.', 'Stop');
    if (!ok) return;
    await this.api(`/api/family/pigeons/medications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 0 }),
    });
    this.showToast('Medication stopped');
    await this.refreshAfterDetailChange();
  },

  async deleteMedication(id) {
    const ok = await this.confirmModal('Delete medication', 'Delete this medication and all of its dose history?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/pigeons/medications/${id}`, { method: 'DELETE' });
    this.showToast('Medication deleted');
    await this.refreshAfterDetailChange();
  },

  async markDoseGiven(medId, logId) {
    await this.api(`/api/family/pigeons/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logId ? { log_id: logId } : {}),
    });
    this.showToast('Dose recorded');
    await this.refreshAfterDetailChange();
  },

  async uploadPhoto(event) {
    event.preventDefault();
    if (!this.state.currentBird) return;
    const res = await fetch(`/api/family/pigeons/birds/${this.state.currentBird.id}/photos`, {
      method: 'POST',
      body: new FormData(event.target),
    });
    if (!res.ok) throw new Error('Photo upload failed');
    event.target.reset();
    this.showToast('Photo uploaded');
    await this.refreshAfterDetailChange();
  },

  async deletePhoto(id) {
    const ok = await this.confirmModal('Delete photo', 'Delete this photo from the tracker?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/pigeons/photos/${id}`, { method: 'DELETE' });
    this.showToast('Photo deleted');
    await this.refreshAfterDetailChange();
  },

  async refreshAfterDetailChange() {
    const birdId = this.state.currentBird && this.state.currentBird.id;
    await this.loadAll();
    if (birdId) await this.openBird(birdId);
  },

  renderStats() {
    const s = this.state.summary || {};
    const statusCounts = {};
    (s.byStatus || []).forEach(row => { statusCounts[row.status] = row.count; });
    const roomHtml = (s.byRoom || []).map(r => `<div class="row small"><span>${this.esc(r.location_name)}</span><strong>${this.esc(r.count)}</strong></div>`).join('');
    const speciesHtml = (s.bySpecies || []).map(r => `<div class="row small"><span>${this.esc(r.species)}</span><strong>${this.esc(r.count)}</strong></div>`).join('');
    const medRoomHtml = (s.activeMedsByRoom || []).map(r => `<div class="row small"><span>${this.esc(r.location_name)}</span><strong>${this.esc(r.count)}</strong></div>`).join('');
    document.getElementById('stats-grid').innerHTML =
      this.metric('Total birds', s.total || 0) +
      this.metric('Active', statusCounts.active || 0) +
      this.metric('Critical', statusCounts.critical || 0, (statusCounts.critical || 0) > 0) +
      this.metric('Residents', statusCounts.permanent_resident || 0) +
      this.metric('Released', statusCounts.released || 0) +
      this.metric('Deceased', statusCounts.deceased || 0) +
      `<div class="panel"><h3>Birds by room</h3><div class="stat-list">${roomHtml || '<span class="muted">No data</span>'}</div></div>` +
      `<div class="panel"><h3>Birds by species</h3><div class="stat-list">${speciesHtml || '<span class="muted">No data</span>'}</div></div>` +
      `<div class="panel"><h3>Active meds by room</h3><div class="stat-list">${medRoomHtml || '<span class="muted">No data</span>'}</div></div>` +
      this.metric('Overdue meds', (s.overdueDoses || []).length, (s.overdueDoses || []).length > 0);
  },

  loadBirds() {
    clearTimeout(this.state.birdLoadTimer);
    this.state.birdLoadTimer = setTimeout(async () => {
      const params = new URLSearchParams();
      const search = document.getElementById('bird-search').value;
      const locationId = document.getElementById('bird-location-filter').value;
      const status = document.getElementById('bird-status-filter').value;
      if (search) params.set('search', search);
      if (locationId) params.set('locationId', locationId);
      if (status) params.set('status', status);
      this.state.birds = (await this.api(`/api/family/pigeons/birds?${params}`)).birds;
      this.renderBirds();
    }, 150);
  },

  async loadAll() {
    this.state.locations = await this.api('/api/family/pigeons/locations');
    this.state.summary = await this.api('/api/family/pigeons/summary');
    const filter = document.getElementById('bird-location-filter');
    if (filter) filter.innerHTML = this.renderLocationOptions(filter.value || '', true);
    this.fillBirdForm('new-bird-fields', {});
    this.renderSummary();
    this.renderRooms();
    this.renderStats();
    this.loadBirds();
  },
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action], [data-view-jump]');
  if (!target) return;
  const action = target.dataset.action;
  if (target.dataset.viewJump) PigeonApp.showView(target.dataset.viewJump);
  if (action === 'open-bird') PigeonApp.openBird(target.dataset.birdId);
  if (action === 'delete-bird') PigeonApp.deleteBird(target.dataset.birdId);
  if (action === 'stop-med') PigeonApp.stopMedication(target.dataset.medId);
  if (action === 'delete-med') PigeonApp.deleteMedication(target.dataset.medId);
  if (action === 'delete-photo') PigeonApp.deletePhoto(target.dataset.photoId);
  if (action === 'mark-dose') PigeonApp.markDoseGiven(target.dataset.medId, target.dataset.logId || null);
});

document.addEventListener('DOMContentLoaded', () => PigeonApp.init());

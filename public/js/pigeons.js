const STATUS_META = {
  active: { label: 'Active', color: '#00A651', className: 'status-active' },
  critical: { label: 'Critical', color: '#E31B23', className: 'status-critical' },
  ready_for_release: { label: 'Ready for release', color: '#0077FF', className: 'status-ready-for-release' },
  permanent_resident: { label: 'Permanent resident', color: '#D97706', className: 'status-permanent-resident' },
  released: { label: 'Released', color: '#00B8D9', className: 'status-released' },
  deceased: { label: 'Deceased', color: '#111827', className: 'status-deceased' },
};

const PigeonApp = {
  state: {
    summary: null,
    locations: [],
    birds: [],
    currentBird: null,
    confirmResolve: null,
    birdLoadTimer: null,
    weightChart: null,
    editingNoteId: null,
    roomModalRoomKey: null,
    expandedRoomBirdIds: {},
  },

  init() {
    document.querySelectorAll('.bottom-nav button').forEach(button => {
      button.addEventListener('click', () => this.showView(button.dataset.view));
    });
    document.querySelector('[data-action="refresh"]').addEventListener('click', () => this.loadAll());
    const showAllActive = document.getElementById('show-all-active');
    if (showAllActive) showAllActive.addEventListener('change', () => this.renderRooms());
    document.getElementById('room-modal-backdrop').addEventListener('click', event => {
      if (event.target.id === 'room-modal-backdrop') this.closeRoom();
    });
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
    return (STATUS_META[status] && STATUS_META[status].color) || '#999';
  },

  statusDotSvg(status) {
    const color = this.statusDotColor(status);
    return `<svg class="status-dot" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="${color}"/></svg>`;
  },

  statusMeta(status) {
    return STATUS_META[status] || {
      label: String(status || 'Unknown').replace(/_/g, ' '),
      color: '#999',
      className: 'status-unknown',
    };
  },

  statusChip(status) {
    const meta = this.statusMeta(status);
    return `<span class="status-chip ${meta.className}">${this.statusDotSvg(status)}${this.esc(meta.label)}</span>`;
  },

  birdIconSvg() {
    return `
      <svg class="bird-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M12 29c4.5-10.5 13.5-15 24-12.5-2.5 9.5-8.5 16-19 16.5l-6 5" />
        <path d="M24 18c-2-4.5-5.5-7-10.5-7.5 1.2 4.5 3.8 7.5 8 9" />
        <path d="M34 17l6-3-3.5 5" />
        <path d="M23 33l-2.5 6" />
        <path d="M28 32l2 6" />
        <circle cx="31.5" cy="19.5" r="1" />
      </svg>`;
  },

  metric(label, value, hot = false, extraClass = '') {
    const cls = `${hot ? ' danger' : ''}${extraClass ? ` ${extraClass}` : ''}`;
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
    const rooms = (this.state.summary && this.state.summary.roomGroups) || [];
    const list = document.getElementById('room-list');
    if (!rooms.length) {
      list.innerHTML = '<div class="panel muted">No rooms or birds yet.</div>';
      return;
    }
    list.innerHTML = rooms.map(room => {
      const birds = room.birds || [];
      const needsMeds = birds.filter(bird => bird.medication_state === 'needs_meds').length;
      const missingMeds = birds.filter(bird => bird.medication_state === 'missing_meds').length;
      const medicated = birds.filter(bird => bird.medication_state === 'medicated').length;
      const roomKey = this.roomKey(room);
      return `
        <article class="room-card clickable" data-action="open-room" data-room-key="${this.esc(roomKey)}" data-location-name="${this.esc(room.location_name)}">
          <div class="room-head">
            <div>
              <h3>${this.esc(room.location_name)}</h3>
              <div class="muted small">${this.esc(room.bird_count || 0)} birds, ${this.esc(room.active_med_count || 0)} active meds</div>
            </div>
            <span class="pill ${needsMeds ? 'hot' : (missingMeds ? 'missing' : 'ok')}">${needsMeds ? `${needsMeds} need meds` : (missingMeds ? `${missingMeds} missing meds` : '0 need meds')}</span>
          </div>
          <div class="room-status-line">
            <span>${this.esc(birds.length)} pigeons</span>
            <span>${this.esc(medicated)} medicated</span>
            ${missingMeds ? `<span class="missing-meds-count">${missingMeds} missing meds</span>` : ''}
            <span>${this.esc(birds.filter(bird => bird.medication_state === 'no_meds').length)} no meds</span>
          </div>
        </article>`;
    }).join('');
  },

  roomKey(room) {
    if (!room) return '';
    return room.location_id == null ? `name:${room.location_name || 'Unassigned'}` : `id:${room.location_id}`;
  },

  findRoomByKey(roomKey) {
    const rooms = (this.state.summary && this.state.summary.roomGroups) || [];
    return rooms.find(room => this.roomKey(room) === roomKey) || null;
  },

  openRoom(roomKey) {
    this.state.roomModalRoomKey = roomKey;
    this.state.expandedRoomBirdIds = {};
    this.renderRoomModal();
  },

  closeRoom() {
    this.state.roomModalRoomKey = null;
    this.state.expandedRoomBirdIds = {};
    document.getElementById('room-modal-backdrop').classList.remove('open');
  },

  toggleRoomBird(birdId, event) {
    if (event && event.target.closest('button, input, select, textarea, a')) return;
    const key = String(birdId);
    this.state.expandedRoomBirdIds[key] = !this.state.expandedRoomBirdIds[key];
    this.renderRoomModal();
  },

  renderRoomModal() {
    const backdrop = document.getElementById('room-modal-backdrop');
    if (!backdrop) return;
    const room = this.findRoomByKey(this.state.roomModalRoomKey);
    if (!room) {
      backdrop.classList.remove('open');
      return;
    }

    const birds = room.birds || [];
    const needsMeds = birds.filter(bird => bird.medication_state === 'needs_meds').length;
    const medicated = birds.filter(bird => bird.medication_state === 'medicated').length;
    document.getElementById('room-modal-title').textContent = room.location_name || 'Unassigned';
    document.getElementById('room-modal-summary').textContent =
      `${birds.length} pigeons, ${needsMeds} need meds, ${medicated} medicated`;
    document.getElementById('room-modal-body').innerHTML = birds.length
      ? `<div class="room-bird-list">${birds.map(bird => this.renderRoomBird(bird)).join('')}</div>`
      : '<div class="panel muted">No active-care pigeons in this room.</div>';
    backdrop.classList.add('open');
  },

  roomBirdStateChip(bird) {
    const labels = {
      needs_meds: 'Needs meds',
      medicated: 'Medicated',
      missing_meds: 'Missing meds',
      no_meds: 'No meds',
    };
    const className = String(bird.medication_state || 'no_meds').replace(/_/g, '-');
    return `<span class="room-bird-status ${this.esc(className)}">${this.esc(labels[bird.medication_state] || 'No meds')}</span>`;
  },

  renderRoomBird(bird) {
    const expanded = !!this.state.expandedRoomBirdIds[String(bird.id)];
    return `
      <article class="room-bird-row ${expanded ? 'open' : ''}" data-action="toggle-room-bird" data-bird-id="${Number(bird.id)}">
        <div class="room-bird-main">
          <div>
            <strong>${this.esc(bird.name || bird.case_number)}</strong>
            <div class="muted small">${this.esc(bird.species || 'Unknown')} - ${this.esc(this.statusMeta(bird.status).label)}</div>
          </div>
          ${this.roomBirdStateChip(bird)}
        </div>
        ${expanded ? `<div class="room-bird-expanded">${this.renderRoomBirdMedications(bird)}</div>` : ''}
      </article>`;
  },

  renderRoomBirdMedications(bird) {
    const due = bird.dueDoses || [];
    const completed = bird.completedDoses || [];
    const skipped = bird.skippedDoses || [];
    const active = bird.activeMeds || [];
    const activeIdsWithDoseRows = new Set([...due, ...completed].map(dose => Number(dose.medication_id)));
    const quietActive = active.filter(med => !activeIdsWithDoseRows.has(Number(med.id)));
    const dueHtml = due.length
      ? `<div class="room-bird-med-list">${due.map(dose => this.renderDose(dose)).join('')}</div>`
      : '';
    const completedHtml = completed.length
      ? `<div class="room-bird-med-list"><div class="room-subhead">Given today</div>${completed.map(dose => this.renderCompletedDose(dose)).join('')}</div>`
      : '';
    const skippedHtml = skipped.length
      ? `<div class="room-bird-med-list"><div class="room-subhead">No meds today</div>${skipped.map(dose => this.renderSkippedDose(dose)).join('')}</div>`
      : '';
    const quietHtml = quietActive.length
      ? `<div class="room-bird-med-list"><div class="room-subhead">Active meds</div>${quietActive.map(med => `
        <div class="med-card quiet-med">
          <div class="row">
            <div>
              <strong>${this.esc(med.name)}</strong>
              <div class="muted small">${this.esc(med.kind)} ${this.esc(med.dosage || '')}</div>
            </div>
            <div class="row" style="gap:0.4rem">
              ${med.out_of_stock ? '<span class="pill out-of-stock-pill">No stock</span>' : ''}
              <span class="pill">${this.esc(med.frequency_per_day)}x/day</span>
            </div>
          </div>
        </div>
      `).join('')}</div>`
      : '';
    if (!dueHtml && !completedHtml && !skippedHtml && !quietHtml) return '<div class="muted small">No active medications.</div>';
    return dueHtml + completedHtml + skippedHtml + quietHtml;
  },

  renderDose(dose) {
    return `
      <div class="dose-row ${dose.overdue ? 'overdue' : ''}">
        <div>
          <div class="dose-bird">${this.esc(dose.bird_name || dose.case_number)}</div>
          <div class="dose-med">${this.esc(dose.kind)}: ${this.esc(dose.name)} ${this.esc(dose.dosage || '')}</div>
          <div class="dose-time ${dose.overdue ? 'overdue' : 'due'}">${dose.overdue ? 'Overdue' : 'Due'}: ${this.esc(this.formatDateTime(dose.scheduled_datetime))}</div>
        </div>
        <div class="dose-actions">
          <button class="primary" data-action="mark-dose" data-med-id="${Number(dose.medication_id)}" data-log-id="${Number(dose.log_id)}">Mark given</button>
          <button class="out-of-stock-btn" data-action="skip-dose" data-log-id="${Number(dose.log_id)}">No meds</button>
        </div>
      </div>`;
  },

  renderCompletedDose(dose) {
    const completedDate = dose.completed_datetime ? String(dose.completed_datetime).slice(0, 10) : '';
    const scheduledDate = dose.scheduled_datetime ? String(dose.scheduled_datetime).slice(0, 10) : '';
    const carriedOver = completedDate && scheduledDate && completedDate !== scheduledDate;
    const scheduledNote = carriedOver
      ? `<div class="dose-time carried-over">Scheduled: ${this.esc(this.formatDateTime(dose.scheduled_datetime))}</div>`
      : '';
    return `
      <div class="dose-row completed">
        <div>
          <div class="dose-bird">${this.esc(dose.bird_name || dose.case_number)}</div>
          <div class="dose-med">${this.esc(dose.kind)}: ${this.esc(dose.name)} ${this.esc(dose.dosage || '')}</div>
          <div class="dose-time completed">Given: ${this.esc(this.formatDateTime(dose.completed_datetime))}</div>
          ${scheduledNote}
        </div>
        <div class="completed-actions">
          <span class="pill medicated">Medicated</span>
          ${carriedOver ? `<button class="undo-dose" type="button" data-action="dismiss-dose" data-log-id="${Number(dose.log_id)}">Dismiss</button>` : `<button class="undo-dose" type="button" data-action="undo-dose" data-log-id="${Number(dose.log_id)}">Not yet</button>`}
        </div>
      </div>`;
  },

  renderSkippedDose(dose) {
    return `
      <div class="dose-row skipped">
        <div>
          <div class="dose-bird">${this.esc(dose.bird_name || dose.case_number)}</div>
          <div class="dose-med">${this.esc(dose.kind)}: ${this.esc(dose.name)} ${this.esc(dose.dosage || '')}</div>
          <div class="dose-time skipped">Skipped: ${this.esc(this.formatDateTime(dose.scheduled_datetime))}</div>
        </div>
        <div class="completed-actions">
          <span class="pill skipped-pill">No meds</span>
          <button class="undo-dose" type="button" data-action="undo-skip" data-log-id="${Number(dose.log_id)}">Got meds</button>
        </div>
      </div>`;
  },

  renderLocationOptions(selected = '', includeAll = false) {
    const all = includeAll ? '<option value="">All rooms</option>' : '';
    return all + this.state.locations.map(loc =>
      `<option value="${Number(loc.id)}"${String(loc.id) === String(selected) ? ' selected' : ''}>${this.esc(loc.name)}</option>`
    ).join('');
  },

  statusOptions(selected = 'active') {
    return Object.keys(STATUS_META)
      .map(status => `<option value="${status}"${status === selected ? ' selected' : ''}>${this.esc(this.statusMeta(status).label)}</option>`)
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
      <label class="span-3">General notes <textarea name="notes">${this.esc(bird.notes || '')}</textarea></label>`;
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

  filterRoom(target, event) {
    if (event && event.target.closest('button, input, select, textarea, a')) return;
    const locationId = target.dataset.locationId || '';
    const locationName = target.dataset.locationName || 'room';
    const locationFilter = document.getElementById('bird-location-filter');
    const statusFilter = document.getElementById('bird-status-filter');
    const search = document.getElementById('bird-search');
    if (locationFilter) locationFilter.value = locationId;
    if (statusFilter) statusFilter.value = '';
    if (search) search.value = '';
    this.showView('birds');
    this.loadBirds();
    this.showToast(`Showing birds in ${locationName}`);
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
        : `<div class="bird-photo placeholder">${this.birdIconSvg()}</div>`;
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
              ${this.statusChip(bird.status)}
              ${roomText ? `<span>${this.esc(roomText)}</span>` : ''}
              ${noRoom ? '' : `<span>${this.esc(bird.active_med_count || 0)} meds</span>`}
            </div>
          </div>
        </article>`;
    }).join('');
  },

  async openBird(id) {
    this.state.editingNoteId = null;
    this.state.currentBird = await this.api(`/api/family/pigeons/birds/${id}`);
    this.renderBirdDetail();
    this.showView('detail');
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
  },

  renderBirdDetail() {
    const b = this.state.currentBird;
    const photos = (b.photos || []).map(photo => this.renderPhoto(photo)).join('') || '<div class="panel muted">No photos yet.</div>';
    const meds = (b.medications || []).map(med => this.renderMed(med)).join('') || '<div class="panel muted">No medications or supplements yet.</div>';
    const metaParts = [
      this.esc(b.case_number),
      this.esc(b.species),
      this.esc(b.location_name || 'Unassigned'),
    ];
    document.getElementById('bird-detail').innerHTML = `
      <div class="section-head">
        <div>
          <h2>${this.esc(b.name || 'Unnamed')}</h2>
          <p>${metaParts.join(' - ')} ${this.statusChip(b.status)}</p>
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
      <div class="section-head"><div><h3>Notes</h3><p>Keep dated notes over time.</p></div></div>
      ${this.renderNoteTracker()}
      <div class="section-head"><div><h3>Weight</h3><p>Track gram changes over time.</p></div></div>
      ${this.renderWeightTracker()}
      <div class="section-head"><div><h3>Meds and supplements</h3><p>Stop or delete a medication when the plan changes.</p></div></div>
      ${this.medicationForm()}
      <div class="med-list">${meds}</div>
      <div class="section-head"><div><h3>Photos</h3><p>Upload photos from the phone camera or library.</p></div></div>
      ${this.photoForm()}
      <div class="photo-grid">${photos}</div>`;
    document.querySelector('[data-form="edit-bird"]').addEventListener('submit', event => this.updateBird(event));
    document.querySelector('[data-form="dated-note"]').addEventListener('submit', event => this.saveDatedNote(event));
    document.querySelector('[data-form="add-weight"]').addEventListener('submit', event => this.addWeight(event));
    document.querySelector('[data-form="add-medication"]').addEventListener('submit', event => this.addMedication(event));
    document.querySelector('[data-form="upload-photo"]').addEventListener('submit', event => this.uploadPhoto(event));
    this.renderWeightChart(b.weights || []);
  },

  renderNoteTracker() {
    const notes = (this.state.currentBird && this.state.currentBird.noteLogs) || [];
    const editingNote = notes.find(note => String(note.id) === String(this.state.editingNoteId));
    const isEditing = !!editingNote;
    const rows = notes.length
      ? notes.map(note => `
        <article class="note-row">
          <div>
            <div class="note-date">${this.esc(note.note_date)}</div>
            <div class="note-text">${this.esc(note.note_text)}</div>
          </div>
          <div class="note-actions">
            <button type="button" data-action="edit-note" data-note-id="${Number(note.id)}">Edit</button>
            <button class="danger" type="button" data-action="delete-note" data-note-id="${Number(note.id)}">Delete</button>
          </div>
        </article>
      `).join('')
      : '<div class="panel muted">No dated notes yet.</div>';

    return `
      <section class="panel note-panel">
        <form class="note-form" data-form="dated-note">
          <input type="hidden" name="note_id" value="${isEditing ? Number(editingNote.id) : ''}">
          <label>Date <input type="date" name="note_date" value="${this.esc(isEditing ? editingNote.note_date : this.today())}" required></label>
          <label class="span-3">Note <textarea name="note_text" required>${this.esc(isEditing ? editingNote.note_text : '')}</textarea></label>
          <div class="note-form-actions">
            <button class="primary" type="submit">${isEditing ? 'Save note edit' : 'Add note'}</button>
            ${isEditing ? '<button type="button" data-action="cancel-note-edit">Cancel</button>' : ''}
          </div>
        </form>
        <div class="note-list">${rows}</div>
      </section>`;
  },

  renderWeightTracker() {
    const weights = (this.state.currentBird && this.state.currentBird.weights) || [];
    const latest = weights.length ? weights[weights.length - 1] : null;
    const helper = weights.length < 2
      ? `<p class="muted small">Add another weight to draw a trend.</p>`
      : `<p class="muted small">Latest: ${this.esc(latest.weight_grams)}g on ${this.esc(latest.weight_date)}</p>`;
    const rows = weights.length
      ? weights.slice().reverse().map(weight => `
        <div class="weight-row">
          <div>
            <strong>${this.esc(weight.weight_grams)}g</strong>
            <span class="muted small">${this.esc(weight.weight_date)}</span>
            <span class="weight-source">${weight.source === 'initial' ? 'Initial weight' : 'Logged weight'}</span>
          </div>
          ${weight.source === 'log' ? `<button class="danger" type="button" data-action="delete-weight" data-weight-id="${Number(weight.id)}">Delete</button>` : ''}
        </div>
      `).join('')
      : '<div class="panel muted">No weights yet.</div>';

    return `
      <section class="panel weight-panel">
        <div class="weight-chart-wrap"><canvas id="weight-chart"></canvas></div>
        ${helper}
        <form class="weight-form" data-form="add-weight">
          <label>Date <input type="date" name="weight_date" value="${this.today()}" required></label>
          <label>Grams <input type="number" step="0.1" min="0.1" name="weight_grams" required></label>
          <button class="primary" type="submit">Add weight</button>
        </form>
        <div class="weight-list">${rows}</div>
      </section>`;
  },

  renderWeightChart(weights) {
    if (this.state.weightChart) {
      this.state.weightChart.destroy();
      this.state.weightChart = null;
    }
    const canvas = document.getElementById('weight-chart');
    if (!canvas || !window.Chart) return;

    const labels = weights.map(weight => weight.weight_date);
    const data = weights.map(weight => Number(weight.weight_grams));
    const styles = getComputedStyle(document.body);
    const lineColor = styles.getPropertyValue('--leaf').trim() || '#2F7D52';
    const textColor = styles.getPropertyValue('--forest').trim() || '#2D4A3E';
    const gridColor = styles.getPropertyValue('--rule-dark').trim() || 'rgba(45, 74, 62, 0.25)';

    this.state.weightChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Weight (g)',
          data,
          borderColor: lineColor,
          backgroundColor: `${lineColor}22`,
          pointBackgroundColor: lineColor,
          pointBorderColor: lineColor,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          fill: weights.length > 1,
        }],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => `${context.parsed.y}g`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: false,
            grid: { color: gridColor },
            ticks: { color: textColor, callback: value => `${value}g` },
          },
        },
      },
    });
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
            <button type="button" data-action="toggle-out-of-stock" data-med-id="${Number(med.id)}" data-out-of-stock="${med.out_of_stock ? '1' : '0'}">${med.out_of_stock ? 'Back in stock' : 'Out of stock'}</button>
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
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logId ? { log_id: logId } : {}),
    });
    this.showToast('Dose recorded');
    if (wasOnDetail) {
      await this.refreshAfterDetailChange();
      return;
    }
    await this.loadAll();
  },

  async undoDose(logId) {
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medication-logs/${logId}/undo-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    this.showToast('Dose marked not yet');
    if (wasOnDetail) {
      await this.refreshAfterDetailChange();
      return;
    }
    await this.loadAll();
  },

  async dismissDose(logId) {
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medication-logs/${logId}/dismiss-dose`, { method: 'POST' });
    this.showToast('Dismissed');
    if (wasOnDetail) { await this.refreshAfterDetailChange(); return; }
    await this.loadAll();
  },

  async undoSkip(logId) {
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medication-logs/${logId}/undo-skip`, { method: 'POST' });
    this.showToast('Back to due — ready to medicate');
    if (wasOnDetail) { await this.refreshAfterDetailChange(); return; }
    await this.loadAll();
  },

  async skipDose(logId) {
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medication-logs/${logId}/skip-dose`, { method: 'POST' });
    this.showToast('Dose skipped — out of stock');
    if (wasOnDetail) {
      await this.refreshAfterDetailChange();
      return;
    }
    await this.loadAll();
  },

  async toggleOutOfStock(medId, currentValue) {
    const wasOnDetail = document.getElementById('view-detail').classList.contains('active');
    await this.api(`/api/family/pigeons/medications/${medId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ out_of_stock: currentValue ? 0 : 1 }),
    });
    this.showToast(currentValue ? 'Marked back in stock' : 'Marked out of stock');
    if (wasOnDetail) {
      await this.refreshAfterDetailChange();
      return;
    }
    await this.loadAll();
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

  startEditNote(id) {
    this.state.editingNoteId = Number(id);
    this.renderBirdDetail();
  },

  cancelNoteEdit() {
    this.state.editingNoteId = null;
    this.renderBirdDetail();
  },

  async saveDatedNote(event) {
    event.preventDefault();
    if (!this.state.currentBird) return;

    const data = this.formToObject(event.target);
    const isEditing = !!data.note_id;
    try {
      if (isEditing) {
        const ok = await this.confirmModal('Save note edit', 'Save changes to this dated note?', 'Save');
        if (!ok) return;
        await this.api(`/api/family/pigeons/notes/${data.note_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note_date: data.note_date,
            note_text: data.note_text,
          }),
        });
        this.showToast('Note updated');
      } else {
        await this.api(`/api/family/pigeons/birds/${this.state.currentBird.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note_date: data.note_date,
            note_text: data.note_text,
          }),
        });
        this.showToast('Note saved');
      }

      this.state.editingNoteId = null;
      await this.refreshAfterDetailChange();
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async deleteNote(id) {
    const ok = await this.confirmModal('Delete note', 'Delete this dated note?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/pigeons/notes/${id}`, { method: 'DELETE' });
    this.showToast('Note deleted');
    this.state.editingNoteId = null;
    await this.refreshAfterDetailChange();
  },

  async addWeight(event) {
    event.preventDefault();
    if (!this.state.currentBird) return;
    try {
      await this.api(`/api/family/pigeons/birds/${this.state.currentBird.id}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(event.target)),
      });
      event.target.reset();
      this.showToast('Weight saved');
      await this.refreshAfterDetailChange();
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async deleteWeight(id) {
    const ok = await this.confirmModal('Delete weight', 'Delete this recorded weight?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/pigeons/weights/${id}`, { method: 'DELETE' });
    this.showToast('Weight deleted');
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
      this.metric('Active', statusCounts.active || 0, false, 'status-active') +
      this.metric('Critical', statusCounts.critical || 0, (statusCounts.critical || 0) > 0, 'status-critical') +
      this.metric('Residents', statusCounts.permanent_resident || 0, false, 'status-permanent-resident') +
      this.metric('Released', statusCounts.released || 0, false, 'status-released') +
      this.metric('Deceased', statusCounts.deceased || 0, false, 'status-deceased') +
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
    this.renderRoomModal();
    this.loadBirds();
  },
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action], [data-view-jump]');
  if (!target) return;
  const action = target.dataset.action;
  if (target.dataset.viewJump) PigeonApp.showView(target.dataset.viewJump);
  if (action === 'open-room') PigeonApp.openRoom(target.dataset.roomKey);
  if (action === 'close-room-modal') PigeonApp.closeRoom();
  if (action === 'toggle-room-bird') PigeonApp.toggleRoomBird(target.dataset.birdId, event);
  if (action === 'filter-room') PigeonApp.filterRoom(target, event);
  if (action === 'open-bird') PigeonApp.openBird(target.dataset.birdId);
  if (action === 'delete-bird') PigeonApp.deleteBird(target.dataset.birdId);
  if (action === 'stop-med') PigeonApp.stopMedication(target.dataset.medId);
  if (action === 'delete-med') PigeonApp.deleteMedication(target.dataset.medId);
  if (action === 'delete-photo') PigeonApp.deletePhoto(target.dataset.photoId);
  if (action === 'edit-note') PigeonApp.startEditNote(target.dataset.noteId);
  if (action === 'cancel-note-edit') PigeonApp.cancelNoteEdit();
  if (action === 'delete-note') PigeonApp.deleteNote(target.dataset.noteId);
  if (action === 'delete-weight') PigeonApp.deleteWeight(target.dataset.weightId);
  if (action === 'mark-dose') PigeonApp.markDoseGiven(target.dataset.medId, target.dataset.logId || null);
  if (action === 'undo-dose') PigeonApp.undoDose(target.dataset.logId);
  if (action === 'dismiss-dose') PigeonApp.dismissDose(target.dataset.logId);
  if (action === 'skip-dose') PigeonApp.skipDose(target.dataset.logId);
  if (action === 'undo-skip') PigeonApp.undoSkip(target.dataset.logId);
  if (action === 'toggle-out-of-stock') PigeonApp.toggleOutOfStock(target.dataset.medId, Number(target.dataset.outOfStock));
});

document.addEventListener('DOMContentLoaded', () => PigeonApp.init());

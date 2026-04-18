const PET_STATUS_META = {
  active: { label: 'Active', className: 'status-active' },
  inactive: { label: 'Inactive', className: 'status-inactive' },
  deceased: { label: 'Deceased', className: 'status-deceased' },
};

const PetsApp = {
  state: {
    summary: null,
    pets: [],
    currentPet: null,
    confirmResolve: null,
    petLoadTimer: null,
    weightChart: null,
    editingNoteId: null,
    editingMedId: null,
  },

  init() {
    document.querySelectorAll('.bottom-nav button').forEach(button => {
      button.addEventListener('click', () => this.showView(button.dataset.view));
    });
    document.querySelector('[data-action="refresh"]').addEventListener('click', () => this.loadAll());
    document.getElementById('pet-search').addEventListener('input', () => this.loadPets());
    document.getElementById('pet-type-filter').addEventListener('change', () => this.loadPets());
    document.getElementById('pet-status-filter').addEventListener('change', () => this.loadPets());
    document.getElementById('new-pet-form').addEventListener('submit', event => this.createPet(event));
    document.querySelectorAll('[data-modal-answer]').forEach(button => {
      button.addEventListener('click', () => this.closeModal(button.dataset.modalAnswer === 'true'));
    });
    this.fillPetForm('new-pet-fields', {});
    this.loadAll().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('pet')) this.openPet(params.get('pet'));
    }).catch(err => this.showToast(err.message));
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

  addDays(dateOnly, days) {
    const d = new Date(`${dateOnly || this.today()}T00:00:00`);
    d.setDate(d.getDate() + Number(days || 30));
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
    if (view === 'pets') this.loadPets();
    if (view === 'stats') this.renderStats();
    if (view === 'add') this.fillPetForm('new-pet-fields', {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  metric(label, value, hot = false, extraClass = '') {
    return `<div class="metric${hot ? ' danger' : ''}${extraClass ? ` ${extraClass}` : ''}"><div class="metric-value">${this.esc(value)}</div><div class="metric-label">${this.esc(label)}</div></div>`;
  },

  statusMeta(status) {
    return PET_STATUS_META[status] || { label: status || 'Unknown', className: '' };
  },

  statusChip(status) {
    const meta = this.statusMeta(status);
    return `<span class="status-chip ${meta.className}">${this.esc(meta.label)}</span>`;
  },

  typeIcon(type) {
    if (type === 'cat') return 'C';
    if (type === 'dog') return 'D';
    return 'A';
  },

  renderSummary() {
    const s = this.state.summary || {};
    const overdue = (s.overdueDoses || []).length;
    document.getElementById('pet-summary-grid').innerHTML =
      this.metric('Overdue', overdue, overdue > 0) +
      this.metric('Due today', (s.dueTodayDoses || []).length) +
      this.metric('Active pets', s.activePets || 0) +
      this.metric('Active meds', s.activeMeds || 0);
  },

  renderOverview() {
    const s = this.state.summary || {};
    const dueMap = new Map();
    [...(s.overdueDoses || []), ...(s.dueTodayDoses || [])].forEach(dose => dueMap.set(dose.log_id, dose));
    const due = Array.from(dueMap.values());
    document.getElementById('pet-due-list').innerHTML = due.length
      ? due.map(dose => this.renderDose(dose)).join('')
      : '<div class="panel muted">No pets need medication right now.</div>';
    document.getElementById('pet-completed-list').innerHTML = (s.completedTodayDoses || []).length
      ? s.completedTodayDoses.map(dose => this.renderDose(dose, 'completed')).join('')
      : '<div class="panel muted">No pet medication recorded today.</div>';
    document.getElementById('pet-skipped-list').innerHTML = (s.skippedTodayDoses || []).length
      ? s.skippedTodayDoses.map(dose => this.renderDose(dose, 'skipped')).join('')
      : '<div class="panel muted">No skipped pet medication today.</div>';
  },

  renderDose(dose, mode = 'due') {
    const completed = mode === 'completed';
    const skipped = mode === 'skipped';
    const className = completed ? ' completed' : (skipped ? ' skipped' : (dose.overdue ? ' overdue' : ''));
    const timeLabel = completed ? 'Given' : (skipped ? 'Skipped' : (dose.overdue ? 'Overdue' : 'Due'));
    const timeValue = completed ? dose.completed_datetime : dose.scheduled_datetime;
    const actions = completed
      ? `<span class="pill completed">Recorded</span><button data-action="undo-dose" data-log-id="${Number(dose.log_id)}">Not yet</button>`
      : (skipped
        ? `<span class="pill">No meds</span><button data-action="undo-skip" data-log-id="${Number(dose.log_id)}">Got meds</button>`
        : `<button class="primary" data-action="mark-dose" data-med-id="${Number(dose.medication_id)}" data-log-id="${Number(dose.log_id)}">Mark given</button><button data-action="skip-dose" data-log-id="${Number(dose.log_id)}">No meds</button>`);
    return `
      <article class="dose-row${className}">
        <div>
          <div class="dose-title">${this.esc(dose.pet_name)} <span class="pill">${this.esc(dose.animal_type)}</span></div>
          <div class="dose-med">${this.esc(dose.kind)}: ${this.esc(dose.name)} ${this.esc(dose.dosage || '')}</div>
          <div class="dose-time${dose.overdue ? ' overdue' : ''}">${this.esc(timeLabel)}: ${this.esc(this.formatDateTime(timeValue))}</div>
        </div>
        <div class="dose-actions">${actions}</div>
      </article>`;
  },

  petFieldsHtml(pet = {}) {
    return `
      <label>Name <input name="name" value="${this.esc(pet.name || '')}" required></label>
      <label>Type <select name="animal_type">
        <option value="dog"${pet.animal_type === 'dog' || !pet.animal_type ? ' selected' : ''}>Dog</option>
        <option value="cat"${pet.animal_type === 'cat' ? ' selected' : ''}>Cat</option>
        <option value="other"${pet.animal_type === 'other' ? ' selected' : ''}>Other</option>
      </select></label>
      <label>Breed <input name="breed" value="${this.esc(pet.breed || '')}"></label>
      <label>Sex <input name="sex" value="${this.esc(pet.sex || '')}"></label>
      <label>Birthday <input type="date" name="birthday" value="${this.esc(pet.birthday || '')}"></label>
      <label>Adoption date <input type="date" name="adoption_date" value="${this.esc(pet.adoption_date || '')}"></label>
      <label>Status <select name="status">
        <option value="active"${pet.status === 'active' || !pet.status ? ' selected' : ''}>Active</option>
        <option value="inactive"${pet.status === 'inactive' ? ' selected' : ''}>Inactive</option>
        <option value="deceased"${pet.status === 'deceased' ? ' selected' : ''}>Deceased</option>
      </select></label>
      <label class="span-full">General notes <textarea name="notes">${this.esc(pet.notes || '')}</textarea></label>`;
  },

  fillPetForm(containerId, pet = {}) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = this.petFieldsHtml(pet);
  },

  formToObject(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (value !== '') data[key] = value;
    });
    return data;
  },

  async createPet(event) {
    event.preventDefault();
    try {
      const pet = await this.api('/api/family/animals/pets/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(event.target)),
      });
      event.target.reset();
      this.showToast('Pet saved');
      await this.loadAll();
      await this.openPet(pet.id);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async updatePet(event) {
    event.preventDefault();
    if (!this.state.currentPet) return;
    try {
      const id = this.state.currentPet.id;
      await this.api(`/api/family/animals/pets/pets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formToObject(event.target)),
      });
      this.showToast('Pet updated');
      await this.loadAll();
      await this.openPet(id);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async deletePet(id) {
    const ok = await this.confirmModal('Delete pet', 'Delete this pet and all medications, notes, weights, and photos?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/pets/${id}`, { method: 'DELETE' });
    this.showToast('Pet deleted');
    await this.loadAll();
    this.showView('pets');
  },

  renderPets() {
    const list = document.getElementById('pet-list');
    if (!this.state.pets.length) {
      list.innerHTML = '<div class="panel muted">No pets match this view.</div>';
      return;
    }
    list.innerHTML = this.state.pets.map(pet => {
      const img = pet.first_photo
        ? `<img class="animal-photo" src="${this.esc(pet.first_photo)}" alt="">`
        : `<div class="animal-photo">${this.esc(this.typeIcon(pet.animal_type))}</div>`;
      return `
        <article class="animal-card" data-action="open-pet" data-pet-id="${Number(pet.id)}">
          ${img}
          <div>
            <div class="animal-line-1"><span class="animal-name">${this.esc(pet.name)}</span><span class="muted small">${this.esc(pet.breed || pet.animal_type)}</span></div>
            <div class="pill-row">${this.statusChip(pet.status)}<span class="pill">${this.esc(pet.animal_type)}</span><span class="pill">${this.esc(pet.active_med_count || 0)} meds</span></div>
          </div>
        </article>`;
    }).join('');
  },

  async openPet(id) {
    this.state.editingNoteId = null;
    this.state.editingMedId = null;
    this.state.currentPet = await this.api(`/api/family/animals/pets/pets/${id}`);
    this.renderPetDetail();
    this.showView('detail');
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
  },

  renderPetDetail() {
    const p = this.state.currentPet;
    const photos = (p.photos || []).map(photo => this.renderPhoto(photo)).join('') || '<div class="panel muted">No photos yet.</div>';
    const meds = (p.medications || []).map(med => this.renderMed(med)).join('') || '<div class="panel muted">No medications, preventatives, or supplements yet.</div>';
    document.getElementById('pet-detail').innerHTML = `
      <div class="section-head">
        <div>
          <h2>${this.esc(p.name)}</h2>
          <p>${this.esc(p.animal_type)} ${p.breed ? `- ${this.esc(p.breed)}` : ''} ${this.statusChip(p.status)}</p>
        </div>
        <button data-view-jump="pets">Back</button>
      </div>
      <form class="panel" data-form="edit-pet">
        <div class="form-grid">${this.petFieldsHtml(p)}</div>
        <div class="form-actions">
          <button class="primary" type="submit">Save Changes</button>
          <button class="danger" type="button" data-action="delete-pet" data-pet-id="${Number(p.id)}">Delete Pet</button>
        </div>
      </form>
      <div class="section-head"><div><h3>Notes</h3><p>Keep dated notes over time.</p></div></div>
      ${this.renderNoteTracker()}
      <div class="section-head"><div><h3>Weight</h3><p>Track pound changes over time.</p></div></div>
      ${this.renderWeightTracker()}
      <div class="section-head"><div><h3>Meds and preventatives</h3><p>Daily courses and recurring interval medicine.</p></div></div>
      ${this.medicationForm()}
      <div class="med-list">${meds}</div>
      <div class="section-head"><div><h3>Photos</h3><p>Upload photos from the phone camera or library.</p></div></div>
      ${this.photoForm()}
      <div class="photo-grid">${photos}</div>`;
    document.querySelector('[data-form="edit-pet"]').addEventListener('submit', event => this.updatePet(event));
    document.querySelector('[data-form="dated-note"]').addEventListener('submit', event => this.saveDatedNote(event));
    document.querySelector('[data-form="add-weight"]').addEventListener('submit', event => this.addWeight(event));
    document.querySelector('[data-form="add-medication"]').addEventListener('submit', event => this.addMedication(event));
    document.querySelector('[data-form="upload-photo"]').addEventListener('submit', event => this.uploadPhoto(event));
    const editMedForm = document.querySelector('[data-form="edit-medication"]');
    if (editMedForm) editMedForm.addEventListener('submit', event => this.saveMedicationEdit(event));
    document.querySelectorAll('[data-schedule-select]').forEach(select => {
      select.addEventListener('change', event => this.toggleScheduleFields(event.target.closest('form')));
    });
    document.querySelectorAll('[data-schedule-select]').forEach(select => this.toggleScheduleFields(select.closest('form')));
    this.renderWeightChart(p.weights || []);
  },

  renderNoteTracker() {
    const notes = (this.state.currentPet && this.state.currentPet.noteLogs) || [];
    const editingNote = notes.find(note => String(note.id) === String(this.state.editingNoteId));
    const rows = notes.length ? notes.map(note => `
      <article class="note-row">
        <div><div class="small">${this.esc(note.note_date)}</div><div>${this.esc(note.note_text)}</div></div>
        <div class="form-actions"><button type="button" data-action="edit-note" data-note-id="${Number(note.id)}">Edit</button><button class="danger" type="button" data-action="delete-note" data-note-id="${Number(note.id)}">Delete</button></div>
      </article>`).join('') : '<div class="panel muted">No dated notes yet.</div>';
    return `
      <section class="panel">
        <form data-form="dated-note">
          <input type="hidden" name="note_id" value="${editingNote ? Number(editingNote.id) : ''}">
          <div class="form-grid">
            <label>Date <input type="date" name="note_date" value="${this.esc(editingNote ? editingNote.note_date : this.today())}" required></label>
            <label class="span-full">Note <textarea name="note_text" required>${this.esc(editingNote ? editingNote.note_text : '')}</textarea></label>
          </div>
          <div class="form-actions"><button class="primary" type="submit">${editingNote ? 'Save note edit' : 'Add note'}</button>${editingNote ? '<button type="button" data-action="cancel-note-edit">Cancel</button>' : ''}</div>
        </form>
        <div class="note-list">${rows}</div>
      </section>`;
  },

  renderWeightTracker() {
    const weights = (this.state.currentPet && this.state.currentPet.weights) || [];
    const latest = weights.length ? weights[weights.length - 1] : null;
    const helper = latest ? `<p class="muted small">Latest: ${this.esc(latest.weight_lbs)} lb on ${this.esc(latest.weight_date)}</p>` : '<p class="muted small">Add a weight to start a trend.</p>';
    const rows = weights.length ? weights.slice().reverse().map(weight => `
      <div class="weight-row">
        <div><strong>${this.esc(weight.weight_lbs)} lb</strong> <span class="muted small">${this.esc(weight.weight_date)}</span></div>
        <button class="danger" type="button" data-action="delete-weight" data-weight-id="${Number(weight.id)}">Delete</button>
      </div>`).join('') : '<div class="panel muted">No weights yet.</div>';
    return `
      <section class="panel">
        <div class="weight-chart-wrap"><canvas id="weight-chart"></canvas></div>
        ${helper}
        <form class="form-grid" data-form="add-weight">
          <label>Date <input type="date" name="weight_date" value="${this.today()}" required></label>
          <label>Pounds <input type="number" step="0.1" min="0.1" name="weight_lbs" required></label>
          <div class="form-actions span-full"><button class="primary" type="submit">Add weight</button></div>
        </form>
        <div class="weight-list">${rows}</div>
      </section>`;
  },

  medicationForm(med = null) {
    const isEdit = !!med;
    const scheduleType = med ? med.schedule_type : 'daily_course';
    const intervalDays = med && med.interval_days ? med.interval_days : 30;
    const nextDue = med && med.next_due_date ? med.next_due_date : this.today();
    const start = med && med.start_date ? med.start_date : this.today();
    const end = med && med.end_date ? med.end_date : this.today();
    return `
      <form class="panel" data-form="${isEdit ? 'edit-medication' : 'add-medication'}">
        ${isEdit ? `<input type="hidden" name="medication_id" value="${Number(med.id)}">` : ''}
        <div class="form-grid">
          <label>Type <select name="kind">
            <option value="medication"${med && med.kind === 'medication' ? ' selected' : ''}>Medication</option>
            <option value="supplement"${med && med.kind === 'supplement' ? ' selected' : ''}>Supplement</option>
            <option value="preventative"${med && med.kind === 'preventative' ? ' selected' : ''}>Preventative</option>
          </select></label>
          <label class="span-2">Name <input name="name" value="${this.esc(med ? med.name : '')}" required></label>
          <label>Dosage <input name="dosage" value="${this.esc(med ? med.dosage || '' : '')}"></label>
          <label>Schedule <select name="schedule_type" data-schedule-select>
            <option value="daily_course"${scheduleType === 'daily_course' ? ' selected' : ''}>Daily course</option>
            <option value="interval"${scheduleType === 'interval' ? ' selected' : ''}>Every N days</option>
          </select></label>
          <div class="schedule-fields daily-fields span-full">
            <div class="form-grid">
              <label>Times per day <select name="frequency_per_day">
                <option${med && med.frequency_per_day === 1 ? ' selected' : ''}>1</option>
                <option${med && med.frequency_per_day === 2 ? ' selected' : ''}>2</option>
                <option${med && med.frequency_per_day === 3 ? ' selected' : ''}>3</option>
                <option${med && med.frequency_per_day === 4 ? ' selected' : ''}>4</option>
              </select></label>
              <label>Start <input type="date" name="start_date" value="${this.esc(start)}"></label>
              <label>End <input type="date" name="end_date" value="${this.esc(end)}"></label>
            </div>
          </div>
          <div class="schedule-fields interval-fields span-full">
            <div class="form-grid">
              <label>Every days <input type="number" min="1" name="interval_days" value="${this.esc(intervalDays)}"></label>
              <label>Start <input type="date" name="interval_start_date" value="${this.esc(start)}"></label>
              <label>Next due <input type="date" name="next_due_date" value="${this.esc(nextDue)}"></label>
            </div>
          </div>
          <label class="span-full">Notes <textarea name="notes">${this.esc(med ? med.notes || '' : '')}</textarea></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">${isEdit ? 'Save medication' : 'Add med'}</button>${isEdit ? '<button type="button" data-action="cancel-med-edit">Cancel</button>' : ''}</div>
      </form>`;
  },

  toggleScheduleFields(form) {
    if (!form) return;
    const schedule = form.querySelector('[name="schedule_type"]');
    const daily = form.querySelector('.daily-fields');
    const interval = form.querySelector('.interval-fields');
    const isInterval = schedule && schedule.value === 'interval';
    if (daily) daily.classList.toggle('hidden', isInterval);
    if (interval) interval.classList.toggle('hidden', !isInterval);
  },

  prepareMedicationPayload(form) {
    const data = this.formToObject(form);
    if (data.schedule_type === 'interval') {
      data.start_date = data.interval_start_date || data.start_date || this.today();
      delete data.end_date;
      delete data.frequency_per_day;
    } else {
      delete data.interval_days;
      delete data.next_due_date;
    }
    delete data.interval_start_date;
    return data;
  },

  renderMed(med) {
    if (String(this.state.editingMedId || '') === String(med.id)) return this.medicationForm(med);
    const schedule = med.schedule_type === 'interval'
      ? `every ${this.esc(med.interval_days || 30)} days, next ${this.esc(med.next_due_date || '')}`
      : `${this.esc(med.frequency_per_day)}x/day, ${this.esc(med.start_date)} to ${this.esc(med.end_date || '')}`;
    return `
      <article class="med-card">
        <div class="med-head">
          <div><h3>${this.esc(med.name)}</h3><div class="muted small">${this.esc(med.kind)} - ${this.esc(med.dosage || 'no dosage')}</div></div>
          <span class="pill ${med.active ? 'ok' : ''}">${med.active ? 'Active' : 'Stopped'}</span>
        </div>
        <div class="pill-row">
          <span class="pill">${schedule}</span>
          <span class="pill ${med.overdue_count ? 'hot' : ''}">${this.esc(med.overdue_count || 0)} overdue</span>
          <span class="pill">${this.esc(med.doses_given || 0)}/${this.esc(med.total_doses || 0)} doses</span>
          ${med.out_of_stock ? '<span class="pill">No stock</span>' : ''}
        </div>
        <div class="form-actions">
          <button class="primary" data-action="mark-dose" data-med-id="${Number(med.id)}">Mark next dose</button>
          <div>
            <button type="button" data-action="edit-med" data-med-id="${Number(med.id)}">Edit</button>
            <button type="button" data-action="toggle-out-of-stock" data-med-id="${Number(med.id)}" data-out-of-stock="${med.out_of_stock ? '1' : '0'}">${med.out_of_stock ? 'Back in stock' : 'Out of stock'}</button>
            <button type="button" data-action="stop-med" data-med-id="${Number(med.id)}">Stop</button>
            <button class="danger" type="button" data-action="delete-med" data-med-id="${Number(med.id)}">Delete</button>
          </div>
        </div>
      </article>`;
  },

  photoForm() {
    return `
      <form class="panel" data-form="upload-photo">
        <div class="form-grid">
          <label class="span-2">Photo <input type="file" name="photos" accept="image/*" capture="environment" required></label>
          <label>Type <select name="photo_type"><option value="progress">Progress</option><option value="profile">Profile</option></select></label>
          <label class="span-full">Description <input name="description"></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Upload Photo</button></div>
      </form>`;
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
    if (!this.state.currentPet) return;
    try {
      await this.api(`/api/family/animals/pets/pets/${this.state.currentPet.id}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.prepareMedicationPayload(event.target)),
      });
      this.showToast('Medication added');
      await this.refreshAfterDetailChange();
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async saveMedicationEdit(event) {
    event.preventDefault();
    const data = this.prepareMedicationPayload(event.target);
    const medId = data.medication_id;
    delete data.medication_id;
    await this.api(`/api/family/animals/pets/medications/${medId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    this.state.editingMedId = null;
    this.showToast('Medication updated');
    await this.refreshAfterDetailChange();
  },

  async stopMedication(id) {
    const ok = await this.confirmModal('Stop medication', 'Stop this medication?', 'Stop');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/medications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 0 }),
    });
    this.showToast('Medication stopped');
    await this.refreshAfterDetailChange();
  },

  async deleteMedication(id) {
    const ok = await this.confirmModal('Delete medication', 'Delete this medication and all dose history?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/medications/${id}`, { method: 'DELETE' });
    this.showToast('Medication deleted');
    await this.refreshAfterDetailChange();
  },

  async markDoseGiven(medId, logId) {
    await this.api(`/api/family/animals/pets/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logId ? { log_id: logId } : {}),
    });
    this.showToast('Dose recorded');
    await this.refreshAfterDetailChange();
  },

  async undoDose(logId) {
    await this.api(`/api/family/animals/pets/medication-logs/${logId}/undo-dose`, { method: 'POST' });
    this.showToast('Dose marked not yet');
    await this.refreshAfterDetailChange();
  },

  async skipDose(logId) {
    await this.api(`/api/family/animals/pets/medication-logs/${logId}/skip-dose`, { method: 'POST' });
    this.showToast('Dose skipped');
    await this.refreshAfterDetailChange();
  },

  async undoSkip(logId) {
    await this.api(`/api/family/animals/pets/medication-logs/${logId}/undo-skip`, { method: 'POST' });
    this.showToast('Back to due');
    await this.refreshAfterDetailChange();
  },

  async toggleOutOfStock(medId, currentValue) {
    await this.api(`/api/family/animals/pets/medications/${medId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ out_of_stock: currentValue ? 0 : 1 }),
    });
    this.showToast(currentValue ? 'Marked back in stock' : 'Marked out of stock');
    await this.refreshAfterDetailChange();
  },

  async saveDatedNote(event) {
    event.preventDefault();
    if (!this.state.currentPet) return;
    const data = this.formToObject(event.target);
    if (data.note_id) {
      await this.api(`/api/family/animals/pets/notes/${data.note_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      this.showToast('Note updated');
    } else {
      await this.api(`/api/family/animals/pets/pets/${this.state.currentPet.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      this.showToast('Note saved');
    }
    this.state.editingNoteId = null;
    await this.refreshAfterDetailChange();
  },

  async deleteNote(id) {
    const ok = await this.confirmModal('Delete note', 'Delete this dated note?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/notes/${id}`, { method: 'DELETE' });
    this.showToast('Note deleted');
    this.state.editingNoteId = null;
    await this.refreshAfterDetailChange();
  },

  async addWeight(event) {
    event.preventDefault();
    if (!this.state.currentPet) return;
    await this.api(`/api/family/animals/pets/pets/${this.state.currentPet.id}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.formToObject(event.target)),
    });
    this.showToast('Weight saved');
    await this.refreshAfterDetailChange();
  },

  async deleteWeight(id) {
    const ok = await this.confirmModal('Delete weight', 'Delete this recorded weight?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/weights/${id}`, { method: 'DELETE' });
    this.showToast('Weight deleted');
    await this.refreshAfterDetailChange();
  },

  async uploadPhoto(event) {
    event.preventDefault();
    if (!this.state.currentPet) return;
    const res = await fetch(`/api/family/animals/pets/pets/${this.state.currentPet.id}/photos`, {
      method: 'POST',
      body: new FormData(event.target),
    });
    if (!res.ok) throw new Error('Photo upload failed');
    this.showToast('Photo uploaded');
    await this.refreshAfterDetailChange();
  },

  async deletePhoto(id) {
    const ok = await this.confirmModal('Delete photo', 'Delete this photo?', 'Delete');
    if (!ok) return;
    await this.api(`/api/family/animals/pets/photos/${id}`, { method: 'DELETE' });
    this.showToast('Photo deleted');
    await this.refreshAfterDetailChange();
  },

  renderWeightChart(weights) {
    if (this.state.weightChart) {
      this.state.weightChart.destroy();
      this.state.weightChart = null;
    }
    const canvas = document.getElementById('weight-chart');
    if (!canvas || !window.Chart) return;
    const styles = getComputedStyle(document.body);
    const lineColor = styles.getPropertyValue('--leaf').trim() || '#2f7d52';
    this.state.weightChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: weights.map(weight => weight.weight_date),
        datasets: [{
          label: 'Weight (lb)',
          data: weights.map(weight => Number(weight.weight_lbs)),
          borderColor: lineColor,
          backgroundColor: `${lineColor}22`,
          pointBackgroundColor: lineColor,
          pointBorderColor: lineColor,
          borderWidth: 2,
          tension: 0.25,
          fill: weights.length > 1,
        }],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, ticks: { callback: value => `${value} lb` } },
        },
      },
    });
  },

  renderStats() {
    const s = this.state.summary || {};
    const statusCounts = {};
    const typeCounts = {};
    (s.byStatus || []).forEach(row => { statusCounts[row.status] = row.count; });
    (s.byType || []).forEach(row => { typeCounts[row.animal_type] = row.count; });
    const typeHtml = (s.byType || []).map(row => `<div class="row small"><span>${this.esc(row.animal_type)}</span><strong>${this.esc(row.count)}</strong></div>`).join('');
    document.getElementById('pet-stats-grid').innerHTML =
      this.metric('Total pets', s.total || 0) +
      this.metric('Active', statusCounts.active || 0, false, 'status-active') +
      this.metric('Inactive', statusCounts.inactive || 0, false, 'status-inactive') +
      this.metric('Dogs', typeCounts.dog || 0) +
      this.metric('Cats', typeCounts.cat || 0) +
      this.metric('Active meds', s.activeMeds || 0) +
      `<div class="panel"><h3>Pets by type</h3><div class="stat-list">${typeHtml || '<span class="muted">No data</span>'}</div></div>`;
  },

  loadPets() {
    clearTimeout(this.state.petLoadTimer);
    this.state.petLoadTimer = setTimeout(async () => {
      const params = new URLSearchParams();
      const search = document.getElementById('pet-search').value;
      const animalType = document.getElementById('pet-type-filter').value;
      const status = document.getElementById('pet-status-filter').value;
      if (search) params.set('search', search);
      if (animalType) params.set('animalType', animalType);
      if (status) params.set('status', status);
      this.state.pets = (await this.api(`/api/family/animals/pets/pets?${params}`)).pets;
      this.renderPets();
    }, 150);
  },

  async refreshAfterDetailChange() {
    const petId = this.state.currentPet && this.state.currentPet.id;
    await this.loadAll();
    if (petId) await this.openPet(petId);
  },

  async loadAll() {
    this.state.summary = await this.api('/api/family/animals/pets/summary');
    this.renderSummary();
    this.renderOverview();
    this.renderStats();
    this.loadPets();
  },
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action], [data-view-jump]');
  if (!target) return;
  if (target.dataset.viewJump) PetsApp.showView(target.dataset.viewJump);
  const action = target.dataset.action;
  if (action === 'open-pet') PetsApp.openPet(target.dataset.petId);
  if (action === 'delete-pet') PetsApp.deletePet(target.dataset.petId);
  if (action === 'edit-note') { PetsApp.state.editingNoteId = Number(target.dataset.noteId); PetsApp.renderPetDetail(); }
  if (action === 'cancel-note-edit') { PetsApp.state.editingNoteId = null; PetsApp.renderPetDetail(); }
  if (action === 'delete-note') PetsApp.deleteNote(target.dataset.noteId);
  if (action === 'delete-weight') PetsApp.deleteWeight(target.dataset.weightId);
  if (action === 'delete-photo') PetsApp.deletePhoto(target.dataset.photoId);
  if (action === 'mark-dose') PetsApp.markDoseGiven(target.dataset.medId, target.dataset.logId || null);
  if (action === 'undo-dose') PetsApp.undoDose(target.dataset.logId);
  if (action === 'skip-dose') PetsApp.skipDose(target.dataset.logId);
  if (action === 'undo-skip') PetsApp.undoSkip(target.dataset.logId);
  if (action === 'toggle-out-of-stock') PetsApp.toggleOutOfStock(target.dataset.medId, Number(target.dataset.outOfStock));
  if (action === 'stop-med') PetsApp.stopMedication(target.dataset.medId);
  if (action === 'delete-med') PetsApp.deleteMedication(target.dataset.medId);
  if (action === 'edit-med') { PetsApp.state.editingMedId = Number(target.dataset.medId); PetsApp.renderPetDetail(); }
  if (action === 'cancel-med-edit') { PetsApp.state.editingMedId = null; PetsApp.renderPetDetail(); }
});

document.addEventListener('DOMContentLoaded', () => PetsApp.init());

const AnimalsApp = {
  state: { summary: null },

  init() {
    const refresh = document.querySelector('[data-action="refresh"]');
    if (refresh) refresh.addEventListener('click', () => this.load());
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'mark-dose') this.markDose(target.dataset.source, target.dataset.medId, target.dataset.logId);
      if (action === 'skip-dose') this.skipDose(target.dataset.source, target.dataset.logId);
    });
    this.load().catch(err => this.showToast(err.message));
  },

  esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  metric(label, value, hot) {
    return `<div class="metric${hot ? ' danger' : ''}"><div class="metric-value">${this.esc(value)}</div><div class="metric-label">${this.esc(label)}</div></div>`;
  },

  renderSummary() {
    const s = this.state.summary || {};
    const petDue = ((s.dueItems || []).filter(item => item.source === 'pet')).length;
    const pigeonDue = ((s.dueItems || []).filter(item => item.source === 'pigeon')).length;
    document.getElementById('animal-summary-grid').innerHTML =
      this.metric('Overdue', s.overdueCount || 0, (s.overdueCount || 0) > 0) +
      this.metric('Due today', s.dueTodayCount || 0, (s.dueTodayCount || 0) > 0) +
      this.metric('Pets due', petDue, petDue > 0) +
      this.metric('Pigeons due', pigeonDue, pigeonDue > 0);
  },

  renderDose(item, completed = false) {
    const label = item.source === 'pet' ? 'Pet' : 'Pigeon';
    const overdueClass = item.overdue ? ' overdue' : '';
    const completedClass = completed ? ' completed' : overdueClass;
    const timeLabel = completed ? 'Given' : (item.overdue ? 'Overdue' : 'Due');
    const timeValue = completed ? item.completedDatetime : item.scheduledDatetime;
    const actions = completed ? '<span class="pill completed">Recorded</span>' : `
      <button class="primary" data-action="mark-dose" data-source="${this.esc(item.source)}" data-med-id="${Number(item.medicationId)}" data-log-id="${Number(item.logId)}">Mark given</button>
      <button data-action="skip-dose" data-source="${this.esc(item.source)}" data-log-id="${Number(item.logId)}">No meds</button>
      <a href="${this.esc(item.openHref)}"><button type="button">Open</button></a>
    `;
    return `
      <article class="dose-row${completedClass}">
        <div>
          <div class="dose-title">${this.esc(item.animalName || 'Unnamed')} <span class="pill">${this.esc(label)}</span></div>
          <div class="dose-med">${this.esc(item.kind)}: ${this.esc(item.name)} ${this.esc(item.dosage || '')}</div>
          <div class="dose-time${item.overdue ? ' overdue' : ''}">${this.esc(timeLabel)}: ${this.esc(this.formatDateTime(timeValue))}</div>
        </div>
        <div class="dose-actions">${actions}</div>
      </article>`;
  },

  renderLists() {
    const s = this.state.summary || {};
    const due = s.dueItems || [];
    const completed = s.completedItems || [];
    document.getElementById('animal-due-list').innerHTML = due.length
      ? due.map(item => this.renderDose(item)).join('')
      : '<div class="panel muted">No animals need medication right now.</div>';
    document.getElementById('animal-completed-list').innerHTML = completed.length
      ? completed.map(item => this.renderDose(item, true)).join('')
      : '<div class="panel muted">No medication recorded yet today.</div>';
  },

  async markDose(source, medId, logId) {
    const base = source === 'pet' ? '/api/family/animals/pets' : '/api/family/pigeons';
    await this.api(`${base}/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: logId }),
    });
    this.showToast('Dose recorded');
    await this.load();
  },

  async skipDose(source, logId) {
    const base = source === 'pet' ? '/api/family/animals/pets' : '/api/family/pigeons';
    await this.api(`${base}/medication-logs/${logId}/skip-dose`, { method: 'POST' });
    this.showToast('Dose skipped');
    await this.load();
  },

  async load() {
    this.state.summary = await this.api('/api/family/animals/summary');
    this.renderSummary();
    this.renderLists();
  },
};

document.addEventListener('DOMContentLoaded', () => AnimalsApp.init());

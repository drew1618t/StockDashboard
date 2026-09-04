/* Family Hub browser behavior: greeting, todos split by person, pinboard, animals summary,
   and the phone-only name switch. Markup comes from server/familyPages.js. */

var Q = String.fromCharCode(39);
var phone = window.matchMedia('(max-width: 900px)');
var wrap = document.querySelector('.wrap');
var ME = wrap.getAttribute('data-me') || 'A';
var THEM = wrap.getAttribute('data-them') || 'K';
var ME_NAME = wrap.getAttribute('data-user-name') || 'Andrew';
var THEM_NAME = wrap.getAttribute('data-them-name') || 'Kaili';

var todoData = null;
var pinboardData = null;
var editingPinboardId = null;
var expandedProjects = {};

/* ------ Helpers ------ */

// Escape text for insertion into innerHTML.
function esc(s) {
  var d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// Short relative date for notes: Today, Yesterday, or "Sep 4".
function relDate(value) {
  var d = new Date(value);
  if (isNaN(d.getTime())) return '';
  var diffDays = Math.floor((new Date() - d) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Compact numeric date for task rows, e.g. "03-21".
function shortDate(value) {
  var d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Pluralize a simple noun.
function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

/* ------ Greeting and date ------ */
(function () {
  var now = new Date();
  var hour = now.getHours();
  var greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  var greetWord = document.getElementById('greet-word');
  if (greetWord) greetWord.textContent = greeting;

  // Phone headline, split into words so each rises in sequence.
  var headline = document.getElementById('greeting-text');
  if (headline) {
    headline.innerHTML = (greeting + ', ' + ME_NAME + '.').split(' ').map(function (w, i) {
      return '<span class="w" style="animation-delay:' + (i * 0.08) + 's">' + esc(w) + '</span>';
    }).join(' ');
  }

  var dateline = document.getElementById('dateline');
  if (dateline) dateline.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  var topDate = document.getElementById('top-date');
  if (topDate) {
    var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    topDate.textContent = days[now.getDay()] + ' ' + now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
      + ' · ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }
})();

/* ------ Desktop edge tint and phone name switch ------ */
document.querySelectorAll('.person-col').forEach(function (col) {
  var cls = col.classList.contains('me') ? 'tint-left' : 'tint-right';
  col.addEventListener('mouseenter', function () { if (!phone.matches) document.body.classList.add(cls); });
  col.addEventListener('mouseleave', function () { document.body.classList.remove(cls); });
});

// On the phone, tapping a name switches whose tasks are shown.
document.querySelectorAll('.person-head').forEach(function (head) {
  head.addEventListener('click', function (ev) {
    if (!phone.matches) return;
    if (ev.target.closest('.health')) return;
    var who = head.getAttribute('data-who');
    document.querySelectorAll('.person-head, .person-tasks').forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-who') === who);
    });
  });
});

// Status strip links scroll to their section eyebrow.
document.querySelectorAll('.strip a').forEach(function (a) {
  a.addEventListener('click', function (ev) {
    ev.preventDefault();
    var target = document.querySelector('.eyebrow.' + a.getAttribute('data-go'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ------ Pinboard ------ */

function authorClass(author) {
  return String(author || '').toLowerCase().charAt(0) === 'k' ? 'note-from-k' : 'note-from-a';
}

function renderPinboard() {
  var container = document.getElementById('pinboard-list');
  if (!container) return;
  var notes = pinboardData && pinboardData.notes ? pinboardData.notes : [];
  var countEl = document.getElementById('pinboard-count');
  if (countEl) countEl.textContent = String(notes.length);
  var strip = document.getElementById('strip-board');
  if (strip) strip.textContent = notes.length ? plural(notes.length, 'note') + ' pinned.' : 'Nothing pinned.';
  if (!notes.length) {
    container.innerHTML = '<div class="notes-empty">Nothing pinned yet.</div>';
    return;
  }
  var html = '';
  notes.forEach(function (note) {
    html += '<div class="note ' + authorClass(note.author) + '">';
    if (editingPinboardId === note.id) {
      html += '<div class="note-edit">'
        + '<textarea id="pinboard-edit-text-' + note.id + '">' + esc(note.text) + '</textarea>'
        + '<div class="note-edit-actions">'
        + '<select id="pinboard-edit-author-' + note.id + '">'
        + '<option value="Andrew"' + (note.author === 'Andrew' ? ' selected' : '') + '>Andrew</option>'
        + '<option value="Kaili"' + (note.author === 'Kaili' ? ' selected' : '') + '>Kaili</option>'
        + '</select>'
        + '<button class="secondary" onclick="cancelEditPinboard()">Cancel</button>'
        + '<button onclick="savePinboardEdit(' + Q + note.id + Q + ')">Save</button>'
        + '</div></div>';
    } else {
      html += '<p class="note-text">' + esc(note.text) + '</p>'
        + '<div class="note-foot">'
        + '<span class="note-meta">' + esc(note.author) + ' · ' + esc(relDate(note.updatedAt || note.createdAt)) + '</span>'
        + '<span class="note-actions">'
        + '<button class="note-btn" onclick="startEditPinboard(' + Q + note.id + Q + ')">Edit</button>'
        + '<button class="note-btn note-delete-btn" onclick="deletePinboardNote(' + Q + note.id + Q + ')">Delete</button>'
        + '</span></div>';
    }
    html += '</div>';
  });
  container.innerHTML = html;
}

function loadPinboard() {
  fetch('/api/family/pinboard')
    .then(function (r) { return r.json(); })
    .then(function (data) { pinboardData = data; renderPinboard(); })
    .catch(function () {
      var container = document.getElementById('pinboard-list');
      if (container) container.innerHTML = '<div class="notes-empty">Could not load pinboard.</div>';
    });
}

function addPinboardNote() {
  var input = document.getElementById('pinboard-input');
  var author = document.getElementById('pinboard-author');
  var text = input.value.trim();
  if (!text) return;
  fetch('/api/family/pinboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, author: author.value })
  }).then(function () { input.value = ''; loadPinboard(); });
}

function startEditPinboard(id) { editingPinboardId = id; renderPinboard(); }
function cancelEditPinboard() { editingPinboardId = null; renderPinboard(); }

function savePinboardEdit(id) {
  var textEl = document.getElementById('pinboard-edit-text-' + id);
  var authorEl = document.getElementById('pinboard-edit-author-' + id);
  if (!textEl) return;
  var text = textEl.value.trim();
  if (!text) return;
  fetch('/api/family/pinboard/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, author: authorEl ? authorEl.value : 'Andrew' })
  }).then(function () { editingPinboardId = null; loadPinboard(); });
}

function deletePinboardNote(id) {
  fetch('/api/family/pinboard/' + id, { method: 'DELETE' })
    .then(function () {
      if (editingPinboardId === id) editingPinboardId = null;
      loadPinboard();
    });
}

/* ------ Todos ------ */

function renderSubTask(sub) {
  var cls = sub.done ? 'sub-task-item done' : 'sub-task-item';
  return '<li class="' + cls + '">'
    + '<span class="sub-check" onclick="toggleTodo(' + Q + sub.id + Q + ')"></span>'
    + '<span class="sub-text" onclick="toggleTodo(' + Q + sub.id + Q + ')">' + esc(sub.text) + '</span>'
    + '<button class="sub-delete" onclick="deleteTodo(' + Q + sub.id + Q + ')" title="Delete">&times;</button>'
    + '</li>';
}

// Expandable project body: goal, phases with sub-tasks, ongoing items, and a decision log.
function renderProject(t) {
  var p = t.project;
  var isOpen = expandedProjects[t.id];
  var html = '<button class="todo-project-toggle" onclick="toggleExpand(' + Q + t.id + Q + ')">'
    + '<span class="' + (isOpen ? 'arrow open' : 'arrow') + '">&#9654;</span> Project'
    + '</button>';
  html += '<div class="' + (isOpen ? 'todo-project-body open' : 'todo-project-body') + '" id="project-' + t.id + '">';
  if (p.goal) html += '<div class="project-goal">' + esc(p.goal) + '</div>';

  (p.phases || []).forEach(function (phase) {
    var items = phase.items || [];
    var doneCount = items.filter(function (s) { return s.done; }).length;
    html += '<div class="project-phase">'
      + '<div class="project-phase-name">' + esc(phase.name)
      + '<span class="project-phase-progress">' + doneCount + '/' + items.length + '</span></div>'
      + '<ul class="sub-task-list">' + items.map(renderSubTask).join('') + '</ul>'
      + '<div class="sub-add-row">'
      + '<input type="text" placeholder="Add sub-task..." id="sub-input-' + t.id + '-' + esc(phase.name) + '" '
      + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')" />'
      + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')">+</button>'
      + '</div></div>';
  });

  if (p.ongoing && p.ongoing.length > 0) {
    html += '<div class="project-section-label">Ongoing</div>'
      + '<ul class="sub-task-list">' + p.ongoing.map(renderSubTask).join('') + '</ul>';
  }
  html += '<div class="sub-add-row">'
    + '<input type="text" placeholder="Add ongoing task..." id="sub-input-' + t.id + '-__ongoing" '
    + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')" />'
    + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')">+</button>'
    + '</div>';

  if (p.decisionLog && p.decisionLog.length > 0) {
    html += '<div class="project-section-label">Decision Log</div><div class="decision-log">';
    p.decisionLog.forEach(function (entry) {
      html += '<div class="decision-entry"><span class="decision-date">' + esc(entry.date) + '</span><span>' + esc(entry.entry) + '</span></div>';
    });
    html += '</div>';
  }
  html += '<div class="decision-add-row">'
    + '<input type="text" placeholder="Add decision note..." id="decision-input-' + t.id + '" '
    + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addDecision(' + Q + t.id + Q + ')" />'
    + '<button onclick="addDecision(' + Q + t.id + Q + ')">+</button>'
    + '</div></div>';
  return html;
}

// One task row. The column already says whose task it is, so no assignee badge.
function renderItem(t) {
  var cls = t.done ? 'todo-item done' : 'todo-item';
  var note = t.note ? '<span class="todo-note">' + esc(t.note) + '</span>' : '';
  var completed = (t.done && t.completedAt)
    ? '<div class="todo-completed-date">done ' + shortDate(t.completedAt) + '</div>' : '';
  var projectHtml = t.project ? renderProject(t) : '';
  var actionBtn = t.project
    ? '<button class="todo-action-btn" onclick="event.stopPropagation();toggleExpand(' + Q + t.id + Q + ')" title="Expand project">&#9776;</button>'
    : '<button class="todo-action-btn" onclick="event.stopPropagation();showProjectModal(' + Q + t.id + Q + ',' + Q + esc(t.text) + Q + ')" title="Make project">&#9776;</button>';
  return '<li class="' + cls + '" data-id="' + esc(t.id) + '">'
    + '<span class="todo-check" onclick="toggleTodo(' + Q + t.id + Q + ')"></span>'
    + '<div class="todo-content">'
    + '<span class="todo-text"' + (t.project ? '' : ' style="cursor:pointer" onclick="toggleTodo(' + Q + t.id + Q + ')"') + '>' + esc(t.text) + '</span>'
    + note + completed + projectHtml
    + '</div>'
    + actionBtn
    + '<button class="todo-delete" onclick="deleteTodo(' + Q + t.id + Q + ')" title="Delete">&times;</button>'
    + '</li>';
}

// Assignee letter for a task, or '' when unassigned.
function whoOf(t) {
  var a = String(t.assignee || '').toUpperCase();
  return a === 'A' || a === 'K' ? a : '';
}

function openCount(items) {
  return items.filter(function (t) { return !t.done; }).length;
}

// Build one person's (or the unassigned) task list from the shared todo data.
function renderBucket(who) {
  var sections = (todoData && todoData.sections) || [];
  var html = '';
  var total = 0;
  var open = 0;

  sections.forEach(function (section) {
    if (section.name === 'Long Term') {
      var cats = (section.categories || []).map(function (cat) {
        return { name: cat.name, items: (cat.items || []).filter(function (t) { return whoOf(t) === who; }) };
      }).filter(function (cat) { return cat.items.length; });
      var ltItems = cats.reduce(function (acc, cat) { return acc.concat(cat.items); }, []);
      if (!ltItems.length) return;
      total += ltItems.length;
      open += openCount(ltItems);
      html += '<div class="h">Long term <b>' + openCount(ltItems) + ' open</b></div>';
      cats.forEach(function (cat) {
        html += '<div class="cat">' + esc(cat.name) + '</div><ul class="todo-list">' + cat.items.map(renderItem).join('') + '</ul>';
      });
      return;
    }
    var items = (section.items || []).filter(function (t) { return whoOf(t) === who; });
    if (!items.length) return;
    total += items.length;
    open += openCount(items);
    var label = section.name === 'Recently Completed' ? 'Done <b>recent</b>' : esc(section.name) + ' <b>' + openCount(items) + ' open</b>';
    html += '<div class="h">' + label + '</div><ul class="todo-list">' + items.map(renderItem).join('') + '</ul>';
  });

  return { html: html, total: total, open: open };
}

function renderAllSections(data) {
  todoData = data;
  var counts = {};
  ['A', 'K', ''].forEach(function (who) {
    var bucket = renderBucket(who);
    counts[who] = bucket.open;
    var el = document.getElementById(who ? 'tasks-' + who : 'tasks-none');
    if (el) el.innerHTML = bucket.html || (who ? '<div class="tasks-empty">Nothing assigned.</div>' : '');
  });

  var unassignedBlk = document.getElementById('unassigned-blk');
  if (unassignedBlk) unassignedBlk.hidden = !counts[''];
  var unassignedCount = document.getElementById('unassigned-count');
  if (unassignedCount) unassignedCount.textContent = String(counts['']);

  var strip = document.getElementById('strip-tasks');
  if (strip) strip.textContent = plural(counts[ME], 'task') + ' for you, ' + counts[THEM] + ' for ' + THEM_NAME + '.';
  updateCategoryDropdown();
}

function updateCategoryDropdown() {
  var sectionSel = document.getElementById('todo-section');
  var catSel = document.getElementById('todo-category');
  if (sectionSel.value === 'Long Term' && todoData) {
    var lt = todoData.sections.find(function (s) { return s.name === 'Long Term'; });
    catSel.innerHTML = ((lt && lt.categories) || []).map(function (c) {
      return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
    }).join('');
    catSel.style.display = '';
  } else {
    catSel.style.display = 'none';
  }
}

function loadTodos() {
  fetch('/api/family/todos')
    .then(function (r) { return r.json(); })
    .then(renderAllSections)
    .catch(function () {
      var el = document.getElementById('tasks-' + ME);
      if (el) el.innerHTML = '<div class="tasks-empty">Could not load tasks.</div>';
    });
}

function toggleTodo(id) {
  fetch('/api/family/todos/' + id + '/toggle', { method: 'PATCH' }).then(loadTodos);
}

function deleteTodo(id) {
  fetch('/api/family/todos/' + id, { method: 'DELETE' }).then(loadTodos);
}

function addTodo() {
  var input = document.getElementById('todo-input');
  var assigneeSel = document.getElementById('todo-assignee');
  var sectionSel = document.getElementById('todo-section');
  var catSel = document.getElementById('todo-category');
  var text = input.value.trim();
  if (!text) return;
  var body = { text: text, assignee: assigneeSel.value || null, section: sectionSel.value };
  if (sectionSel.value === 'Long Term' && catSel.value) body.category = catSel.value;
  fetch('/api/family/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function () { input.value = ''; assigneeSel.value = ''; loadTodos(); });
}

function toggleExpand(id) {
  expandedProjects[id] = !expandedProjects[id];
  var body = document.getElementById('project-' + id);
  if (body) body.classList.toggle('open');
  var arrow = body && body.previousElementSibling ? body.previousElementSibling.querySelector('.arrow') : null;
  if (arrow) arrow.classList.toggle('open');
}

function addSubTask(parentId, phaseName) {
  var input = document.getElementById('sub-input-' + parentId + '-' + phaseName);
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  fetch('/api/family/todos/' + parentId + '/subtask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase: phaseName, text: text })
  }).then(function () { input.value = ''; loadTodos(); });
}

function addDecision(parentId) {
  var input = document.getElementById('decision-input-' + parentId);
  if (!input) return;
  var entry = input.value.trim();
  if (!entry) return;
  fetch('/api/family/todos/' + parentId + '/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry: entry })
  }).then(function () { input.value = ''; loadTodos(); });
}

/* ------ Project modal ------ */
var projectModalPhases = ['Phase 1'];

function showProjectModal(id, name) {
  projectModalPhases = ['Phase 1'];
  var overlay = document.createElement('div');
  overlay.className = 'project-modal-overlay';
  overlay.id = 'project-modal-overlay';
  overlay.onclick = function (e) { if (e.target === overlay) closeProjectModal(); };
  overlay.innerHTML = '<div class="project-modal">'
    + '<h3>Make "' + esc(name) + '" a project</h3>'
    + '<label>Goal</label>'
    + '<input type="text" id="pm-goal" placeholder="What is the end goal?" />'
    + '<label>Phases</label>'
    + '<div id="pm-phases"></div>'
    + '<button class="add-phase-btn" onclick="addModalPhase()">+ Add phase</button>'
    + '<div class="project-modal-actions">'
    + '<button class="cancel-btn" onclick="closeProjectModal()">Cancel</button>'
    + '<button class="create-btn" onclick="createProject(' + Q + id + Q + ')">Create project</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  renderModalPhases();
  document.getElementById('pm-goal').focus();
}

function renderModalPhases() {
  var container = document.getElementById('pm-phases');
  if (!container) return;
  container.innerHTML = projectModalPhases.map(function (p, i) {
    return '<div class="phase-row">'
      + '<input type="text" class="pm-phase-input" value="' + esc(p) + '" oninput="projectModalPhases[' + i + ']=this.value" placeholder="Phase name..." />'
      + (projectModalPhases.length > 1 ? '<button class="phase-remove" onclick="removeModalPhase(' + i + ')">&times;</button>' : '')
      + '</div>';
  }).join('');
}

function addModalPhase() { projectModalPhases.push('Phase ' + (projectModalPhases.length + 1)); renderModalPhases(); }
function removeModalPhase(i) { projectModalPhases.splice(i, 1); renderModalPhases(); }
function closeProjectModal() {
  var overlay = document.getElementById('project-modal-overlay');
  if (overlay) overlay.remove();
}

function createProject(id) {
  var goal = document.getElementById('pm-goal').value.trim();
  var phases = projectModalPhases
    .map(function (p) { return p.trim(); })
    .filter(function (p) { return p.length > 0; })
    .map(function (p) { return { name: p, items: [] }; });
  if (phases.length === 0) phases = [{ name: 'Phase 1', items: [] }];
  fetch('/api/family/todos/' + id + '/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: goal, phases: phases, ongoing: [], decisionLog: [] })
  }).then(function () { closeProjectModal(); expandedProjects[id] = true; loadTodos(); });
}

/* ------ Long-term categories ------ */
function showAddCategory() {
  var row = document.getElementById('add-cat-row');
  if (!row) return;
  var opening = row.style.display === 'none';
  row.style.display = opening ? 'inline-flex' : 'none';
  if (opening) document.getElementById('new-cat-input').focus();
}

function addCategory() {
  var input = document.getElementById('new-cat-input');
  if (!input) return;
  var name = input.value.trim();
  if (!name) return;
  fetch('/api/family/todos/category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  }).then(function () { input.value = ''; document.getElementById('add-cat-row').style.display = 'none'; loadTodos(); });
}

/* ------ Animals ------ */

// Time of day for a scheduled dose, or ANY when the dose has no time.
function doseTime(value) {
  var d = new Date(value);
  if (isNaN(d.getTime())) return 'ANY';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function loadAnimalSummary() {
  fetch('/api/family/animals/summary')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var due = data && typeof data.dueTodayCount === 'number' ? data.dueTodayCount : 0;
      var overdue = data && typeof data.overdueCount === 'number' ? data.overdueCount : 0;
      var items = (data && data.dueItems) || [];

      var dueEl = document.getElementById('animal-due-count');
      if (dueEl) dueEl.textContent = String(due);
      var medEl = document.getElementById('animal-med-count');
      if (medEl) medEl.textContent = overdue > 0 ? overdue + ' overdue' : (due > 0 ? due + ' due' : 'all clear');

      var list = document.getElementById('animal-due-list');
      if (list) {
        list.innerHTML = items.slice(0, 6).map(function (item) {
          return '<a class="med' + (item.overdue ? ' over' : '') + '" href="' + esc(item.openHref || '/family/animals') + '">'
            + '<span>' + esc(item.animalName) + ', ' + esc(item.name) + '</span>'
            + '<span class="d">' + (item.overdue ? 'OVERDUE' : doseTime(item.scheduledDatetime)) + '</span></a>';
        }).join('');
      }

      var strip = document.getElementById('strip-animals');
      if (strip) {
        if (!due) { strip.textContent = 'No meds due.'; strip.classList.add('quiet'); }
        else strip.textContent = plural(due, 'med') + ' due' + (overdue ? ', ' + overdue + ' overdue.' : '.');
      }
    })
    .catch(function () {
      var dueEl = document.getElementById('animal-due-count');
      if (dueEl) dueEl.textContent = '--';
    });
}

/* ------ Wire up ------ */
document.getElementById('todo-section').addEventListener('change', updateCategoryDropdown);
document.getElementById('new-cat-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
});
document.getElementById('pinboard-input').addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addPinboardNote();
});

loadTodos();
loadAnimalSummary();
loadPinboard();

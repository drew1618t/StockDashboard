    /* ------ Color Scheme Switcher ------ */
    function switchScheme(scheme) {
      document.documentElement.setAttribute('data-bento', scheme);
      localStorage.setItem('family-bento-scheme', scheme);
      updateSwatches();
    }
    function updateSwatches() {
      var current = document.documentElement.getAttribute('data-bento') || 'peach';
      document.querySelectorAll('.bento-swatch').forEach(function(sw) {
        sw.classList.toggle('active', sw.getAttribute('data-scheme') === current);
      });
    }
    updateSwatches();

    /* ------ Time-Aware Greeting ------ */
    (function() {
      var hour = new Date().getHours();
      var greeting = 'Good evening';
      if (hour < 12) greeting = 'Good morning';
      else if (hour < 17) greeting = 'Good afternoon';

      var el = document.getElementById('greeting-text');
      var hub = document.querySelector('.hub-wrap');
      var userName = hub ? hub.getAttribute('data-user-name') : 'Andrew & Kaili';
      if (el) el.textContent = greeting + ', ' + userName + '.';

      var sub = document.getElementById('greeting-sub');
      if (sub) {
        var opts = { weekday: 'long', month: 'long', day: 'numeric' };
        sub.textContent = new Date().toLocaleDateString('en-US', opts);
      }
    })();

    /* ------ Todo API ------ */
    var Q = String.fromCharCode(39);
    var todoData = null;
    var pinboardData = null;
    var editingPinboardId = null;
    var expandedProjects = {};

    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function relDate(value) {
      var d = new Date(value);
      if (isNaN(d.getTime())) return '';
      var now = new Date();
      var diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
      if (diffDays <= 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function authorClass(author) {
      return String(author || '').toLowerCase().charAt(0) === 'k' ? 'note-from-k' : 'note-from-a';
    }

    function renderPinboard() {
      var container = document.getElementById('pinboard-list');
      if (!container) return;
      var notes = pinboardData && pinboardData.notes ? pinboardData.notes : [];
      if (!notes.length) {
        container.innerHTML = '<div class="notes-empty">Nothing pinned yet.</div>';
        return;
      }
      var html = '';
      notes.forEach(function(note) {
        var isEditing = editingPinboardId === note.id;
        html += '<div class="note-item ' + authorClass(note.author) + '">';
        if (isEditing) {
          html += '<div class="note-edit">'
            + '<div class="note-edit-top">'
            + '<select id="pinboard-edit-author-' + note.id + '">'
            + '<option value="Andrew"' + (note.author === 'Andrew' ? ' selected' : '') + '>Andrew</option>'
            + '<option value="Kaili"' + (note.author === 'Kaili' ? ' selected' : '') + '>Kaili</option>'
            + '</select>'
            + '<div class="note-meta">Editing note</div>'
            + '</div>'
            + '<textarea id="pinboard-edit-text-' + note.id + '">' + esc(note.text) + '</textarea>'
            + '<div class="note-edit-actions">'
            + '<button class="secondary" onclick="cancelEditPinboard()">Cancel</button>'
            + '<button onclick="savePinboardEdit(' + Q + note.id + Q + ')">Save</button>'
            + '</div>'
            + '</div>';
        } else {
          html += '<div class="note-head">'
            + '<div class="note-top">'
            + '<div class="note-meta">' + esc(note.author) + ' &middot; ' + esc(relDate(note.updatedAt || note.createdAt)) + '</div>'
            + '<div class="note-actions">'
            + '<button class="note-btn" onclick="startEditPinboard(' + Q + note.id + Q + ')">Edit</button>'
            + '<button class="note-btn note-delete-btn" onclick="deletePinboardNote(' + Q + note.id + Q + ')">Delete</button>'
            + '</div>'
            + '</div>'
            + '<div>'
            + '<div class="note-text">' + esc(note.text) + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
        }
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function loadPinboard() {
      fetch('/api/family/pinboard')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          pinboardData = data;
          renderPinboard();
        })
        .catch(function() {
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
      }).then(function() {
        input.value = '';
        loadPinboard();
      });
    }

    function startEditPinboard(id) {
      editingPinboardId = id;
      renderPinboard();
    }

    function cancelEditPinboard() {
      editingPinboardId = null;
      renderPinboard();
    }

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
      }).then(function() {
        editingPinboardId = null;
        loadPinboard();
      });
    }

    function deletePinboardNote(id) {
      fetch('/api/family/pinboard/' + id, { method: 'DELETE' })
        .then(function() {
          if (editingPinboardId === id) editingPinboardId = null;
          loadPinboard();
        });
    }

    function renderSubTask(sub, parentId) {
      var cls = sub.done ? 'sub-task-item done' : 'sub-task-item';
      var check = sub.done ? '&#10003;' : '';
      return '<li class="' + cls + '">'
        + '<span class="sub-check" onclick="toggleTodo(' + Q + sub.id + Q + ')">' + check + '</span>'
        + '<span class="sub-text" onclick="toggleTodo(' + Q + sub.id + Q + ')">' + esc(sub.text) + '</span>'
        + '<button class="sub-delete" onclick="deleteTodo(' + Q + sub.id + Q + ')" title="Delete">&times;</button>'
        + '</li>';
    }

    function renderProject(t) {
      var p = t.project;
      var isOpen = expandedProjects[t.id];
      var arrowCls = isOpen ? 'arrow open' : 'arrow';
      var bodyCls = isOpen ? 'todo-project-body open' : 'todo-project-body';

      var html = '<button class="todo-project-toggle" onclick="toggleExpand(' + Q + t.id + Q + ')">'
        + '<span class="' + arrowCls + '">&#9654;</span> Project'
        + '</button>';
      html += '<div class="' + bodyCls + '" id="project-' + t.id + '">';

      if (p.goal) {
        html += '<div class="project-goal">' + esc(p.goal) + '</div>';
      }

      // Phases
      (p.phases || []).forEach(function(phase) {
        var items = phase.items || [];
        var doneCount = items.filter(function(s) { return s.done; }).length;
        html += '<div class="project-phase">';
        html += '<div class="project-phase-name">' + esc(phase.name)
          + '<span class="project-phase-progress">' + doneCount + '/' + items.length + '</span></div>';
        html += '<ul class="sub-task-list">';
        items.forEach(function(sub) {
          html += renderSubTask(sub, t.id);
        });
        html += '</ul>';
        html += '<div class="sub-add-row">'
          + '<input type="text" placeholder="Add sub-task..." id="sub-input-' + t.id + '-' + esc(phase.name) + '" '
          + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')" />'
          + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + esc(phase.name) + Q + ')">+</button>'
          + '</div>';
        html += '</div>';
      });

      // Ongoing
      if (p.ongoing && p.ongoing.length > 0) {
        html += '<div class="project-section-label">Ongoing</div>';
        html += '<ul class="sub-task-list">';
        p.ongoing.forEach(function(sub) {
          html += renderSubTask(sub, t.id);
        });
        html += '</ul>';
      }
      html += '<div class="sub-add-row">'
        + '<input type="text" placeholder="Add ongoing task..." id="sub-input-' + t.id + '-__ongoing" '
        + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')" />'
        + '<button onclick="addSubTask(' + Q + t.id + Q + ',' + Q + '__ongoing' + Q + ')">+</button>'
        + '</div>';

      // Decision Log
      if (p.decisionLog && p.decisionLog.length > 0) {
        html += '<div class="project-section-label">Decision Log</div>';
        html += '<div class="decision-log">';
        p.decisionLog.forEach(function(entry) {
          html += '<div class="decision-entry">'
            + '<span class="decision-date">' + esc(entry.date) + '</span>'
            + '<span>' + esc(entry.entry) + '</span>'
            + '</div>';
        });
        html += '</div>';
      }
      html += '<div class="decision-add-row">'
        + '<input type="text" placeholder="Add decision note..." id="decision-input-' + t.id + '" '
        + 'onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addDecision(' + Q + t.id + Q + ')" />'
        + '<button onclick="addDecision(' + Q + t.id + Q + ')">+</button>'
        + '</div>';

      html += '</div>';
      return html;
    }

    function renderItem(t) {
      var cls = t.done ? 'todo-item done' : 'todo-item';
      var check = t.done ? '&#10003;' : '';
      var assignee = t.assignee
        ? '<span class="todo-assignee assignee-' + t.assignee.toLowerCase() + '">' + esc(t.assignee) + '</span>'
        : '';
      var note = (t.note && !t.project) ? '<div class="todo-note">' + esc(t.note) + '</div>' : '';
      var projectNote = (t.note && t.project) ? '<div class="todo-note">' + esc(t.note) + '</div>' : '';
      var completed = '';
      if (t.done && t.completedAt) {
        var d = new Date(t.completedAt);
        completed = '<div class="todo-completed-date">completed ' + d.toLocaleDateString() + '</div>';
      }
      var projectHtml = t.project ? renderProject(t) : '';
      var actionBtn = '';
      if (t.project) {
        actionBtn = '<button class="todo-action-btn" onclick="event.stopPropagation();toggleExpand(' + Q + t.id + Q + ')" title="Expand project">&#9776;</button>';
      } else {
        actionBtn = '<button class="todo-action-btn" onclick="event.stopPropagation();showProjectModal(' + Q + t.id + Q + ',' + Q + esc(t.text) + Q + ')" title="Make project">&#9776;</button>';
      }
      return '<li class="' + cls + '" data-id="' + t.id + '">'
        + '<span class="todo-check" onclick="toggleTodo(' + Q + t.id + Q + ')">' + check + '</span>'
        + '<div class="todo-content">'
        + '<span class="todo-text" style="' + (t.project ? '' : 'cursor:pointer') + '"' + (t.project ? '' : ' onclick="toggleTodo(' + Q + t.id + Q + ')"') + '>' + esc(t.text) + '</span>'
        + projectNote + note + completed
        + projectHtml
        + '</div>'
        + assignee
        + actionBtn
        + '<button class="todo-delete" onclick="deleteTodo(' + Q + t.id + Q + ')" title="Delete">&times;</button>'
        + '</li>';
    }

    function renderAllSections(data) {
      todoData = data;
      var container = document.getElementById('todo-sections');
      var html = '';
      var totalItems = 0;
      var totalDone = 0;

      (data.sections || []).forEach(function(section) {
        if (section.name === 'Long Term') {
          html += '<div class="todo-section-title">' + esc(section.name)
            + '<button class="add-cat-btn" onclick="showAddCategory()" title="Add category">+ Category</button>'
            + '<span class="add-cat-row" id="add-cat-row" style="display:none;">'
            + '<input type="text" id="new-cat-input" placeholder="Category name..." onkeydown="if(event.key===(' + Q + 'Enter' + Q + '))addCategory()" />'
            + '<button onclick="addCategory()">Add</button>'
            + '</span>'
            + '</div>';
          (section.categories || []).forEach(function(cat) {
            if (!cat.items || cat.items.length === 0) return;
            html += '<div class="todo-category-title">' + esc(cat.name) + '</div>';
            html += '<ul class="todo-list">';
            cat.items.forEach(function(t) {
              totalItems++;
              if (t.done) totalDone++;
              html += renderItem(t);
            });
            html += '</ul>';
          });
        } else {
          if (section.name === 'Recently Completed' && (!section.items || section.items.length === 0)) return;
          var titleCls = section.name === 'Recently Completed' ? 'todo-section-title completed-title' : 'todo-section-title';
          html += '<div class="' + titleCls + '">' + esc(section.name) + '</div>';
          html += '<ul class="todo-list">';
          (section.items || []).forEach(function(t) {
            totalItems++;
            if (t.done) totalDone++;
            html += renderItem(t);
          });
          html += '</ul>';
        }
      });

      container.innerHTML = html;
      var countEl = document.getElementById('todo-count');
      if (countEl) countEl.textContent = totalDone + '/' + totalItems + ' done';
      updateCategoryDropdown();
    }

    function updateCategoryDropdown() {
      var sectionSel = document.getElementById('todo-section');
      var catSel = document.getElementById('todo-category');
      if (sectionSel.value === 'Long Term' && todoData) {
        var lt = todoData.sections.find(function(s) { return s.name === 'Long Term'; });
        var cats = (lt && lt.categories) || [];
        catSel.innerHTML = cats.map(function(c) {
          return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
        }).join('');
        catSel.style.display = '';
      } else {
        catSel.style.display = 'none';
      }
    }

    function loadTodos() {
      fetch('/api/family/todos')
        .then(function(r) { return r.json(); })
        .then(renderAllSections)
        .catch(function() {
          document.getElementById('todo-sections').innerHTML = '<p style="padding:12px;opacity:0.5;">Could not load todos</p>';
        });
    }

    function loadAnimalSummary() {
      fetch('/api/family/animals/summary')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var due = data && typeof data.dueTodayCount === 'number' ? data.dueTodayCount : 0;
          var overdue = data && typeof data.overdueCount === 'number' ? data.overdueCount : 0;
          var dueEl = document.getElementById('animal-due-count');
          var medEl = document.getElementById('animal-med-count');
          if (dueEl) dueEl.textContent = String(due);
          if (medEl) medEl.textContent = overdue > 0 ? overdue + ' overdue' : due + ' due';
        })
        .catch(function() {
          var dueEl = document.getElementById('animal-due-count');
          if (dueEl) dueEl.textContent = '--';
        });
    }

    function toggleTodo(id) {
      fetch('/api/family/todos/' + id + '/toggle', { method: 'PATCH' })
        .then(function() { loadTodos(); });
    }

    function deleteTodo(id) {
      fetch('/api/family/todos/' + id, { method: 'DELETE' })
        .then(function() { loadTodos(); });
    }

    function addTodo() {
      var input = document.getElementById('todo-input');
      var assigneeSel = document.getElementById('todo-assignee');
      var sectionSel = document.getElementById('todo-section');
      var catSel = document.getElementById('todo-category');
      var text = input.value.trim();
      if (!text) return;
      var body = {
        text: text,
        assignee: assigneeSel.value || null,
        section: sectionSel.value
      };
      if (sectionSel.value === 'Long Term' && catSel.value) {
        body.category = catSel.value;
      }
      fetch('/api/family/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function() {
        input.value = '';
        assigneeSel.value = '';
        loadTodos();
      });
    }

    function toggleExpand(id) {
      expandedProjects[id] = !expandedProjects[id];
      var body = document.getElementById('project-' + id);
      var btn = body ? body.previousElementSibling : null;
      if (body) body.classList.toggle('open');
      if (btn) {
        var arrow = btn.querySelector('.arrow');
        if (arrow) arrow.classList.toggle('open');
      }
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
      }).then(function() {
        input.value = '';
        loadTodos();
      });
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
      }).then(function() {
        input.value = '';
        loadTodos();
      });
    }

    /* ------ Project Modal ------ */
    var projectModalPhases = ['Phase 1'];

    function showProjectModal(id, name) {
      projectModalPhases = ['Phase 1'];
      var overlay = document.createElement('div');
      overlay.className = 'project-modal-overlay';
      overlay.id = 'project-modal-overlay';
      overlay.onclick = function(e) { if (e.target === overlay) closeProjectModal(); };
      overlay.innerHTML = '<div class="project-modal">'
        + '<h3>Make "' + esc(name) + '" a Project</h3>'
        + '<label>Goal</label>'
        + '<input type="text" id="pm-goal" placeholder="What is the end goal?" />'
        + '<label>Phases</label>'
        + '<div id="pm-phases"></div>'
        + '<button class="add-phase-btn" onclick="addModalPhase()">+ Add Phase</button>'
        + '<div class="project-modal-actions">'
        + '<button class="cancel-btn" onclick="closeProjectModal()">Cancel</button>'
        + '<button class="create-btn" onclick="createProject(' + Q + id + Q + ')">Create Project</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(overlay);
      renderModalPhases();
      document.getElementById('pm-goal').focus();
    }

    function renderModalPhases() {
      var container = document.getElementById('pm-phases');
      if (!container) return;
      container.innerHTML = projectModalPhases.map(function(p, i) {
        return '<div class="phase-row">'
          + '<input type="text" class="pm-phase-input" value="' + esc(p) + '" '
          + 'oninput="projectModalPhases[' + i + ']=this.value" '
          + 'placeholder="Phase name..." />'
          + (projectModalPhases.length > 1
            ? '<button class="phase-remove" onclick="removeModalPhase(' + i + ')">&times;</button>'
            : '')
          + '</div>';
      }).join('');
    }

    function addModalPhase() {
      projectModalPhases.push('Phase ' + (projectModalPhases.length + 1));
      renderModalPhases();
    }

    function removeModalPhase(i) {
      projectModalPhases.splice(i, 1);
      renderModalPhases();
    }

    function closeProjectModal() {
      var overlay = document.getElementById('project-modal-overlay');
      if (overlay) overlay.remove();
    }

    function createProject(id) {
      var goal = document.getElementById('pm-goal').value.trim();
      var phases = projectModalPhases
        .map(function(p) { return p.trim(); })
        .filter(function(p) { return p.length > 0; })
        .map(function(p) { return { name: p, items: [] }; });
      if (phases.length === 0) phases = [{ name: 'Phase 1', items: [] }];
      fetch('/api/family/todos/' + id + '/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal, phases: phases, ongoing: [], decisionLog: [] })
      }).then(function() {
        closeProjectModal();
        expandedProjects[id] = true;
        loadTodos();
      });
    }

    function showAddCategory() {
      var row = document.getElementById('add-cat-row');
      if (row) {
        row.style.display = row.style.display === 'none' ? 'inline-flex' : 'none';
        if (row.style.display !== 'none') {
          var inp = document.getElementById('new-cat-input');
          if (inp) inp.focus();
        }
      }
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
      }).then(function() {
        input.value = '';
        document.getElementById('add-cat-row').style.display = 'none';
        loadTodos();
      });
    }

    // Show/hide category dropdown based on section selection
    document.getElementById('todo-section').addEventListener('change', updateCategoryDropdown);

    // Submit on Enter key
    document.getElementById('todo-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addTodo();
    });

    loadTodos();
    loadAnimalSummary();
    document.getElementById('pinboard-input').addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addPinboardNote();
    });
    loadPinboard();

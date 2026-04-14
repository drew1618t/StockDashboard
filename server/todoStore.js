/**
 * todoStore.js — Persists structured family todos to data/todos.json.
 *
 * Data format:
 * {
 *   sections: [
 *     { name: "Short Term", items: [...] },
 *     { name: "Recently Completed", items: [...] },
 *     { name: "Long Term", categories: [
 *       { name: "Housing", items: [...] }
 *     ]}
 *   ]
 * }
 *
 * Each item: { id, text, done, assignee, note, createdAt, completedAt, project? }
 *
 * Project items have:
 *   project: {
 *     goal: "string",
 *     phases: [{ name, items: [{ id, text, done }] }],
 *     decisionLog: [{ date, entry }],
 *     ongoing: [{ id, text, done }]
 *   }
 */

const path = require('path');
const { readJsonFile, writeJsonFile } = require('./utils/jsonFileStore');

const TODOS_PATH = path.join(__dirname, '..', 'data', 'todos.json');
const PRUNE_DAYS = 7;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readData() {
  const raw = readJsonFile(TODOS_PATH, { sections: [] });
  if (Array.isArray(raw)) return migrateFromFlat(raw);
  return raw;
}

function migrateFromFlat(arr) {
  const shortTerm = [];
  const completed = [];
  arr.forEach(item => {
    if (item.done) {
      completed.push({ ...item, completedAt: item.completedAt || new Date().toISOString() });
    } else {
      shortTerm.push(item);
    }
  });
  return {
    sections: [
      { name: 'Short Term', items: shortTerm },
      { name: 'Recently Completed', items: completed },
      { name: 'Long Term', categories: [] },
    ],
  };
}

function writeData(data) {
  writeJsonFile(TODOS_PATH, data);
}

function pruneCompleted(data) {
  const section = data.sections.find(s => s.name === 'Recently Completed');
  if (!section || !section.items) return;
  const cutoff = Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000;
  section.items = section.items.filter(item => {
    if (!item.completedAt) return true;
    return new Date(item.completedAt).getTime() > cutoff;
  });
}

/** Find a top-level item by id across all sections/categories */
function findItem(data, id) {
  for (const section of data.sections) {
    if (section.items) {
      const item = section.items.find(t => t.id === id);
      if (item) return { item, list: section.items, section };
    }
    if (section.categories) {
      for (const cat of section.categories) {
        if (cat.items) {
          const item = cat.items.find(t => t.id === id);
          if (item) return { item, list: cat.items, section, category: cat };
        }
      }
    }
  }
  return null;
}

/** Find a sub-task inside a project by sub-task id */
function findSubTask(data, subId) {
  for (const section of data.sections) {
    const lists = section.items ? [section.items] : [];
    if (section.categories) {
      section.categories.forEach(c => { if (c.items) lists.push(c.items); });
    }
    for (const list of lists) {
      for (const item of list) {
        if (!item.project) continue;
        // Check phases
        if (item.project.phases) {
          for (const phase of item.project.phases) {
            if (phase.items) {
              const sub = phase.items.find(s => s.id === subId);
              if (sub) return { sub, list: phase.items, parent: item, phase };
            }
          }
        }
        // Check ongoing
        if (item.project.ongoing) {
          const sub = item.project.ongoing.find(s => s.id === subId);
          if (sub) return { sub, list: item.project.ongoing, parent: item };
        }
      }
    }
  }
  return null;
}

function ensureSection(data, name) {
  let section = data.sections.find(s => s.name === name);
  if (!section) {
    section = { name, items: [] };
    const ltIdx = data.sections.findIndex(s => s.name === 'Long Term');
    if (name === 'Recently Completed' && ltIdx >= 0) {
      data.sections.splice(ltIdx, 0, section);
    } else {
      data.sections.push(section);
    }
  }
  return section;
}

// ---- Public API ----

function getTodos() {
  const data = readData();
  pruneCompleted(data);
  writeData(data);
  return data;
}

function addTodo(text, { assignee, note, section: sectionName, category: catName } = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) return null;

  const data = readData();
  const todo = {
    id: makeId(),
    text: text.trim(),
    done: false,
    assignee: assignee === 'A' || assignee === 'K' ? assignee : null,
    note: note && typeof note === 'string' ? note.trim() : null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const targetSection = sectionName || 'Short Term';

  if (targetSection === 'Long Term' && catName) {
    let lt = data.sections.find(s => s.name === 'Long Term');
    if (!lt) {
      lt = { name: 'Long Term', categories: [] };
      data.sections.push(lt);
    }
    if (!lt.categories) lt.categories = [];
    let cat = lt.categories.find(c => c.name === catName);
    if (!cat) {
      cat = { name: catName, items: [] };
      lt.categories.push(cat);
    }
    cat.items.push(todo);
  } else {
    const section = ensureSection(data, targetSection);
    if (!section.items) section.items = [];
    section.items.push(todo);
  }

  writeData(data);
  return todo;
}

function toggleTodo(id) {
  const data = readData();

  // Check if it's a sub-task first
  const subFound = findSubTask(data, id);
  if (subFound) {
    subFound.sub.done = !subFound.sub.done;
    // Update parent's "next action" note based on project progress
    updateProjectNote(subFound.parent);
    writeData(data);
    return subFound.sub;
  }

  const found = findItem(data, id);
  if (!found) return null;

  const { item, list } = found;

  // Don't move project items to Recently Completed (they're too complex)
  if (item.project) {
    item.done = !item.done;
    if (item.done) {
      item.completedAt = new Date().toISOString();
    } else {
      item.completedAt = null;
    }
    writeData(data);
    return item;
  }

  if (!item.done) {
    // Remember where this item came from so we can restore it
    item.done = true;
    item.completedAt = new Date().toISOString();
    item.originSection = found.section.name;
    if (found.category) item.originCategory = found.category.name;
    const idx = list.indexOf(item);
    if (idx >= 0) list.splice(idx, 1);
    const rc = ensureSection(data, 'Recently Completed');
    if (!rc.items) rc.items = [];
    rc.items.unshift(item);
  } else {
    // Restore to original section/category
    item.done = false;
    item.completedAt = null;
    const origSection = item.originSection || 'Short Term';
    const origCategory = item.originCategory || null;
    delete item.originSection;
    delete item.originCategory;
    const idx = list.indexOf(item);
    if (idx >= 0) list.splice(idx, 1);

    if (origSection === 'Long Term' && origCategory) {
      let lt = data.sections.find(s => s.name === 'Long Term');
      if (!lt) { lt = { name: 'Long Term', categories: [] }; data.sections.push(lt); }
      if (!lt.categories) lt.categories = [];
      let cat = lt.categories.find(c => c.name === origCategory);
      if (!cat) { cat = { name: origCategory, items: [] }; lt.categories.push(cat); }
      cat.items.push(item);
    } else {
      const section = ensureSection(data, origSection);
      if (!section.items) section.items = [];
      section.items.push(item);
    }
  }

  writeData(data);
  return item;
}

/** Auto-update a project item's note to reflect next undone sub-task */
function updateProjectNote(item) {
  if (!item.project || !item.project.phases) return;
  for (const phase of item.project.phases) {
    if (!phase.items) continue;
    const next = phase.items.find(s => !s.done);
    if (next) {
      item.note = 'Next: ' + next.text;
      return;
    }
  }
  // All phases done, check ongoing
  if (item.project.ongoing) {
    const next = item.project.ongoing.find(s => !s.done);
    if (next) {
      item.note = 'Ongoing: ' + next.text;
      return;
    }
  }
  item.note = 'All tasks complete';
}

function deleteTodo(id) {
  const data = readData();

  // Check sub-tasks first
  const subFound = findSubTask(data, id);
  if (subFound) {
    const idx = subFound.list.indexOf(subFound.sub);
    if (idx >= 0) subFound.list.splice(idx, 1);
    writeData(data);
    return true;
  }

  const found = findItem(data, id);
  if (!found) return false;
  const idx = found.list.indexOf(found.item);
  if (idx >= 0) found.list.splice(idx, 1);
  writeData(data);
  return true;
}

function updateTodo(id, updates) {
  const data = readData();
  const found = findItem(data, id);
  if (!found) return null;
  const { item } = found;
  if (typeof updates.text === 'string' && updates.text.trim()) {
    item.text = updates.text.trim();
  }
  if (updates.assignee === 'A' || updates.assignee === 'K' || updates.assignee === null) {
    item.assignee = updates.assignee;
  }
  if (typeof updates.note === 'string') {
    item.note = updates.note.trim() || null;
  }
  writeData(data);
  return item;
}

function addCategory(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') return null;
  const data = readData();
  let lt = data.sections.find(s => s.name === 'Long Term');
  if (!lt) {
    lt = { name: 'Long Term', categories: [] };
    data.sections.push(lt);
  }
  if (!lt.categories) lt.categories = [];
  const exists = lt.categories.find(c => c.name === categoryName.trim());
  if (exists) return exists;
  const cat = { name: categoryName.trim(), items: [] };
  lt.categories.push(cat);
  writeData(data);
  return cat;
}

/** Convert a regular todo into a project with phases */
function makeProject(id, projectData) {
  const data = readData();
  const found = findItem(data, id);
  if (!found) return null;
  const { item } = found;

  item.project = {
    goal: projectData.goal || '',
    phases: (projectData.phases || []).map(p => ({
      name: p.name,
      items: (p.items || []).map(t => ({
        id: makeId(),
        text: typeof t === 'string' ? t : t.text,
        done: t.done || false,
      })),
    })),
    decisionLog: projectData.decisionLog || [],
    ongoing: (projectData.ongoing || []).map(t => ({
      id: makeId(),
      text: typeof t === 'string' ? t : t.text,
      done: t.done || false,
    })),
  };

  updateProjectNote(item);
  writeData(data);
  return item;
}

/** Add a sub-task to a project phase */
function addSubTask(parentId, phaseName, text) {
  if (!text || typeof text !== 'string') return null;
  const data = readData();
  const found = findItem(data, parentId);
  if (!found || !found.item.project) return null;

  let phase;
  if (phaseName === '__ongoing') {
    if (!found.item.project.ongoing) found.item.project.ongoing = [];
    phase = { items: found.item.project.ongoing };
  } else {
    phase = found.item.project.phases.find(p => p.name === phaseName);
    if (!phase) {
      phase = { name: phaseName, items: [] };
      found.item.project.phases.push(phase);
    }
  }

  const sub = { id: makeId(), text: text.trim(), done: false };
  phase.items.push(sub);
  updateProjectNote(found.item);
  writeData(data);
  return sub;
}

/** Add a decision log entry */
function addDecisionLogEntry(parentId, entry) {
  if (!entry || typeof entry !== 'string') return null;
  const data = readData();
  const found = findItem(data, parentId);
  if (!found || !found.item.project) return null;
  if (!found.item.project.decisionLog) found.item.project.decisionLog = [];
  const logEntry = {
    date: new Date().toISOString().slice(0, 10),
    entry: entry.trim(),
  };
  found.item.project.decisionLog.push(logEntry);
  writeData(data);
  return logEntry;
}

module.exports = {
  getTodos, addTodo, toggleTodo, deleteTodo, updateTodo,
  addCategory, makeProject, addSubTask, addDecisionLogEntry,
};

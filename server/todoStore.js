/**
 * todoStore.js — Persists family todos to data/todos.json.
 * Each todo: { id, text, done, assignee ('A' | 'K' | null), createdAt }
 */

const fs = require('fs');
const path = require('path');

const TODOS_PATH = path.join(__dirname, '..', 'data', 'todos.json');

function readTodos() {
  try {
    if (!fs.existsSync(TODOS_PATH)) return [];
    return JSON.parse(fs.readFileSync(TODOS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeTodos(todos) {
  const dir = path.dirname(TODOS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TODOS_PATH, JSON.stringify(todos, null, 2));
}

function getTodos() {
  return readTodos();
}

function addTodo(text, assignee) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return null;
  }
  const todos = readTodos();
  const todo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: text.trim(),
    done: false,
    assignee: assignee === 'A' || assignee === 'K' ? assignee : null,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  writeTodos(todos);
  return todo;
}

function toggleTodo(id) {
  const todos = readTodos();
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  todo.done = !todo.done;
  writeTodos(todos);
  return todo;
}

function deleteTodo(id) {
  const todos = readTodos();
  const filtered = todos.filter(t => t.id !== id);
  if (filtered.length === todos.length) return false;
  writeTodos(filtered);
  return true;
}

function updateTodo(id, updates) {
  const todos = readTodos();
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  if (typeof updates.text === 'string' && updates.text.trim()) {
    todo.text = updates.text.trim();
  }
  if (updates.assignee === 'A' || updates.assignee === 'K' || updates.assignee === null) {
    todo.assignee = updates.assignee;
  }
  if (typeof updates.done === 'boolean') {
    todo.done = updates.done;
  }
  writeTodos(todos);
  return todo;
}

module.exports = { getTodos, addTodo, toggleTodo, deleteTodo, updateTodo };

const express = require('express');

const defaultTodoStore = require('../../todoStore');

function createTodoRoutes(options = {}) {
  const todoStore = options.todoStore || defaultTodoStore;
  const router = express.Router();

  router.get('/todos', (req, res) => {
    res.json(todoStore.getTodos());
  });

  router.post('/todos', (req, res) => {
    const { text, assignee, note, section, category } = req.body;
    const todo = todoStore.addTodo(text, { assignee, note, section, category });
    if (!todo) return res.status(400).json({ error: 'Text is required' });
    res.status(201).json(todo);
  });

  router.post('/todos/category', (req, res) => {
    const cat = todoStore.addCategory(req.body.name);
    if (!cat) return res.status(400).json({ error: 'Category name is required' });
    res.status(201).json(cat);
  });

  router.patch('/todos/:id/toggle', (req, res) => {
    const todo = todoStore.toggleTodo(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  router.patch('/todos/:id', (req, res) => {
    const todo = todoStore.updateTodo(req.params.id, req.body);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  router.delete('/todos/:id', (req, res) => {
    const ok = todoStore.deleteTodo(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Todo not found' });
    res.json({ deleted: true });
  });

  router.post('/todos/:id/project', (req, res) => {
    const item = todoStore.makeProject(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Todo not found or invalid' });
    res.json(item);
  });

  router.post('/todos/:id/subtask', (req, res) => {
    const { phase, text } = req.body;
    const sub = todoStore.addSubTask(req.params.id, phase, text);
    if (!sub) return res.status(400).json({ error: 'Could not add sub-task' });
    res.status(201).json(sub);
  });

  router.post('/todos/:id/decision', (req, res) => {
    const entry = todoStore.addDecisionLogEntry(req.params.id, req.body.entry);
    if (!entry) return res.status(400).json({ error: 'Could not add decision log entry' });
    res.status(201).json(entry);
  });

  return router;
}

module.exports = {
  createTodoRoutes,
};

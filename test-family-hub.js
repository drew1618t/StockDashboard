const express = require('express');
const {
  renderFamilyHubPage,
  renderFamilyHealthChooserPage,
  renderPersonHealthPage,
} = require('./server/familyPages');
const todoStore = require('./server/todoStore');
const pinboardStore = require('./server/pinboardStore');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Family hub page
app.get('/family', (req, res) => res.send(renderFamilyHubPage()));
app.get('/family/health', (req, res) => res.send(renderFamilyHealthChooserPage()));
app.get('/family/health/andrew', (req, res) => res.send(renderPersonHealthPage('Andrew')));
app.get('/family/health/kaili', (req, res) => res.send(renderPersonHealthPage('Kaili')));
app.get('/family/medical', (req, res) => res.redirect('/family/health'));
app.get('/', (req, res) => res.redirect('/family'));

// Todo API (mirrors the real server routes)
app.get('/api/family/todos', (req, res) => res.json(todoStore.getTodos()));
app.get('/api/family/pinboard', (req, res) => res.json(pinboardStore.getNotes()));
app.post('/api/family/pinboard', (req, res) => {
  const note = pinboardStore.addNote(req.body.text, req.body.author);
  if (!note) return res.status(400).json({ error: 'Text is required' });
  res.status(201).json(note);
});
app.patch('/api/family/pinboard/:id', (req, res) => {
  const note = pinboardStore.updateNote(req.params.id, req.body);
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});
app.delete('/api/family/pinboard/:id', (req, res) => {
  const ok = pinboardStore.deleteNote(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});
app.post('/api/family/todos', (req, res) => {
  const { text, assignee, note, section, category } = req.body;
  const todo = todoStore.addTodo(text, { assignee, note, section, category });
  if (!todo) return res.status(400).json({ error: 'Text is required' });
  res.status(201).json(todo);
});
app.post('/api/family/todos/category', (req, res) => {
  const cat = todoStore.addCategory(req.body.name);
  if (!cat) return res.status(400).json({ error: 'Category name is required' });
  res.status(201).json(cat);
});
app.patch('/api/family/todos/:id/toggle', (req, res) => {
  const todo = todoStore.toggleTodo(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});
app.patch('/api/family/todos/:id', (req, res) => {
  const todo = todoStore.updateTodo(req.params.id, req.body);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});
app.delete('/api/family/todos/:id', (req, res) => {
  const ok = todoStore.deleteTodo(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

app.post('/api/family/todos/:id/project', (req, res) => {
  const item = todoStore.makeProject(req.params.id, req.body);
  if (!item) return res.status(404).json({ error: 'Todo not found or invalid' });
  res.json(item);
});

app.post('/api/family/todos/:id/subtask', (req, res) => {
  const { phase, text } = req.body;
  const sub = todoStore.addSubTask(req.params.id, phase, text);
  if (!sub) return res.status(400).json({ error: 'Could not add sub-task' });
  res.status(201).json(sub);
});

app.post('/api/family/todos/:id/decision', (req, res) => {
  const entry = todoStore.addDecisionLogEntry(req.params.id, req.body.entry);
  if (!entry) return res.status(400).json({ error: 'Could not add decision log entry' });
  res.status(201).json(entry);
});

app.listen(3001, () => {
  console.log('Family Hub test server running at http://localhost:3001/family');
});

const express = require('express');
const path = require('path');
const {
  renderFamilyHubPage,
  renderFamilyHealthChooserPage,
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
} = require('./server/familyPages');
const { getPersonConfig, getPersonHealthData, findReportFile, getImagingStudy, resolveStudyFile } = require('./server/healthData');
const todoStore = require('./server/todoStore');
const pinboardStore = require('./server/pinboardStore');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Family hub page
app.get('/family', (req, res) => res.send(renderFamilyHubPage()));
app.get('/family/health', (req, res) => res.send(renderFamilyHealthChooserPage()));
app.get('/family/health/andrew', (req, res) => res.send(renderPersonHealthPage(getPersonHealthData('andrew'))));
app.get('/family/health/kaili', (req, res) => res.send(renderPersonHealthPage(getPersonHealthData('kaili'))));
app.get('/family/health/:personSlug/bloodwork', (req, res) => {
  const data = getPersonHealthData(req.params.personSlug);
  if (!data) return res.status(404).send('Unknown health profile');
  return res.send(renderPersonHealthSectionPage(data, 'bloodwork'));
});
app.get('/family/health/:personSlug/images', (req, res) => {
  const data = getPersonHealthData(req.params.personSlug);
  if (!data) return res.status(404).send('Unknown health profile');
  return res.send(renderPersonHealthSectionPage(data, 'images'));
});
app.get('/family/health/:personSlug/reports', (req, res) => {
  const data = getPersonHealthData(req.params.personSlug);
  if (!data) return res.status(404).send('Unknown health profile');
  return res.send(renderPersonHealthSectionPage(data, 'reports'));
});
app.get('/family/health/:personSlug/report/:fileName', (req, res) => {
  const person = getPersonConfig(req.params.personSlug);
  if (!person) return res.status(404).send('Unknown health profile');
  const report = findReportFile(person, req.params.fileName);
  if (!report) return res.status(404).send('Report not found');
  if (report.ext === '.html') return res.sendFile(report.fullPath);
  if (report.ext === '.pdf') {
    return res.send(renderPersonHealthFileViewerPage(report.fileName, `<iframe class="viewer-frame" src="/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}"></iframe>`, `<a href="/family/health/${person.slug}">${person.name} Health</a>`, `/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`, report.fileName));
  }
  if (report.ext === '.docx') {
    return res.send(renderPersonHealthFileViewerPage(report.fileName, `<iframe class="viewer-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${req.protocol}://${req.get('host')}/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`)}"></iframe>`, `<a href="/family/health/${person.slug}">${person.name} Health</a>`, `/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`, report.fileName));
  }
  return res.sendFile(report.fullPath);
});
app.get('/family/health/:personSlug/report/raw/:fileName', (req, res) => {
  const person = getPersonConfig(req.params.personSlug);
  const report = person ? findReportFile(person, req.params.fileName) : null;
  if (!person || !report) return res.status(404).send('Report not found');
  return res.sendFile(report.fullPath);
});
app.get('/family/health/:personSlug/images/:studySlug', (req, res) => {
  const data = getPersonHealthData(req.params.personSlug);
  const study = data ? getImagingStudy(data.person, req.params.studySlug) : null;
  if (!data || !study) return res.status(404).send('Study not found');
  return res.send(renderPersonImagingStudyPage(data, study));
});
app.get('/family/health/:personSlug/images/:studySlug/asset/:assetPath(*)', (req, res) => {
  const person = getPersonConfig(req.params.personSlug);
  const study = person ? getImagingStudy(person, req.params.studySlug) : null;
  const asset = study ? resolveStudyFile(study, req.params.assetPath) : null;
  if (!person || !study || !asset) return res.status(404).send('Asset not found');
  return res.sendFile(asset.fullPath);
});
app.get('/family/health/:personSlug/images/:studySlug/document/raw/:docPath(*)', (req, res) => {
  const person = getPersonConfig(req.params.personSlug);
  const study = person ? getImagingStudy(person, req.params.studySlug) : null;
  const doc = study ? resolveStudyFile(study, req.params.docPath) : null;
  if (!person || !study || !doc) return res.status(404).send('Doc not found');
  return res.sendFile(doc.fullPath);
});
app.get('/family/health/:personSlug/images/:studySlug/document/:docPath(*)', (req, res) => {
  const person = getPersonConfig(req.params.personSlug);
  const study = person ? getImagingStudy(person, req.params.studySlug) : null;
  const doc = study ? resolveStudyFile(study, req.params.docPath) : null;
  if (!person || !study || !doc) return res.status(404).send('Doc not found');
  if (doc.ext === '.pdf') {
    return res.send(renderPersonHealthFileViewerPage(doc.fileName, `<iframe class="viewer-frame" src="/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}"></iframe>`, `<a href="/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}">Back to Study</a>`, `/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`, doc.fileName));
  }
  if (doc.ext === '.docx') {
    return res.send(renderPersonHealthFileViewerPage(doc.fileName, `<iframe class="viewer-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${req.protocol}://${req.get('host')}/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`)}"></iframe>`, `<a href="/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}">Back to Study</a>`, `/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`, doc.fileName));
  }
  return res.sendFile(doc.fullPath);
});
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

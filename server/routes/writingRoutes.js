const express = require('express');
const fs = require('fs');
const mammoth = require('mammoth');
const multer = require('multer');
const os = require('os');
const path = require('path');

const { createRequireAuthor, DEFAULT_AUTHOR_EMAIL } = require('../middleware/requireAuthor');
const defaultWritingAnalytics = require('../writingAnalytics');
const { renderArticleExport, renderWritingPage } = require('../writingPage');
const defaultWritingStore = require('../writingStore');

function createWritingRoutes(options = {}) {
  const writingStore = options.writingStore || defaultWritingStore;
  const writingAnalytics = options.writingAnalytics || defaultWritingAnalytics;
  const authorEmail = options.authorEmail || DEFAULT_AUTHOR_EMAIL;
  const requireAuthor = options.requireAuthor || createRequireAuthor(authorEmail);
  const upload = options.upload || multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } });
  const router = express.Router();

  router.get('/writing', (req, res) => {
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles));
  });

  router.get('/writing/analytics', (req, res) => {
    if (!req.user || req.user.email !== authorEmail) {
      return res.redirect('/writing');
    }
    const analytics = writingAnalytics.getAnalytics();
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles, null, analytics));
  });

  router.get('/writing/:slug/export', (req, res) => {
    const article = writingStore.getArticle(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.setHeader('Content-Disposition', 'attachment; filename="' + article.slug + '.html"');
    res.type('html').send(renderArticleExport(article));
  });

  router.get('/writing/:slug', (req, res) => {
    const article = writingStore.getArticle(req.params.slug);
    if (!article) {
      return res.redirect('/writing');
    }
    if (req.user && req.user.email) {
      writingAnalytics.recordView(req.user.email, article.slug, article.title);
    }
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles, article));
  });

  router.get('/api/writing', (req, res) => {
    const status = req.query.status || 'published';
    res.json(writingStore.getArticles(status));
  });

  router.post('/api/writing', requireAuthor, (req, res) => {
    const { title, subtitle, category, body, status } = req.body;
    const article = writingStore.createArticle({ title, subtitle, category, body, status });
    if (!article) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(article);
  });

  router.post('/api/writing/upload', requireAuthor, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const ext = path.extname(req.file.originalname).toLowerCase();
      let body = '';

      if (ext === '.docx') {
        const result = await mammoth.convertToHtml({ path: req.file.path });
        body = result.value;
      } else if (ext === '.md' || ext === '.txt') {
        body = fs.readFileSync(req.file.path, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Use .md, .txt, or .docx' });
      }

      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

      const title = req.body.title || req.file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const article = writingStore.createArticle({
        title,
        subtitle: req.body.subtitle || '',
        category: req.body.category || '',
        body,
        status: req.body.status || 'published',
      });

      if (!article) return res.status(400).json({ error: 'Failed to create article' });
      res.status(201).json(article);
    } catch (err) {
      res.status(500).json({ error: 'Failed to process file: ' + err.message });
    }
  });

  router.patch('/api/writing/:id', requireAuthor, (req, res) => {
    const article = writingStore.updateArticle(req.params.id, req.body);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  });

  router.get('/api/writing/analytics', requireAuthor, (req, res) => {
    res.json(writingAnalytics.getAnalytics());
  });

  router.delete('/api/writing/:id', requireAuthor, (req, res) => {
    const ok = writingStore.deleteArticle(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Article not found' });
    res.json({ deleted: true });
  });

  return router;
}

module.exports = {
  createWritingRoutes,
};

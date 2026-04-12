/**
 * server/index.js - Express server for the portfolio visualization dashboard.
 *
 * Serves static files from /public and provides JSON API endpoints.
 * All data is loaded into memory at startup from the reports directory.
 */

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mammoth = require('mammoth');
const multer = require('multer');
const os = require('os');
const dataLoader = require('./dataLoader');
const sheetsPoller = require('./sheetsPoller');
const requestTracker = require('./requestTracker');
const { createAccessAuth } = require('./auth/accessAuth');
const { authErrorHandler, requireAuth, requireRole } = require('./auth/authorize');
const {
  renderFamilyHubPage,
  renderFamilySectionPage,
  renderFamilyHealthChooserPage,
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
} = require('./familyPages');
const { getPersonConfig, getPersonHealthData, findReportFile, getImagingStudy, resolveStudyFile } = require('./healthData');
const todoStore = require('./todoStore');
const pinboardStore = require('./pinboardStore');
const { renderHomePage } = require('./homePage');
const { renderWritingPage } = require('./writingPage');
const writingStore = require('./writingStore');
const writingAnalytics = require('./writingAnalytics');
const { getPigeonStore } = require('./pigeonStore');
const { renderPigeonsPage } = require('./pigeonPages');
const {
  DEFAULT_UPLOAD_DIR: PIGEON_UPLOAD_DIR,
  PUBLIC_UPLOAD_PREFIX: PIGEON_UPLOAD_PREFIX,
  importExistingPigeonDataIfNeeded,
} = require('./pigeonImport');

const PORT = process.env.PORT || 3000;
const accessAuth = createAccessAuth();

function buildLivePriceMap() {
  const live = sheetsPoller.getLiveData();
  if (!live || !live.stocks) return {};
  const map = {};
  live.stocks.forEach(stock => {
    if (stock.currentPrice) map[stock.ticker] = stock.currentPrice;
  });
  return map;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function overlayLivePrice(company, livePrice) {
  const reportPrice = company.price;
  if (!reportPrice || reportPrice <= 0) {
    return { ...company, price: livePrice, priceSource: 'live' };
  }

  const ratio = livePrice / reportPrice;
  const nextCompany = {
    ...company,
    price: livePrice,
    priceSource: 'live',
    marketCapMil: company.marketCapMil ? round2(company.marketCapMil * ratio) : null,
    priceToSales: company.priceToSales ? round2(company.priceToSales * ratio) : null,
  };

  ['trailingPe', 'runRatePe', 'forwardPe', 'normalizedPe'].forEach(key => {
    if (company[key] && reportPrice) {
      const eps = reportPrice / company[key];
      nextCompany[key] = round2(livePrice / eps);
    }
  });

  const calc = { ...company.calculated };

  if (company.fiftyTwoWeekHigh) {
    calc.distanceFromHigh = round2(((livePrice - company.fiftyTwoWeekHigh) / company.fiftyTwoWeekHigh) * 100);
  }

  const pe = nextCompany.runRatePe || nextCompany.trailingPe || nextCompany.normalizedPe;
  if (pe && company.revenueYoyPct && company.revenueYoyPct > 0) {
    calc.gav = round2(pe / company.revenueYoyPct);
  }

  if (nextCompany.trailingPe !== null || nextCompany.runRatePe !== null || nextCompany.forwardPe !== null) {
    calc.peCompression = {
      trailingPe: nextCompany.trailingPe,
      runRatePe: nextCompany.runRatePe,
      forwardPe: nextCompany.forwardPe,
      trailingToRunRate:
        nextCompany.trailingPe != null && nextCompany.runRatePe != null
          ? round2(nextCompany.trailingPe - nextCompany.runRatePe)
          : null,
      runRateToForward:
        nextCompany.runRatePe != null && nextCompany.forwardPe != null
          ? round2(nextCompany.runRatePe - nextCompany.forwardPe)
          : null,
      totalCompression:
        nextCompany.trailingPe != null && nextCompany.forwardPe != null
          ? round2(nextCompany.trailingPe - nextCompany.forwardPe)
          : null,
    };
  }

  nextCompany.calculated = calc;
  return nextCompany;
}

function overlayLivePrices(companies) {
  const priceMap = buildLivePriceMap();
  return companies.map(company => {
    const livePrice = priceMap[company.ticker];
    if (livePrice) return overlayLivePrice(company, livePrice);
    return { ...company, priceSource: 'report' };
  });
}

const pigeonPhotoStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(PIGEON_UPLOAD_DIR, 'photos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const pigeonPhotoUpload = multer({
  storage: pigeonPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  },
});

function removePigeonUploadedFile(publicPath) {
  const prefix = `${PIGEON_UPLOAD_PREFIX}/`;
  if (!publicPath || !publicPath.startsWith(prefix)) return;
  const relative = publicPath.slice(prefix.length).replace(/\//g, path.sep);
  const fullPath = path.resolve(PIGEON_UPLOAD_DIR, relative);
  if (!fullPath.startsWith(path.resolve(PIGEON_UPLOAD_DIR))) return;
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.warn(`[pigeons] failed to remove uploaded file: ${err.message}`);
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(compression());
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self' https://view.officeapps.live.com"
    );
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(accessAuth);
  app.use(authErrorHandler);
  app.use(requireAuth);

  app.get('/', (req, res) => {
    res.type('html').send(renderHomePage(req.user));
  });

  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: 0,
      etag: true,
      setHeaders(res, filePath) {
        // Prevent Cloudflare and browser from caching HTML
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
        }
      },
    })
  );

  app.get('/api/me', (req, res) => {
    res.json({
      authenticated: true,
      email: req.user.email,
      role: req.user.role,
    });
  });

  app.get('/api/portfolio', (req, res) => {
    const companies = overlayLivePrices(dataLoader.getCompanies());
    res.json({
      companies,
      count: companies.length,
      holdings: dataLoader.getPortfolioHoldings(),
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/api/stock/:ticker', (req, res) => {
    const { company, analysis, rawMarkdown } = dataLoader.getCompany(req.params.ticker);
    if (!company) {
      return res.status(404).json({ error: `Ticker ${req.params.ticker} not found` });
    }
    const [overlaid] = overlayLivePrices([company]);
    return res.json({ company: overlaid, analysis, rawMarkdown });
  });

  app.get('/api/available-tickers', (req, res) => {
    res.json(dataLoader.getAvailableTickers());
  });

  app.get('/api/refresh', (req, res) => {
    const companies = dataLoader.refresh();
    res.json({
      message: 'Data refreshed',
      count: companies.length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/api/live-portfolio', (req, res) => {
    res.json(sheetsPoller.getLiveData());
  });

  app.get('/api/live-portfolio/refresh', async (req, res) => {
    try {
      const data = await sheetsPoller.forceRefresh();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to refresh live data' });
    }
  });

  app.get('/api/requests', (req, res) => {
    res.json(requestTracker.getRequests());
  });

  app.post('/api/requests', (req, res) => {
    const ticker = (req.body.ticker || '').trim().toUpperCase();
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });
    if (!/^[A-Z]{1,6}$/.test(ticker)) return res.status(400).json({ error: 'Invalid ticker format' });
    const result = requestTracker.addRequest(ticker);
    return res.json(result);
  });

  app.use('/api/family', requireRole('family'));

  app.get('/api/family/pigeons/summary', (req, res) => {
    res.json(getPigeonStore().getSummary());
  });

  app.get('/api/family/pigeons/locations', (req, res) => {
    res.json(getPigeonStore().getLocations());
  });

  app.post('/api/family/pigeons/locations', (req, res) => {
    const location = getPigeonStore().createLocation(req.body.name);
    if (!location) return res.status(400).json({ error: 'Room name is required' });
    res.status(201).json(location);
  });

  app.get('/api/family/pigeons/birds', (req, res) => {
    const birds = getPigeonStore().listBirds({
      status: req.query.status,
      locationId: req.query.locationId,
      search: req.query.search,
    });
    res.json({ birds, total: birds.length });
  });

  app.post('/api/family/pigeons/birds', (req, res) => {
    const bird = getPigeonStore().createBird(req.body);
    if (!bird) return res.status(400).json({ error: 'Could not create bird' });
    res.status(201).json(bird);
  });

  app.get('/api/family/pigeons/birds/:id', (req, res) => {
    const bird = getPigeonStore().getBirdDetail(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(bird);
  });

  app.patch('/api/family/pigeons/birds/:id', (req, res) => {
    const bird = getPigeonStore().updateBird(req.params.id, req.body);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(bird);
  });

  app.delete('/api/family/pigeons/birds/:id', (req, res) => {
    const ok = getPigeonStore().deleteBird(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Bird not found' });
    res.json({ deleted: true });
  });

  app.get('/api/family/pigeons/birds/:id/medications', (req, res) => {
    const bird = getPigeonStore().getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    res.json(getPigeonStore().listBirdMedications(req.params.id));
  });

  app.post('/api/family/pigeons/birds/:id/medications', (req, res) => {
    const medication = getPigeonStore().createMedication(req.params.id, req.body);
    if (!medication) return res.status(400).json({ error: 'Medication name is required' });
    res.status(201).json(medication);
  });

  app.post('/api/family/pigeons/birds/:id/notes', (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const note = store.addBirdNote(req.params.id, req.body);
    if (!note) return res.status(400).json({ error: 'Note text is required' });
    res.status(201).json(note);
  });

  app.post('/api/family/pigeons/birds/:id/weights', (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const weight = store.addBirdWeight(req.params.id, req.body);
    if (!weight) return res.status(400).json({ error: 'Valid date and positive gram weight are required' });
    res.status(201).json(weight);
  });

  app.patch('/api/family/pigeons/medications/:medId', (req, res) => {
    const medication = getPigeonStore().updateMedication(req.params.medId, req.body);
    if (!medication) return res.status(404).json({ error: 'Medication not found' });
    res.json(medication);
  });

  app.patch('/api/family/pigeons/notes/:noteId', (req, res) => {
    const store = getPigeonStore();
    if (!store.getNoteById(req.params.noteId)) return res.status(404).json({ error: 'Note not found' });
    const note = store.updateBirdNote(req.params.noteId, req.body);
    if (!note) return res.status(400).json({ error: 'Valid note date and note text are required' });
    res.json(note);
  });

  app.delete('/api/family/pigeons/medications/:medId', (req, res) => {
    const ok = getPigeonStore().deleteMedication(req.params.medId);
    if (!ok) return res.status(404).json({ error: 'Medication not found' });
    res.json({ deleted: true });
  });

  app.delete('/api/family/pigeons/notes/:noteId', (req, res) => {
    const note = getPigeonStore().deleteBirdNote(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  });

  app.post('/api/family/pigeons/medications/:medId/log-dose', (req, res) => {
    const log = getPigeonStore().logDose(req.params.medId, req.body);
    if (!log) return res.status(404).json({ error: 'Medication not found' });
    res.json(log);
  });

  app.post('/api/family/pigeons/birds/:id/photos', pigeonPhotoUpload.array('photos', 10), (req, res) => {
    const store = getPigeonStore();
    const bird = store.getBirdById(req.params.id);
    if (!bird) return res.status(404).json({ error: 'Bird not found' });
    const photos = (req.files || []).map(file => store.addPhoto(req.params.id, {
      photo_path: `${PIGEON_UPLOAD_PREFIX}/photos/${file.filename}`,
      description: req.body.description,
      photo_type: req.body.photo_type,
    }));
    res.status(201).json(photos);
  });

  app.delete('/api/family/pigeons/photos/:photoId', (req, res) => {
    const photo = getPigeonStore().deletePhoto(req.params.photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    removePigeonUploadedFile(photo.photo_path);
    res.json({ deleted: true });
  });

  app.delete('/api/family/pigeons/weights/:weightId', (req, res) => {
    const weight = getPigeonStore().deleteBirdWeight(req.params.weightId);
    if (!weight) return res.status(404).json({ error: 'Weight not found' });
    res.json({ deleted: true });
  });

  app.get('/api/family/medical/summary', (req, res) => {
    res.status(501).json({
      error: 'Medical summary is not implemented yet',
      section: 'medical',
      role: req.user.role,
    });
  });

  app.get('/api/family/todos', (req, res) => {
    res.json(todoStore.getTodos());
  });

  app.get('/api/family/pinboard', (req, res) => {
    res.json(pinboardStore.getNotes());
  });

  app.post('/api/family/pinboard', (req, res) => {
    const note = pinboardStore.addNote(req.body.text, req.body.author);
    if (!note) return res.status(400).json({ error: 'Text is required' });
    res.status(201).json(note);
  });

  app.patch('/api/family/pinboard/:id', (req, res) => {
    const note = pinboardStore.updateNote(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  });

  app.delete('/api/family/pinboard/:id', (req, res) => {
    const ok = pinboardStore.deleteNote(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Note not found' });
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
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  app.patch('/api/family/todos/:id', (req, res) => {
    const todo = todoStore.updateTodo(req.params.id, req.body);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  app.delete('/api/family/todos/:id', (req, res) => {
    const ok = todoStore.deleteTodo(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Todo not found' });
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

  app.get('/api/family/cameras', (req, res) => {
    res.status(501).json({
      error: 'Camera APIs are not implemented yet',
      section: 'cameras',
      role: req.user.role,
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      companiesLoaded: dataLoader.getCompanies().length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/writing', (req, res) => {
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles));
  });

  app.get('/writing/analytics', (req, res) => {
    if (!req.user || req.user.email !== 'drew1618t@gmail.com') {
      return res.redirect('/writing');
    }
    const analytics = writingAnalytics.getAnalytics();
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles, null, analytics));
  });

  app.get('/writing/:slug/export', (req, res) => {
    const article = writingStore.getArticle(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const { renderArticleExport } = require('./writingPage');
    res.setHeader('Content-Disposition', 'attachment; filename="' + article.slug + '.html"');
    res.type('html').send(renderArticleExport(article));
  });

  app.get('/writing/:slug', (req, res) => {
    const article = writingStore.getArticle(req.params.slug);
    if (!article) {
      return res.redirect('/writing');
    }
    // Track the view
    if (req.user && req.user.email) {
      writingAnalytics.recordView(req.user.email, article.slug, article.title);
    }
    const articles = writingStore.getArticles('published');
    res.type('html').send(renderWritingPage(req.user, articles, article));
  });

  app.get('/api/writing', (req, res) => {
    const status = req.query.status || 'published';
    res.json(writingStore.getArticles(status));
  });

  function requireAuthor(req, res, next) {
    if (!req.user || req.user.email !== 'drew1618t@gmail.com') {
      return res.status(403).json({ error: 'Only the author can perform this action' });
    }
    next();
  }

  app.post('/api/writing', requireAuthor, (req, res) => {
    const { title, subtitle, category, body, status } = req.body;
    const article = writingStore.createArticle({ title, subtitle, category, body, status });
    if (!article) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(article);
  });

  const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post('/api/writing/upload', requireAuthor, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const ext = path.extname(req.file.originalname).toLowerCase();
      let body = '';

      if (ext === '.docx') {
        const result = await mammoth.convertToHtml({ path: req.file.path });
        body = result.value;
      } else if (ext === '.md' || ext === '.txt') {
        const fs = require('fs');
        body = fs.readFileSync(req.file.path, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Use .md, .txt, or .docx' });
      }

      // Clean up temp file
      try { require('fs').unlinkSync(req.file.path); } catch (e) { /* ignore */ }

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

  app.patch('/api/writing/:id', requireAuthor, (req, res) => {
    const article = writingStore.updateArticle(req.params.id, req.body);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  });

  app.get('/api/writing/analytics', requireAuthor, (req, res) => {
    res.json(writingAnalytics.getAnalytics());
  });

  app.delete('/api/writing/:id', requireAuthor, (req, res) => {
    const ok = writingStore.deleteArticle(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Article not found' });
    res.json({ deleted: true });
  });

  app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html'));
  });

  app.get('/requests', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'requests.html'));
  });

  app.use('/family', requireRole('family'));

  app.use('/family/pigeons/uploads', express.static(PIGEON_UPLOAD_DIR, {
    maxAge: 0,
    etag: true,
  }));

  app.get('/family', requireRole('family'), (req, res) => {
    res.type('html').send(renderFamilyHubPage(undefined, undefined, req.user));
  });

  app.get('/family/pigeons', requireRole('family'), (req, res) => {
    res.type('html').send(renderPigeonsPage(req.user));
  });

  app.get('/family/health', requireRole('family'), (req, res) => {
    res.type('html').send(renderFamilyHealthChooserPage());
  });

  app.get('/family/health/andrew', requireRole('family'), (req, res) => {
    res.type('html').send(renderPersonHealthPage(getPersonHealthData('andrew')));
  });

  app.get('/family/health/kaili', requireRole('family'), (req, res) => {
    res.type('html').send(renderPersonHealthPage(getPersonHealthData('kaili')));
  });

  app.get('/family/health/:personSlug/bloodwork', requireRole('family'), (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'bloodwork'));
  });

  app.get('/family/health/:personSlug/images', requireRole('family'), (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'images'));
  });

  app.get('/family/health/:personSlug/reports', requireRole('family'), (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'reports'));
  });

  app.get('/family/health/:personSlug/report/:fileName', requireRole('family'), (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    if (!person) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }

    const report = findReportFile(person, req.params.fileName);
    if (!report) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Report Not Found', 'The requested report file was not found.')
      );
    }

    if (!report.fullPath.startsWith(person.reportsDir) || !path.extname(report.fullPath)) {
      return res.status(400).type('html').send(
        renderFamilySectionPage('Invalid Report Path', 'That report path is not valid.')
      );
    }

    const backLinks = `<a href="/family/health/${person.slug}">${person.name} Health</a><a href="/family/health/${person.slug}/images">Images</a>`;
    if (report.ext === '.html') {
      return res.sendFile(report.fullPath);
    }
    if (report.ext === '.pdf') {
      return res.type('html').send(
        renderPersonHealthFileViewerPage(
          report.fileName,
          `<iframe class="viewer-frame" src="/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}"></iframe>`,
          backLinks,
          `/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`,
          report.fileName
        )
      );
    }
    if (report.ext === '.docx') {
      return res.type('html').send(
        renderPersonHealthFileViewerPage(
          report.fileName,
          `<iframe class="viewer-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${req.protocol}://${req.get('host')}/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`)}"></iframe>`,
          backLinks,
          `/family/health/${person.slug}/report/raw/${encodeURIComponent(report.fileName)}`,
          report.fileName
        )
      );
    }
    return res.sendFile(report.fullPath);
  });

  app.get('/family/health/:personSlug/report/raw/:fileName', requireRole('family'), (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    const report = person ? findReportFile(person, req.params.fileName) : null;
    if (!person || !report) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Report Not Found', 'The requested report file was not found.')
      );
    }
    return res.sendFile(report.fullPath);
  });

  app.get('/family/health/:personSlug/images/:studySlug', requireRole('family'), (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    const study = getImagingStudy(data.person, req.params.studySlug);
    if (!study) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Imaging Study Not Found', 'That imaging study does not exist.')
      );
    }
    return res.type('html').send(renderPersonImagingStudyPage(data, study));
  });

  app.get('/family/health/:personSlug/images/:studySlug/asset/:assetPath(*)', requireRole('family'), (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    const study = person ? getImagingStudy(person, req.params.studySlug) : null;
    const asset = study ? resolveStudyFile(study, req.params.assetPath) : null;
    if (!person || !study || !asset) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Imaging Asset Not Found', 'That imaging asset does not exist.')
      );
    }
    return res.sendFile(asset.fullPath);
  });

  app.get('/family/health/:personSlug/images/:studySlug/document/raw/:docPath(*)', requireRole('family'), (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    const study = person ? getImagingStudy(person, req.params.studySlug) : null;
    const doc = study ? resolveStudyFile(study, req.params.docPath) : null;
    if (!person || !study || !doc) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Study Document Not Found', 'That study document does not exist.')
      );
    }
    return res.sendFile(doc.fullPath);
  });

  app.get('/family/health/:personSlug/images/:studySlug/document/:docPath(*)', requireRole('family'), (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    const study = person ? getImagingStudy(person, req.params.studySlug) : null;
    const doc = study ? resolveStudyFile(study, req.params.docPath) : null;
    if (!person || !study || !doc) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Study Document Not Found', 'That study document does not exist.')
      );
    }
    const backLinks = `<a href="/family/health/${person.slug}">${person.name} Health</a><a href="/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}">Back to Study</a>`;
    if (doc.ext === '.pdf') {
      return res.type('html').send(
        renderPersonHealthFileViewerPage(
          doc.fileName,
          `<iframe class="viewer-frame" src="/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}"></iframe>`,
          backLinks,
          `/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`,
          doc.fileName
        )
      );
    }
    if (doc.ext === '.docx') {
      return res.type('html').send(
        renderPersonHealthFileViewerPage(
          doc.fileName,
          `<iframe class="viewer-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${req.protocol}://${req.get('host')}/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`)}"></iframe>`,
          backLinks,
          `/family/health/${person.slug}/images/${encodeURIComponent(study.slug)}/document/raw/${encodeURIComponent(doc.relativePath)}`,
          doc.fileName
        )
      );
    }
    return res.sendFile(doc.fullPath);
  });

  app.get('/family/medical', requireRole('family'), (req, res) => {
    res.redirect('/family/health');
  });

  app.get('/family/todos', requireRole('family'), (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Shared ToDos',
        'Protected placeholder for shared task lists, routines, and household follow-up items.'
      )
    );
  });

  app.get('/family/cameras', requireRole('family'), (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Camera Monitor',
        'Protected placeholder for security camera dashboards, snapshots, and future live feeds.'
      )
    );
  });

  app.get('/family/*', (req, res) => {
    res.status(404).type('html').send(
      renderFamilySectionPage(
        'Family Page Not Found',
        'This protected family route does not exist yet. The authorization boundary is still being enforced correctly.'
      )
    );
  });

  app.get('/dashboard', (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'))
  );

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });

  return app;
}

console.log('[server] Loading data...');
dataLoader.loadAll();

console.log('[server] Starting Google Sheets polling...');
sheetsPoller.startPolling();

console.log('[server] Preparing pigeon data...');
try {
  const pigeonImportResult = importExistingPigeonDataIfNeeded();
  if (pigeonImportResult.imported) {
    console.log(`[server] Imported pigeon data: ${pigeonImportResult.birds} birds, ${pigeonImportResult.medications} medications`);
  } else {
    console.log(`[server] Pigeon import skipped: ${pigeonImportResult.reason}`);
  }
} catch (err) {
  console.warn(`[server] Pigeon import failed: ${err.message}`);
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] Portfolio dashboard running at http://localhost:${PORT}`);
    console.log(`[server] Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
}

module.exports = {
  app,
  createApp,
};

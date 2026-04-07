/**
 * server/writingStore.js - Persistent storage for stock writing articles.
 *
 * Stores articles as JSON on disk at data/writing.json.
 * Each article has: id, title, subtitle, category, body (markdown), status, dates.
 */

const fs = require('fs');
const path = require('path');

const WRITING_PATH = path.join(__dirname, '..', 'data', 'writing.json');

const CATEGORY_LABELS = {
  'deep-dive': 'Deep Dive',
  'portfolio-update': 'Portfolio Update',
  'thesis-review': 'Thesis Review',
  'new-position': 'New Position',
  'lessons': 'Lessons Learned',
  'market-thoughts': 'Market Thoughts',
};

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function makeSlug(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function wordCount(text) {
  // Strip HTML tags before counting
  var plain = String(text || '').replace(/<[^>]+>/g, ' ');
  return plain.trim().split(/\s+/).filter(Boolean).length;
}

function readMinutes(words) {
  return Math.max(1, Math.round(words / 230));
}

function getDefaultData() {
  return { articles: [] };
}

function ensureDataFile() {
  const dir = path.dirname(WRITING_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(WRITING_PATH)) {
    fs.writeFileSync(WRITING_PATH, JSON.stringify(getDefaultData(), null, 2));
  }
}

function readData() {
  try {
    ensureDataFile();
    const raw = JSON.parse(fs.readFileSync(WRITING_PATH, 'utf-8'));
    if (!raw || !Array.isArray(raw.articles)) return getDefaultData();
    return raw;
  } catch {
    return getDefaultData();
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(WRITING_PATH, JSON.stringify(data, null, 2));
}

/**
 * Get all articles, newest first.
 * @param {string} [status] - Filter by 'published' or 'draft'. Omit for all.
 */
function getArticles(status) {
  const data = readData();
  let articles = data.articles;
  if (status) {
    articles = articles.filter(a => a.status === status);
  }
  articles.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  return articles;
}

/**
 * Get a single article by id or slug.
 */
function getArticle(idOrSlug) {
  const data = readData();
  return data.articles.find(a => a.id === idOrSlug || a.slug === idOrSlug) || null;
}

/**
 * Create a new article.
 */
function createArticle({ title, subtitle, category, body, status }) {
  if (!title || typeof title !== 'string' || !title.trim()) return null;

  const data = readData();
  const now = new Date().toISOString();
  const words = wordCount(body);

  const article = {
    id: makeId(),
    slug: makeSlug(title),
    title: title.trim(),
    subtitle: (subtitle || '').trim(),
    category: category || '',
    categoryLabel: CATEGORY_LABELS[category] || category || '',
    body: (body || '').trim(),
    wordCount: words,
    readMinutes: readMinutes(words),
    status: status === 'draft' ? 'draft' : 'published',
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'draft' ? null : now,
  };

  data.articles.unshift(article);
  writeData(data);
  return article;
}

/**
 * Update an existing article.
 */
function updateArticle(id, updates) {
  const data = readData();
  const article = data.articles.find(a => a.id === id);
  if (!article) return null;

  if (typeof updates.title === 'string' && updates.title.trim()) {
    article.title = updates.title.trim();
    article.slug = makeSlug(article.title);
  }
  if (typeof updates.subtitle === 'string') {
    article.subtitle = updates.subtitle.trim();
  }
  if (typeof updates.category === 'string') {
    article.category = updates.category;
    article.categoryLabel = CATEGORY_LABELS[updates.category] || updates.category || '';
  }
  if (typeof updates.body === 'string') {
    article.body = updates.body.trim();
    article.wordCount = wordCount(article.body);
    article.readMinutes = readMinutes(article.wordCount);
  }
  if (updates.status === 'published' && article.status === 'draft') {
    article.status = 'published';
    article.publishedAt = new Date().toISOString();
  }
  if (updates.status === 'draft') {
    article.status = 'draft';
  }

  article.updatedAt = new Date().toISOString();
  writeData(data);
  return article;
}

/**
 * Delete an article.
 */
function deleteArticle(id) {
  const data = readData();
  const idx = data.articles.findIndex(a => a.id === id);
  if (idx < 0) return false;
  data.articles.splice(idx, 1);
  writeData(data);
  return true;
}

module.exports = {
  CATEGORY_LABELS,
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
};

/**
 * server/writingAnalytics.js - Track article views for the writing section.
 *
 * Logs each unique view (email + article per day) to data/writing-analytics.json.
 * Only Drew can query the analytics data.
 */

const fs = require('fs');
const path = require('path');

const ANALYTICS_PATH = path.join(__dirname, '..', 'data', 'writing-analytics.json');

function getDefaultData() {
  return { views: [] };
}

function ensureDataFile() {
  const dir = path.dirname(ANALYTICS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ANALYTICS_PATH)) {
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(getDefaultData(), null, 2));
  }
}

function readData() {
  try {
    ensureDataFile();
    const raw = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf-8'));
    if (!raw || !Array.isArray(raw.views)) return getDefaultData();
    return raw;
  } catch {
    return getDefaultData();
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(data, null, 2));
}

/**
 * Record a view. Deduplicates by email + slug + date (one view per person per article per day).
 */
function recordView(email, slug, articleTitle) {
  if (!email || !slug) return;

  const data = readData();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Check for existing view today from this email on this article
  const exists = data.views.some(function(v) {
    return v.email === email && v.slug === slug && v.date === today;
  });

  if (exists) return;

  data.views.push({
    email: email,
    slug: slug,
    articleTitle: articleTitle || slug,
    date: today,
    timestamp: new Date().toISOString(),
  });

  writeData(data);
}

/**
 * Get analytics summary.
 */
function getAnalytics() {
  const data = readData();
  const views = data.views;

  // Per-article stats
  var articleMap = {};
  views.forEach(function(v) {
    if (!articleMap[v.slug]) {
      articleMap[v.slug] = {
        slug: v.slug,
        title: v.articleTitle || v.slug,
        totalViews: 0,
        uniqueReaders: {},
        recentViews: [],
      };
    }
    var a = articleMap[v.slug];
    a.totalViews++;
    a.uniqueReaders[v.email] = true;
    a.recentViews.push({
      email: v.email,
      date: v.date,
      timestamp: v.timestamp,
    });
  });

  // Convert to sorted array
  var articles = Object.values(articleMap).map(function(a) {
    return {
      slug: a.slug,
      title: a.title,
      totalViews: a.totalViews,
      uniqueReaderCount: Object.keys(a.uniqueReaders).length,
      readers: Object.keys(a.uniqueReaders).sort(),
      recentViews: a.recentViews.sort(function(x, y) {
        return y.timestamp.localeCompare(x.timestamp);
      }).slice(0, 50),
    };
  });

  articles.sort(function(a, b) { return b.totalViews - a.totalViews; });

  // Overall stats
  var allEmails = {};
  views.forEach(function(v) { allEmails[v.email] = true; });

  // Recent activity (last 20 views)
  var recent = views.slice().sort(function(a, b) {
    return b.timestamp.localeCompare(a.timestamp);
  }).slice(0, 30);

  return {
    totalViews: views.length,
    uniqueReaders: Object.keys(allEmails).length,
    articles: articles,
    recentActivity: recent,
  };
}

module.exports = {
  recordView,
  getAnalytics,
};

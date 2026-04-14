/**
 * server/writingPage.js - Server-rendered editorial writing section.
 *
 * "The Column" design — narrow editorial layout for stock investing articles.
 * Compose/upload view gated to drew1618t email (skipped for local dev testing).
 */

const { escapeHtml } = require('./utils/html');

/**
 * Very basic markdown-to-HTML for article bodies.
 * Handles: ## headings, > blockquotes (as pullquotes), paragraphs, **bold**, *italic*.
 */
function markdownToHtml(md) {
  if (!md) return '';
  const lines = String(md).split('\n');
  const blocks = [];
  let currentPara = [];
  let inQuote = false;
  let quoteLines = [];

  function flushPara() {
    if (currentPara.length > 0) {
      const text = currentPara.join(' ').trim();
      if (text) blocks.push('<p>' + inlineFormat(text) + '</p>');
      currentPara = [];
    }
  }

  function flushQuote() {
    if (quoteLines.length > 0) {
      const text = quoteLines.join(' ').trim();
      blocks.push('<div class="pullquote"><p>' + inlineFormat(text) + '</p></div>');
      quoteLines = [];
      inQuote = false;
    }
  }

  function inlineFormat(text) {
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Em dash
    text = text.replace(/---/g, '&mdash;');
    text = text.replace(/--/g, '&mdash;');
    return text;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading
    if (trimmed.startsWith('## ')) {
      flushQuote();
      flushPara();
      blocks.push('<h2>' + inlineFormat(escapeHtml(trimmed.slice(3).trim())) + '</h2>');
      continue;
    }

    // Blockquote (pullquote)
    if (trimmed.startsWith('> ')) {
      flushPara();
      inQuote = true;
      quoteLines.push(escapeHtml(trimmed.slice(2).trim()));
      continue;
    }

    // If we were in a quote and hit a non-quote line, flush
    if (inQuote && !trimmed.startsWith('>')) {
      flushQuote();
    }

    // Empty line = paragraph break
    if (trimmed === '') {
      flushPara();
      continue;
    }

    // Normal text
    currentPara.push(escapeHtml(trimmed));
  }

  flushQuote();
  flushPara();
  return blocks.join('\n\n    ');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Render the writing page.
 * @param {object} user - req.user from auth
 * @param {array} articles - published articles from writingStore
 * @param {object} [focusArticle] - if set, render this article as the full view
 */
function renderWritingPage(user, articles, focusArticle, analytics) {
  const email = (user && user.email) || '';
  const canCompose = email === 'drew1618t@gmail.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Writing — Drew's Stock Journal</title>
  <link rel="stylesheet" href="/css/writing.css?v=1">
</head>
<body>

<header class="site-header">
  <div class="site-name"><a href="/">Drew's Stock Journal</a></div>
  <nav class="nav-links">
    <a href="/">Home</a>
    <a href="/dashboard">Dashboard</a>
    <a href="/writing" class="active" id="nav-writing" onclick="showView('reading'); return false;">Writing</a>
    ${canCompose ? '<a href="/writing/analytics" class="' + (analytics ? 'active' : '') + '" style="' + (analytics ? 'color:#C8102E' : '') + '">Analytics</a>' : ''}
    ${canCompose ? '<a href="#" class="new-writing" id="nav-new" onclick="showView(\'compose\'); return false;">+ New</a>' : ''}
  </nav>
</header>

<main class="column">

  <!-- ═══ COMPOSE VIEW ═══ -->
  ${canCompose ? `
  <section class="compose-view" id="compose-view">
    <h1 class="compose-heading">New Writing</h1>
    <p class="compose-sub">Write a new piece or upload an existing draft.</p>

    <div class="compose-tabs">
      <button class="compose-tab active" onclick="switchComposeTab('write')">Write</button>
      <button class="compose-tab" onclick="switchComposeTab('upload')">Upload</button>
    </div>

    <!-- WRITE TAB -->
    <div class="compose-panel visible" id="panel-write">
      <div class="field-group">
        <label class="field-label">Category</label>
        <select class="field-select" id="write-category">
          <option value="">Select a category&hellip;</option>
          <option value="deep-dive">Deep Dive</option>
          <option value="portfolio-update">Portfolio Update</option>
          <option value="thesis-review">Thesis Review</option>
          <option value="new-position">New Position</option>
          <option value="lessons">Lessons Learned</option>
          <option value="market-thoughts">Market Thoughts</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">Title</label>
        <input type="text" class="field-input title-input" id="write-title" placeholder="Your headline here&hellip;">
      </div>

      <div class="field-group">
        <label class="field-label">Subtitle</label>
        <input type="text" class="field-input" id="write-subtitle" placeholder="A one-line summary (optional)">
      </div>

      <div class="field-group">
        <label class="field-label">Body</label>
        <textarea class="field-textarea" id="write-body" placeholder="Start writing&hellip;"></textarea>
        <div class="field-hint">Markdown supported. Use ## for section headers, > for pull quotes.</div>
      </div>

      <div class="compose-actions">
        <button class="btn-publish" onclick="publishArticle('write')">Publish</button>
        <button class="btn-save-draft" onclick="saveDraft('write')">Save Draft</button>
      </div>
    </div>

    <!-- UPLOAD TAB -->
    <div class="compose-panel" id="panel-upload">
      <div class="field-group">
        <label class="field-label">Category</label>
        <select class="field-select" id="upload-category">
          <option value="">Select a category&hellip;</option>
          <option value="deep-dive">Deep Dive</option>
          <option value="portfolio-update">Portfolio Update</option>
          <option value="thesis-review">Thesis Review</option>
          <option value="new-position">New Position</option>
          <option value="lessons">Lessons Learned</option>
          <option value="market-thoughts">Market Thoughts</option>
        </select>
      </div>

      <div class="upload-zone" id="upload-zone">
        <div class="upload-zone-icon">&uarr;</div>
        <div class="upload-zone-text">Drop a file here, or click to browse</div>
        <div class="upload-zone-hint">.md, .txt, or .docx</div>
        <input type="file" id="file-input" accept=".md,.txt,.docx">
      </div>

      <div class="upload-file-info" id="upload-file-info">
        <span class="upload-file-name" id="upload-file-name"></span>
        <button class="upload-file-remove" onclick="clearUpload()">Remove</button>
      </div>

      <div class="field-group">
        <label class="field-label">Title Override</label>
        <input type="text" class="field-input title-input" id="upload-title" placeholder="Leave blank to use filename&hellip;">
      </div>

      <div class="compose-actions">
        <button class="btn-publish" onclick="publishArticle('upload')">Publish</button>
        <button class="btn-save-draft" onclick="saveDraft('upload')">Save Draft</button>
      </div>
    </div>
  </section>
  ` : ''}

  <!-- ═══ READING VIEW ═══ -->
  <section id="reading-view">
    ${analytics ? renderAnalyticsView(analytics) : focusArticle ? renderFullArticle(focusArticle, articles, canCompose) : renderArticleList(articles)}
  </section>

</main>

<script src="/js/writing.js?v=1"></script>

</body>
</html>`;
}

/**
 * Detect whether body is HTML (from .docx) or markdown, and render accordingly.
 */
function renderBody(body) {
  if (!body) return '';
  // If body contains HTML tags, render as-is (from mammoth/docx conversion)
  if (body.trim().startsWith('<')) {
    return body;
  }
  // Otherwise treat as markdown
  return markdownToHtml(body);
}

/**
 * Format HTML body with line breaks for the textarea editor.
 * Inserts newlines before block-level tags so the content is scannable.
 */
function formatBodyForEditor(body) {
  if (!body) return '';
  var s = String(body);
  // If it's not HTML, return as-is (markdown already has line breaks)
  if (!s.trim().startsWith('<')) return s;

  // Add blank line before block elements for visual separation
  s = s.replace(/<(p|h[1-6]|ul|ol|li|table|tr|blockquote|div|hr)([ >])/gi, '\n\n<$1$2');
  // Add newline after closing block elements
  s = s.replace(/<\/(p|h[1-6]|ul|ol|li|table|tr|blockquote|div)>/gi, '</$1>\n');
  // Clean up excessive newlines (3+ becomes 2)
  s = s.replace(/\n{3,}/g, '\n\n');
  // Trim leading whitespace
  s = s.replace(/^\n+/, '');

  return s;
}

// ── Render helpers (string concat to avoid template-in-template issues) ──

function renderFullArticle(article, allArticles, canCompose) {
  var otherArticles = allArticles.filter(function(a) { return a.id !== article.id; }).slice(0, 3);
  var html = '';

  html += '<a href="/writing" class="back-link">&larr; All Writing</a>';

  // Edit bar (author only)
  if (canCompose) {
    html += '<div class="edit-bar">';
    html += '<button class="btn-edit" onclick="startEdit()">Edit</button>';
    html += '<button class="btn-delete" onclick="deleteArticle(\'' + article.id + '\', \'' + escapeHtml(article.title).replace(/'/g, "\\'") + '\')">Delete</button>';
    html += '</div>';
  }

  // Edit view (hidden by default) — split pane with live preview
  if (canCompose) {
    html += '<div class="edit-view" id="article-edit-view">';
    html += '<h1 class="compose-heading">Edit Article</h1>';

    // Meta fields above the split
    html += '<div class="field-group"><label class="field-label">Category</label>';
    html += '<select class="field-select" id="edit-category" onchange="updatePreview()">';
    html += '<option value="">Select a category&hellip;</option>';
    var cats = [['deep-dive','Deep Dive'],['portfolio-update','Portfolio Update'],['thesis-review','Thesis Review'],['new-position','New Position'],['lessons','Lessons Learned'],['market-thoughts','Market Thoughts']];
    cats.forEach(function(c) {
      var sel = c[0] === article.category ? ' selected' : '';
      html += '<option value="' + c[0] + '"' + sel + '>' + c[1] + '</option>';
    });
    html += '</select></div>';

    html += '<div class="field-group"><label class="field-label">Title</label>';
    html += '<input type="text" class="field-input title-input" id="edit-title" value="' + escapeHtml(article.title) + '" oninput="updatePreview()"></div>';

    html += '<div class="field-group"><label class="field-label">Subtitle</label>';
    html += '<input type="text" class="field-input" id="edit-subtitle" value="' + escapeHtml(article.subtitle || '') + '" oninput="updatePreview()"></div>';

    // Split pane: editor left, preview right
    html += '<button class="preview-toggle" id="preview-toggle" onclick="toggleMobilePreview()">Show Preview</button>';
    html += '<div class="edit-split">';

    // Left: editor
    html += '<div class="edit-pane">';
    html += '<div class="pane-label">Editor</div>';
    html += '<div class="field-group body-group">';
    html += '<textarea class="field-textarea" id="edit-body" oninput="updatePreview()">' + escapeHtml(formatBodyForEditor(article.body)) + '</textarea>';
    html += '</div>';
    html += '</div>';

    // Right: live preview
    html += '<div class="preview-pane" id="preview-pane">';
    html += '<div class="pane-label">Preview</div>';
    html += '<div class="preview-content" id="preview-content">';
    html += '<div class="preview-empty">Start editing to see preview...</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // close .edit-split

    html += '<div class="edit-actions">';
    html += '<button class="btn-publish" onclick="saveEdit(\'' + article.id + '\')">Save Changes</button>';
    html += '<button class="btn-cancel" onclick="cancelEdit()">Cancel</button>';
    html += '</div></div>';
  }

  // Read view
  html += '<div id="article-read-view" class="read-view">';
  html += '<article class="full-article">';
  if (article.categoryLabel) {
    html += '<div class="article-tag">' + escapeHtml(article.categoryLabel) + '</div>';
  }
  html += '<h1>' + escapeHtml(article.title) + '</h1>';
  if (article.subtitle) {
    html += '<div class="subtitle">' + escapeHtml(article.subtitle) + '</div>';
  }
  html += '<hr class="thin-rule">';
  html += '<div class="byline"><span class="author">Drew</span> &middot; '
    + formatDate(article.publishedAt || article.createdAt) + ' &middot; '
    + article.readMinutes + ' min read</div>';
  html += renderBody(article.body);
  html += '<div class="article-footer">';
  html += '<span class="read-time">' + article.wordCount.toLocaleString() + ' words</span>';
  html += '<a href="/writing/' + article.slug + '/export" download="' + escapeHtml(article.slug) + '.html" class="share-link">Download &darr;</a>';
  html += '</div></article>';
  html += '</div>';

  otherArticles.forEach(function(a) { html += renderPreviewCard(a); });
  return html;
}

function renderArticleList(articles) {
  if (!articles || articles.length === 0) {
    return '<div style="text-align: center; padding: 80px 0;">'
      + '<h1 style="font-size: 28px; margin-bottom: 12px;">No articles yet</h1>'
      + '<p style="color: #6B6B6B; font-style: italic;">Click <strong>+ New</strong> to write your first piece.</p>'
      + '</div>';
  }

  var featured = articles[0];
  var rest = articles.slice(1);
  var excerpt = getExcerpt(featured.body, 280);
  var html = '';

  html += '<article class="full-article" style="cursor: pointer;" onclick="window.location.href=\'/writing/' + featured.slug + '\'">';
  if (featured.categoryLabel) {
    html += '<div class="article-tag">' + escapeHtml(featured.categoryLabel) + '</div>';
  }
  html += '<h1>' + escapeHtml(featured.title) + '</h1>';
  if (featured.subtitle) {
    html += '<div class="subtitle">' + escapeHtml(featured.subtitle) + '</div>';
  }
  html += '<hr class="thin-rule">';
  html += '<div class="byline"><span class="author">Drew</span> &middot; '
    + formatDate(featured.publishedAt || featured.createdAt) + ' &middot; '
    + featured.readMinutes + ' min read</div>';
  html += '<p>' + escapeHtml(excerpt) + '</p>';
  html += '<div class="article-footer">';
  html += '<span class="read-time">' + featured.wordCount.toLocaleString() + ' words</span>';
  html += '<a href="/writing/' + featured.slug + '" class="share-link">Read more &rarr;</a>';
  html += '</div></article>';

  rest.forEach(function(a) { html += renderPreviewCard(a); });
  return html;
}

function renderPreviewCard(article) {
  var excerpt = getExcerpt(article.body, 160);
  var html = '';
  html += '<div class="article-preview">';
  if (article.categoryLabel) {
    html += '<div class="article-tag">' + escapeHtml(article.categoryLabel) + '</div>';
  }
  html += '<h2><a href="/writing/' + article.slug + '">' + escapeHtml(article.title) + '</a></h2>';
  html += '<p class="excerpt">' + escapeHtml(excerpt) + '</p>';
  html += '<div class="meta">' + formatDate(article.publishedAt || article.createdAt) + ' &middot; ' + article.readMinutes + ' min read</div>';
  html += '</div>';
  return html;
}

function renderAnalyticsView(analytics) {
  var html = '';

  html += '<a href="/writing" class="back-link">&larr; Back to Writing</a>';
  html += '<h1 class="analytics-heading">Analytics</h1>';
  html += '<p class="analytics-sub">Who\'s reading your writing.</p>';

  if (analytics.totalViews === 0) {
    html += '<div class="analytics-empty">No views yet. Share your articles and check back.</div>';
    return html;
  }

  // Summary stats
  html += '<div class="analytics-stats">';
  html += '<div class="stat-card"><div class="stat-number">' + analytics.totalViews + '</div><div class="stat-label">Total Views</div></div>';
  html += '<div class="stat-card"><div class="stat-number">' + analytics.uniqueReaders + '</div><div class="stat-label">Unique Readers</div></div>';
  html += '</div>';

  // Per-article breakdown
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">By Article</div>';
  html += '<table class="analytics-table">';
  html += '<thead><tr><th>Article</th><th>Views</th><th>Readers</th><th>Who</th></tr></thead>';
  html += '<tbody>';

  analytics.articles.forEach(function(a) {
    html += '<tr>';
    html += '<td><a href="/writing/' + a.slug + '" class="article-link">' + escapeHtml(a.title) + '</a></td>';
    html += '<td>' + a.totalViews + '</td>';
    html += '<td>' + a.uniqueReaderCount + '</td>';
    html += '<td><div class="reader-list">';
    a.readers.forEach(function(email) {
      var label = email.split('@')[0];
      html += '<span class="reader-tag">' + escapeHtml(label) + '</span>';
    });
    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // Recent activity
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">Recent Activity</div>';
  html += '<table class="analytics-table">';
  html += '<thead><tr><th>Reader</th><th>Article</th><th>Date</th></tr></thead>';
  html += '<tbody>';

  analytics.recentActivity.forEach(function(v) {
    var label = v.email.split('@')[0];
    html += '<tr>';
    html += '<td class="email-cell">' + escapeHtml(label) + '</td>';
    html += '<td><a href="/writing/' + v.slug + '" class="article-link">' + escapeHtml(v.articleTitle || v.slug) + '</a></td>';
    html += '<td class="date-cell">' + v.date + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  return html;
}

function getExcerpt(body, maxLen) {
  if (!body) return '';
  var plain = String(body)
    // Strip HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Strip markdown formatting
    .replace(/^##\s+.*/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/---/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

/**
 * Render a standalone HTML file for sharing an article externally.
 * Self-contained with inline CSS, Google Fonts fallback, no auth needed.
 */
function renderArticleExport(article) {
  var bodyHtml = article.body.trim().startsWith('<') ? article.body : markdownToHtml(article.body);

  return '<!DOCTYPE html>\n'
    + '<html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + escapeHtml(article.title) + ' — Drew\'s Stock Journal</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }'
    + 'body { background: #F7F3ED; color: #1A1A1A; font-family: "Source Serif 4", Georgia, serif; font-size: 18px; line-height: 1.75; -webkit-font-smoothing: antialiased; max-width: 640px; margin: 0 auto; padding: 48px 24px 80px; }'
    + '.header { font-family: "Playfair Display", Georgia, serif; font-size: 13px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; color: #6B6B6B; border-bottom: 1px solid #D4CFC7; padding-bottom: 16px; margin-bottom: 40px; }'
    + '.tag { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #C8102E; margin-bottom: 12px; }'
    + 'h1 { font-family: "Playfair Display", Georgia, serif; font-size: 42px; font-weight: 900; line-height: 1.15; color: #1A1A1A; margin-bottom: 8px; letter-spacing: -0.5px; }'
    + '.subtitle { font-family: "Playfair Display", Georgia, serif; font-size: 20px; font-weight: 400; font-style: italic; color: #6B6B6B; line-height: 1.4; margin-bottom: 20px; }'
    + '.rule { border: none; border-top: 1px solid #D4CFC7; margin: 20px 0 24px; }'
    + '.byline { font-size: 14px; color: #6B6B6B; margin-bottom: 32px; font-style: italic; }'
    + '.byline strong { color: #1A1A1A; font-style: normal; font-weight: 600; }'
    + 'p { margin-bottom: 24px; }'
    + 'h1, h2, h3 { font-family: "Playfair Display", Georgia, serif; }'
    + 'h2 { font-size: 26px; font-weight: 700; line-height: 1.3; margin-top: 40px; margin-bottom: 20px; }'
    + 'article h1 { font-size: 28px; margin-top: 44px; margin-bottom: 16px; }'
    + '.pullquote, blockquote { position: relative; margin: 40px 0; padding: 24px 0 24px 28px; border-left: 3px solid #C8102E; }'
    + '.pullquote p, blockquote p { font-family: "Playfair Display", Georgia, serif; font-size: 22px; line-height: 1.5; font-style: italic; margin-bottom: 0; }'
    + 'table { width: 100%; border-collapse: collapse; margin: 28px 0; font-size: 15px; line-height: 1.5; }'
    + 'th, td { border: 1px solid #D4CFC7; padding: 10px 14px; text-align: left; vertical-align: top; }'
    + 'th { background: #EDE8DF; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: #6B6B6B; }'
    + 'tr:nth-child(even) td { background: #FAF7F2; }'
    + 'ul, ol { margin: 16px 0; padding-left: 28px; }'
    + 'li { margin-bottom: 8px; }'
    + 'strong { font-weight: 700; }'
    + 'em { font-style: italic; }'
    + '.footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #D4CFC7; font-size: 13px; color: #6B6B6B; }'
    + '@media (max-width: 700px) { body { padding: 32px 20px 60px; font-size: 17px; } h1 { font-size: 34px; } }'
    + '</style></head><body>'
    + '<div class="header">Drew\'s Stock Journal</div>'
    + (article.categoryLabel ? '<div class="tag">' + escapeHtml(article.categoryLabel) + '</div>' : '')
    + '<h1>' + escapeHtml(article.title) + '</h1>'
    + (article.subtitle ? '<div class="subtitle">' + escapeHtml(article.subtitle) + '</div>' : '')
    + '<hr class="rule">'
    + '<div class="byline"><strong>Drew</strong> &middot; ' + formatDate(article.publishedAt || article.createdAt) + ' &middot; ' + article.readMinutes + ' min read</div>'
    + '<article>' + bodyHtml + '</article>'
    + '<div class="footer">' + article.wordCount.toLocaleString() + ' words &middot; Drew\'s Stock Journal</div>'
    + '</body></html>';
}

module.exports = { renderWritingPage, renderArticleExport };

/**
 * server/writingPage.js - Server-rendered editorial writing section.
 *
 * "The Column" design — narrow editorial layout for stock investing articles.
 * Compose/upload view gated to drew1618t email (skipped for local dev testing).
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    @font-face {
      font-family: 'Playfair Display';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url('/fonts/playfair-display-400.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Playfair Display';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url('/fonts/playfair-display-700.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Playfair Display';
      font-style: normal;
      font-weight: 900;
      font-display: swap;
      src: url('/fonts/playfair-display-900.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Playfair Display';
      font-style: italic;
      font-weight: 400;
      font-display: swap;
      src: url('/fonts/playfair-display-400-italic.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Playfair Display';
      font-style: italic;
      font-weight: 700;
      font-display: swap;
      src: url('/fonts/playfair-display-700-italic.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Source Serif 4';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url('/fonts/source-serif-4-400.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Source Serif 4';
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url('/fonts/source-serif-4-600.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Source Serif 4';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url('/fonts/source-serif-4-700.woff2') format('woff2');
    }

    body {
      background: #F7F3ED;
      color: #1A1A1A;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 18px;
      line-height: 1.75;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Header ── */
    .site-header {
      max-width: 640px;
      margin: 0 auto;
      padding: 48px 24px 0;
    }

    .site-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #6B6B6B;
      border-bottom: 1px solid #D4CFC7;
      padding-bottom: 16px;
      margin-bottom: 0;
    }

    .site-name a {
      color: inherit;
      text-decoration: none;
    }

    .site-name a:hover {
      color: #C8102E;
    }

    .nav-links {
      display: flex;
      gap: 28px;
      padding: 14px 0;
      border-bottom: 1px solid #D4CFC7;
      margin-bottom: 48px;
    }

    .nav-links a {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-decoration: none;
      color: #6B6B6B;
      transition: color 0.2s;
    }

    .nav-links a:hover,
    .nav-links a.active {
      color: #C8102E;
    }

    .nav-links a.new-writing {
      color: #C8102E;
      font-weight: 600;
      cursor: pointer;
    }

    .nav-links a.new-writing:hover {
      opacity: 0.7;
    }

    /* ── Column ── */
    .column {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 24px 80px;
    }

    /* ── Articles ── */
    article { margin-bottom: 72px; }
    article + article { padding-top: 72px; border-top: 1px solid #D4CFC7; }

    .article-tag {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #C8102E;
      margin-bottom: 12px;
    }

    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 38px;
      font-weight: 900;
      line-height: 1.15;
      color: #1A1A1A;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    .byline {
      font-size: 14px;
      color: #6B6B6B;
      margin-bottom: 32px;
      font-style: italic;
    }

    .byline .author {
      color: #1A1A1A;
      font-style: normal;
      font-weight: 600;
    }

    article p { margin-bottom: 24px; }
    article p:last-of-type { margin-bottom: 0; }

    .pullquote {
      position: relative;
      margin: 40px 0;
      padding: 24px 0 24px 28px;
      border-left: 3px solid #C8102E;
    }

    .pullquote p {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      line-height: 1.5;
      font-style: italic;
      color: #1A1A1A;
      margin-bottom: 0;
    }

    h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.3;
      margin-top: 40px;
      margin-bottom: 20px;
      color: #1A1A1A;
    }

    .article-footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #E8E3DB;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .article-footer .read-time { font-size: 13px; color: #6B6B6B; }

    .article-footer .share-link {
      font-size: 13px;
      color: #C8102E;
      text-decoration: none;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .article-footer .share-link:hover { text-decoration: underline; }

    /* ── Article Previews ── */
    .article-preview {
      margin-bottom: 48px;
      padding-bottom: 48px;
      border-bottom: 1px solid #D4CFC7;
    }

    .article-preview:last-child { border-bottom: none; }

    .article-preview h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 0;
      margin-bottom: 12px;
    }

    .article-preview h2 a {
      color: #1A1A1A;
      text-decoration: none;
      transition: color 0.2s;
    }

    .article-preview h2 a:hover { color: #C8102E; }

    .article-preview .excerpt { color: #444; margin-bottom: 12px; }

    .article-preview .meta { font-size: 13px; color: #6B6B6B; }

    /* ── Full Article ── */
    .full-article h1 { font-size: 42px; margin-bottom: 8px; }

    .full-article .subtitle {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      font-style: italic;
      color: #6B6B6B;
      line-height: 1.4;
      margin-bottom: 20px;
    }

    .thin-rule {
      border: none;
      border-top: 1px solid #D4CFC7;
      margin: 20px 0 24px;
    }

    /* ── HTML content from docx ── */
    .full-article table {
      width: 100%;
      border-collapse: collapse;
      margin: 28px 0;
      font-size: 15px;
      line-height: 1.5;
    }

    .full-article th,
    .full-article td {
      border: 1px solid #D4CFC7;
      padding: 10px 14px;
      text-align: left;
      vertical-align: top;
    }

    .full-article th {
      background: #EDE8DF;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #6B6B6B;
    }

    .full-article tr:nth-child(even) td {
      background: #FAF7F2;
    }

    .full-article ul, .full-article ol {
      margin: 16px 0;
      padding-left: 28px;
    }

    .full-article li {
      margin-bottom: 8px;
    }

    .full-article h1 {
      font-size: 28px;
      margin-top: 44px;
      margin-bottom: 16px;
    }

    .full-article h1:first-child {
      margin-top: 0;
    }

    .full-article strong {
      font-weight: 700;
    }

    .full-article em {
      font-style: italic;
      color: #555;
    }

    /* ── Compose View ── */
    .compose-view { display: none; }
    .compose-view.visible { display: block; }

    .compose-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 900;
      color: #1A1A1A;
      margin-bottom: 8px;
    }

    .compose-sub {
      font-size: 15px;
      color: #6B6B6B;
      margin-bottom: 36px;
      font-style: italic;
    }

    .compose-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 32px;
      border-bottom: 1px solid #D4CFC7;
    }

    .compose-tab {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      padding: 12px 24px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: #6B6B6B;
      cursor: pointer;
      transition: all 0.2s;
    }

    .compose-tab:hover { color: #1A1A1A; }

    .compose-tab.active {
      color: #C8102E;
      border-bottom-color: #C8102E;
    }

    .compose-panel { display: none; }
    .compose-panel.visible { display: block; }

    .field-group { margin-bottom: 24px; }

    .field-label {
      display: block;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #6B6B6B;
      margin-bottom: 8px;
    }

    .field-input,
    .field-select,
    .field-textarea {
      width: 100%;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 17px;
      color: #1A1A1A;
      background: #FFFFFF;
      border: 1px solid #D4CFC7;
      padding: 12px 16px;
      transition: border-color 0.2s;
      outline: none;
    }

    .field-input:focus,
    .field-select:focus,
    .field-textarea:focus {
      border-color: #C8102E;
    }

    .field-input.title-input {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      padding: 16px;
      letter-spacing: -0.3px;
    }

    .field-textarea {
      min-height: 400px;
      line-height: 1.75;
      resize: vertical;
    }

    .field-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6B6B' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 16px center;
      padding-right: 40px;
      cursor: pointer;
    }

    .field-hint {
      font-size: 13px;
      color: #999;
      font-style: italic;
      margin-top: 6px;
    }

    /* Upload area */
    .upload-zone {
      border: 2px dashed #D4CFC7;
      padding: 56px 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: #FFFFFF;
      margin-bottom: 24px;
    }

    .upload-zone:hover,
    .upload-zone.dragover {
      border-color: #C8102E;
      background: #FDF8F4;
    }

    .upload-zone-icon {
      font-size: 36px;
      color: #D4CFC7;
      margin-bottom: 16px;
      line-height: 1;
    }

    .upload-zone-text {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 16px;
      color: #6B6B6B;
      margin-bottom: 8px;
    }

    .upload-zone-hint {
      font-size: 13px;
      color: #999;
      font-style: italic;
    }

    .upload-zone input[type="file"] { display: none; }

    .upload-file-info {
      display: none;
      padding: 16px;
      background: #FFFFFF;
      border: 1px solid #D4CFC7;
      margin-bottom: 24px;
      align-items: center;
      justify-content: space-between;
    }

    .upload-file-info.visible { display: flex; }

    .upload-file-name {
      font-size: 15px;
      color: #1A1A1A;
      font-weight: 600;
    }

    .upload-file-remove {
      font-size: 13px;
      color: #C8102E;
      cursor: pointer;
      background: none;
      border: none;
      font-family: 'Source Serif 4', Georgia, serif;
      font-weight: 600;
    }

    .btn-publish {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: #1A1A1A;
      color: #F7F3ED;
      border: none;
      padding: 14px 36px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-publish:hover { background: #C8102E; }

    .btn-save-draft {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      background: none;
      color: #6B6B6B;
      border: 1px solid #D4CFC7;
      padding: 14px 28px;
      cursor: pointer;
      transition: all 0.2s;
      margin-left: 12px;
    }

    .btn-save-draft:hover {
      border-color: #1A1A1A;
      color: #1A1A1A;
    }

    .compose-actions {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #D4CFC7;
      display: flex;
      align-items: center;
    }

    /* ── Back link ── */
    .back-link {
      display: inline-block;
      font-size: 13px;
      color: #6B6B6B;
      text-decoration: none;
      margin-bottom: 32px;
      transition: color 0.2s;
    }

    .back-link:hover { color: #C8102E; }

    /* ── Analytics ── */
    .analytics-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 900;
      color: #1A1A1A;
      margin-bottom: 8px;
    }

    .analytics-sub {
      font-size: 15px;
      color: #6B6B6B;
      font-style: italic;
      margin-bottom: 36px;
    }

    .analytics-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: #FFFFFF;
      border: 1px solid #D4CFC7;
      padding: 24px;
    }

    .stat-number {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      font-weight: 900;
      color: #C8102E;
      line-height: 1;
      margin-bottom: 6px;
    }

    .stat-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #6B6B6B;
    }

    .analytics-section {
      margin-bottom: 40px;
    }

    .analytics-section-title {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #6B6B6B;
      padding-bottom: 10px;
      border-bottom: 1px solid #D4CFC7;
      margin-bottom: 20px;
    }

    .analytics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }

    .analytics-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #6B6B6B;
      padding: 8px 12px;
      border-bottom: 2px solid #D4CFC7;
    }

    .analytics-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #E8E3DB;
      vertical-align: top;
    }

    .analytics-table tr:hover td {
      background: #FAF7F2;
    }

    .analytics-table .article-link {
      color: #1A1A1A;
      text-decoration: none;
      font-weight: 600;
    }

    .analytics-table .article-link:hover {
      color: #C8102E;
    }

    .analytics-table .email-cell {
      font-size: 13px;
      color: #555;
    }

    .analytics-table .date-cell {
      font-size: 13px;
      color: #999;
      white-space: nowrap;
    }

    .reader-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .reader-tag {
      font-size: 12px;
      background: #EDE8DF;
      color: #555;
      padding: 3px 10px;
      border-radius: 2px;
    }

    .analytics-empty {
      text-align: center;
      padding: 60px 0;
      color: #999;
      font-style: italic;
    }

    /* ── Edit Mode ── */
    .edit-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .btn-edit {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      background: none;
      color: #C8102E;
      border: 1px solid #C8102E;
      padding: 8px 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-edit:hover {
      background: #C8102E;
      color: #F7F3ED;
    }

    .btn-delete {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      background: none;
      color: #999;
      border: 1px solid #D4CFC7;
      padding: 8px 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-delete:hover {
      border-color: #C8102E;
      color: #C8102E;
    }

    .edit-view { display: none; }
    .edit-view.visible { display: block; }
    .read-view.hidden { display: none; }

    /* Split pane layout */
    .edit-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-top: 24px;
      height: calc(100vh - 160px);
    }

    .edit-pane {
      min-width: 0;
      padding-right: 24px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .pane-label {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #6B6B6B;
      padding-bottom: 10px;
      border-bottom: 1px solid #D4CFC7;
      margin-bottom: 20px;
      position: sticky;
      top: 0;
      background: #F7F3ED;
      z-index: 5;
    }

    .edit-pane .field-group { margin-bottom: 16px; }

    .edit-pane .field-group.body-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .edit-pane .field-textarea {
      flex: 1;
      font-size: 14px;
      line-height: 1.8;
      font-family: 'Source Serif 4', Georgia, monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
      resize: none;
      overflow-y: auto;
      min-height: 0;
    }

    .edit-pane .field-input.title-input {
      font-size: 20px;
    }

    /* Preview pane */
    .preview-pane {
      min-width: 0;
      border-left: 1px solid #D4CFC7;
      padding-left: 32px;
      overflow-y: auto;
    }

    .preview-pane .preview-content {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 17px;
      line-height: 1.75;
      color: #1A1A1A;
    }

    .preview-pane .preview-content h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .preview-pane .preview-content .preview-subtitle {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 400;
      font-style: italic;
      color: #6B6B6B;
      line-height: 1.4;
      margin-bottom: 16px;
    }

    .preview-pane .preview-content .preview-tag {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #C8102E;
      margin-bottom: 12px;
    }

    .preview-pane .preview-content .preview-byline {
      font-size: 14px;
      color: #6B6B6B;
      font-style: italic;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #D4CFC7;
    }

    .preview-pane .preview-content p { margin-bottom: 20px; }
    .preview-pane .preview-content h1 { font-size: 24px; margin-top: 32px; margin-bottom: 14px; }
    .preview-pane .preview-content strong { font-weight: 700; }
    .preview-pane .preview-content em { font-style: italic; color: #555; }

    .preview-pane .preview-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }

    .preview-pane .preview-content th,
    .preview-pane .preview-content td {
      border: 1px solid #D4CFC7;
      padding: 8px 10px;
      text-align: left;
    }

    .preview-pane .preview-content th {
      background: #EDE8DF;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #6B6B6B;
    }

    .preview-empty {
      color: #BBB;
      font-style: italic;
      padding: 40px 0;
      text-align: center;
    }

    .edit-actions {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #D4CFC7;
      display: flex;
      gap: 12px;
    }

    .btn-cancel {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 14px;
      font-weight: 600;
      background: none;
      color: #6B6B6B;
      border: 1px solid #D4CFC7;
      padding: 12px 28px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      border-color: #1A1A1A;
      color: #1A1A1A;
    }

    /* Mobile: preview toggle button */
    .preview-toggle {
      display: none;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      background: none;
      color: #6B6B6B;
      border: 1px solid #D4CFC7;
      padding: 8px 20px;
      cursor: pointer;
      margin-bottom: 16px;
      transition: all 0.2s;
    }

    .preview-toggle:hover {
      border-color: #C8102E;
      color: #C8102E;
    }

    .preview-toggle.active {
      background: #C8102E;
      border-color: #C8102E;
      color: #F7F3ED;
    }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .edit-view.visible .column-override {
        max-width: 100%;
        padding: 0 24px;
      }
    }

    @media (max-width: 840px) {
      .edit-split {
        grid-template-columns: 1fr;
        height: auto;
      }

      .edit-pane {
        overflow: visible;
        padding-right: 0;
        display: block;
      }

      .edit-pane .field-textarea {
        min-height: 400px;
        flex: none;
      }

      .preview-pane {
        border-left: none;
        padding-left: 0;
        border-top: 1px solid #D4CFC7;
        padding-top: 24px;
        overflow-y: visible;
        display: none;
      }

      .preview-pane.mobile-visible {
        display: block;
      }

      .preview-toggle {
        display: inline-block;
      }

      .pane-label {
        position: static;
      }
    }

    /* ── Responsive (general) ── */
    @media (max-width: 700px) {
      .column, .site-header { padding-left: 20px; padding-right: 20px; }
      h1 { font-size: 30px; }
      .full-article h1 { font-size: 34px; }
      body { font-size: 17px; }
      .compose-heading { font-size: 26px; }
    }
  </style>
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

<script>
  // ── View switching ──
  function showView(view) {
    var compose = document.getElementById('compose-view');
    var reading = document.getElementById('reading-view');
    var navWriting = document.getElementById('nav-writing');
    var navNew = document.getElementById('nav-new');

    if (view === 'compose' && compose) {
      compose.classList.add('visible');
      reading.style.display = 'none';
      if (navWriting) navWriting.classList.remove('active');
      if (navNew) navNew.classList.add('active');
    } else {
      if (compose) compose.classList.remove('visible');
      reading.style.display = 'block';
      if (navWriting) navWriting.classList.add('active');
      if (navNew) navNew.classList.remove('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Compose tab switching ──
  function switchComposeTab(tab) {
    document.querySelectorAll('.compose-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.compose-panel').forEach(function(p) { p.classList.remove('visible'); });

    if (tab === 'write') {
      document.querySelectorAll('.compose-tab')[0].classList.add('active');
      document.getElementById('panel-write').classList.add('visible');
    } else {
      document.querySelectorAll('.compose-tab')[1].classList.add('active');
      document.getElementById('panel-upload').classList.add('visible');
    }
  }

  // ── File upload ──
  var uploadZone = document.getElementById('upload-zone');
  var fileInput = document.getElementById('file-input');
  var fileInfo = document.getElementById('upload-file-info');
  var fileName = document.getElementById('upload-file-name');

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', function() { fileInput.click(); });

    uploadZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', function() {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', function() {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });
  }

  function handleFile(file) {
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.classList.add('visible');
    if (uploadZone) uploadZone.style.display = 'none';
  }

  function clearUpload() {
    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.classList.remove('visible');
    if (uploadZone) uploadZone.style.display = 'block';
  }

  // ── Publish / Save ──
  var uploadedFile = null;

  function handleFile(file) {
    uploadedFile = file;
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.classList.add('visible');
    if (uploadZone) uploadZone.style.display = 'none';
  }

  function clearUpload() {
    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.classList.remove('visible');
    if (uploadZone) uploadZone.style.display = 'block';
    uploadedFile = null;
  }

  function disableButtons() {
    var btns = document.querySelectorAll('.btn-publish, .btn-save-draft');
    btns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });
    return btns;
  }

  function enableButtons(btns) {
    btns.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
  }

  function handleResponse(btns) {
    return function(res) { return res.json(); };
  }

  function handleArticle(btns) {
    return function(article) {
      if (article.error) {
        alert('Error: ' + article.error);
        enableButtons(btns);
        return;
      }
      if (article.status === 'published') {
        window.location.href = '/writing/' + article.slug;
      } else {
        window.location.href = '/writing';
      }
    };
  }

  function handleError(btns) {
    return function(err) {
      alert('Failed to save: ' + err.message);
      enableButtons(btns);
    };
  }

  function submitWrite(status) {
    var title = document.getElementById('write-title').value;
    var body = document.getElementById('write-body').value;

    if (!title || !title.trim()) { alert('Please enter a title.'); return; }
    if (!body || !body.trim()) { alert('Please enter some content.'); return; }

    var btns = disableButtons();

    fetch('/api/writing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        subtitle: document.getElementById('write-subtitle').value,
        category: document.getElementById('write-category').value,
        body: body,
        status: status,
      }),
    })
    .then(handleResponse(btns))
    .then(handleArticle(btns))
    .catch(handleError(btns));
  }

  function submitUpload(status) {
    if (!uploadedFile) { alert('Please select a file first.'); return; }

    var title = document.getElementById('upload-title').value;
    var btns = disableButtons();

    var formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('category', document.getElementById('upload-category').value);
    formData.append('status', status);
    if (title) formData.append('title', title);

    fetch('/api/writing/upload', {
      method: 'POST',
      body: formData,
    })
    .then(handleResponse(btns))
    .then(handleArticle(btns))
    .catch(handleError(btns));
  }

  function publishArticle(mode) {
    if (mode === 'upload') submitUpload('published');
    else submitWrite('published');
  }

  function saveDraft(mode) {
    if (mode === 'upload') submitUpload('draft');
    else submitWrite('draft');
  }

  // ── Edit article ──
  var previewTimer = null;
  var categoryLabels = {
    'deep-dive': 'Deep Dive', 'portfolio-update': 'Portfolio Update',
    'thesis-review': 'Thesis Review', 'new-position': 'New Position',
    'lessons': 'Lessons Learned', 'market-thoughts': 'Market Thoughts'
  };

  function startEdit() {
    var readView = document.getElementById('article-read-view');
    var editView = document.getElementById('article-edit-view');
    // Widen the column for split pane
    var col = document.querySelector('.column');
    if (col) { col.style.maxWidth = '1200px'; }
    if (readView) readView.classList.add('hidden');
    if (editView) editView.classList.add('visible');
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    var readView = document.getElementById('article-read-view');
    var editView = document.getElementById('article-edit-view');
    var col = document.querySelector('.column');
    if (col) { col.style.maxWidth = '640px'; }
    if (editView) editView.classList.remove('visible');
    if (readView) readView.classList.remove('hidden');
  }

  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 150);
  }

  function renderPreview() {
    var preview = document.getElementById('preview-content');
    if (!preview) return;

    var title = document.getElementById('edit-title').value;
    var subtitle = document.getElementById('edit-subtitle').value;
    var category = document.getElementById('edit-category').value;
    var body = document.getElementById('edit-body').value;

    if (!title && !body) {
      preview.innerHTML = '<div class="preview-empty">Start editing to see preview...</div>';
      return;
    }

    var html = '';
    if (category && categoryLabels[category]) {
      html += '<div class="preview-tag">' + categoryLabels[category] + '</div>';
    }
    if (title) {
      html += '<h1>' + escapePreview(title) + '</h1>';
    }
    if (subtitle) {
      html += '<div class="preview-subtitle">' + escapePreview(subtitle) + '</div>';
    }
    html += '<div class="preview-byline">Drew &middot; Preview</div>';

    // Render body: if it looks like HTML, inject directly; otherwise basic markdown
    if (body.trim().indexOf('<') === 0) {
      html += body;
    } else {
      html += markdownToPreviewHtml(body);
    }

    preview.innerHTML = html;
  }

  function escapePreview(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function markdownToPreviewHtml(md) {
    if (!md) return '';
    var lines = md.split('\\n');
    var result = [];
    var para = [];

    function flushPara() {
      if (para.length > 0) {
        var text = para.join(' ').trim();
        if (text) result.push('<p>' + inlineFmt(text) + '</p>');
        para = [];
      }
    }

    function inlineFmt(t) {
      t = t.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      t = t.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      t = t.replace(/---/g, '&mdash;');
      t = t.replace(/--/g, '&mdash;');
      return t;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('## ') === 0) {
        flushPara();
        result.push('<h2>' + inlineFmt(escapePreview(line.slice(3))) + '</h2>');
      } else if (line.indexOf('> ') === 0) {
        flushPara();
        result.push('<blockquote style="border-left:3px solid #C8102E;padding-left:20px;margin:20px 0;font-style:italic;color:#555;">' + inlineFmt(escapePreview(line.slice(2))) + '</blockquote>');
      } else if (line === '') {
        flushPara();
      } else {
        para.push(escapePreview(line));
      }
    }
    flushPara();
    return result.join('');
  }

  // Mobile preview toggle
  function toggleMobilePreview() {
    var pane = document.getElementById('preview-pane');
    var btn = document.getElementById('preview-toggle');
    if (!pane || !btn) return;

    if (pane.classList.contains('mobile-visible')) {
      pane.classList.remove('mobile-visible');
      btn.textContent = 'Show Preview';
      btn.classList.remove('active');
    } else {
      pane.classList.add('mobile-visible');
      btn.textContent = 'Hide Preview';
      btn.classList.add('active');
      updatePreview();
    }
  }

  function saveEdit(articleId) {
    var title = document.getElementById('edit-title').value;
    var body = document.getElementById('edit-body').value;

    if (!title || !title.trim()) { alert('Title is required.'); return; }

    var btns = disableButtons();

    fetch('/api/writing/' + articleId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        subtitle: document.getElementById('edit-subtitle').value,
        category: document.getElementById('edit-category').value,
        body: body,
      }),
    })
    .then(function(res) { return res.json(); })
    .then(function(article) {
      if (article.error) {
        alert('Error: ' + article.error);
        enableButtons(btns);
        return;
      }
      window.location.href = '/writing/' + article.slug;
    })
    .catch(function(err) {
      alert('Failed to save: ' + err.message);
      enableButtons(btns);
    });
  }

  function deleteArticle(articleId, articleTitle) {
    if (!confirm('Delete "' + articleTitle + '"? This cannot be undone.')) return;

    fetch('/api/writing/' + articleId, { method: 'DELETE' })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      if (result.error) { alert('Error: ' + result.error); return; }
      window.location.href = '/writing';
    })
    .catch(function(err) { alert('Failed to delete: ' + err.message); });
  }
</script>

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
  html += '<a href="/writing" class="share-link">Back to Writing</a>';
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

module.exports = { renderWritingPage };

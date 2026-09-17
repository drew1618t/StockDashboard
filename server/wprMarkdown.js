/**
 * server/wprMarkdown.js - Small Markdown renderer for WPR report bundles.
 *
 * Covers what the WPR reports actually use: headings, paragraphs, pipe tables,
 * bullet and numbered lists, blockquotes, links, bold, italic, code spans, and
 * the bare `<a id="E01"></a>` anchors in evidence files. Everything else is
 * escaped text. Relative links between bundle files are rewritten to site URLs.
 */

const { escapeHtml } = require('./utils/html');

/** Rewrite links that point at sibling bundle files so they stay on the site. */
function rewriteHref(href, baseUrl) {
  const match = /^(report|transcript|evidence)\.md(#.*)?$/.exec(href);
  if (match) return `${baseUrl}${match[1] === 'report' ? '' : `/${match[1]}`}${match[2] || ''}`;
  const sibling = /^\.\.\/\d{4}-\d{2}-\d{2}_([A-Za-z0-9_-]{11})\/(report|transcript|evidence)\.md(#.*)?$/.exec(href);
  if (sibling) return `/wpr/videos/${sibling[1]}${sibling[2] === 'report' ? '' : `/${sibling[2]}`}${sibling[3] || ''}`;
  if (/^https?:\/\//.test(href) || href.startsWith('#')) return href;
  // Anything else is a path into WPR's data folders that the site does not serve.
  return null;
}

/** Apply inline formatting to already-escaped text. */
function inline(text, baseUrl) {
  let out = text;
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
    // Input text has already been escaped; undo entities before escaping the URL once.
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
    const target = rewriteHref(href.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => entities[entity]), baseUrl);
    if (!target) return label;
    const external = /^https?:\/\//.test(target) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${escapeHtml(target)}"${external}>${label}</a>`;
  });
  // Evidence references like [E03] link into the evidence register.
  out = out.replace(/\[(E\d{2,3})\]/g, `<a class="ref" href="${baseUrl}/evidence#$1">$1</a>`);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

/** Render one pipe table. Rows are the raw table lines including the separator. */
function renderTable(rows, baseUrl) {
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => inline(escapeHtml(cell.trim()), baseUrl));
  const header = cells(rows[0]);
  const aligns = rows[1].trim().replace(/^\||\|$/g, '').split('|').map(cell => (/^\s*-+:\s*$/.test(cell) ? ' class="num"' : ''));
  let html = '<table><thead><tr>' + header.map((cell, i) => `<th${aligns[i] || ''}>${cell}</th>`).join('') + '</tr></thead><tbody>';
  for (const row of rows.slice(2)) {
    html += '<tr>' + cells(row).map((cell, i) => `<td${aligns[i] || ''}>${cell}</td>`).join('') + '</tr>';
  }
  return html + '</tbody></table>';
}

/** Convert Markdown text to HTML. `baseUrl` is the video page URL used for relative links. */
function renderMarkdown(markdown, baseUrl) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === '') { index += 1; continue; }
    // Evidence reference definitions are metadata; inline [E01] links are handled above.
    if (/^\[E\d{2,3}\]:\s+evidence\.md#E\d{2,3}$/.test(trimmed)) { index += 1; continue; }

    const anchor = /^<a id="([A-Za-z0-9_-]+)"><\/a>$/.exec(trimmed);
    if (anchor) { blocks.push(`<a id="${anchor[1]}"></a>`); index += 1; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(escapeHtml(heading[2]), baseUrl)}</h${level}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('|') && index + 1 < lines.length && /^\|?\s*:?-+/.test(lines[index + 1].trim())) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(lines[index]); index += 1; }
      blocks.push(renderTable(rows, baseUrl));
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(escapeHtml(lines[index].trim().replace(/^>\s?/, '')));
        index += 1;
      }
      blocks.push(`<blockquote><p>${inline(quote.join(' '), baseUrl)}</p></blockquote>`);
      continue;
    }

    const listMatch = /^(?:[-*]|\d+\.)\s+/.exec(trimmed);
    if (listMatch) {
      const ordered = /^\d+\./.test(trimmed);
      const items = [];
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(`<li>${inline(escapeHtml(lines[index].trim().replace(pattern, '')), baseUrl)}</li>`);
        index += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    // Paragraph: consecutive non-blank lines that are not another block type.
    const para = [];
    while (index < lines.length) {
      const next = lines[index].trim();
      if (next === '' || /^#{1,4}\s/.test(next) || next.startsWith('|') || next.startsWith('> ') || /^(?:[-*]|\d+\.)\s+/.test(next) || /^<a id=/.test(next)) break;
      para.push(escapeHtml(next));
      index += 1;
    }
    blocks.push(`<p>${inline(para.join(' '), baseUrl)}</p>`);
  }

  return blocks.join('\n');
}

module.exports = { renderMarkdown };

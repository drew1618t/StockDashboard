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

  // ── Share ──
  function toggleShareMenu(e) {
    e.stopPropagation();
    var menu = document.getElementById('share-menu');
    if (menu) menu.classList.toggle('open');
  }

  // Close share menu when clicking outside
  document.addEventListener('click', function() {
    var menu = document.getElementById('share-menu');
    if (menu) menu.classList.remove('open');
  });

  function showToast(msg) {
    var toast = document.getElementById('share-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('visible');
    void toast.offsetWidth; // force reflow
    toast.classList.add('visible');
    setTimeout(function() { toast.classList.remove('visible'); }, 2200);
  }

  function copyArticleText() {
    var readView = document.getElementById('article-read-view');
    if (!readView) return;
    var article = readView.querySelector('.full-article');
    if (!article) return;
    var text = article.innerText || article.textContent;
    navigator.clipboard.writeText(text).then(function() {
      showToast('Article copied to clipboard');
    }).catch(function() {
      showToast('Failed to copy');
    });
    var menu = document.getElementById('share-menu');
    if (menu) menu.classList.remove('open');
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

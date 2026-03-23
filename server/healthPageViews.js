function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReminderItem(item) {
  return `<li class="health-list-item"><div><strong>${escapeHtml(item.label)}</strong><div class="health-meta">${escapeHtml(item.note || '')}</div></div><div class="health-chip">${escapeHtml(item.dueDate || item.status || 'Open')}</div></li>`;
}

function renderBulletItem(item) {
  return `<li class="health-list-item"><div><strong>${escapeHtml(item.title || 'Untitled')}</strong><div class="health-meta">${escapeHtml(item.summary || '')}</div></div><div class="health-chip">${escapeHtml(item.date_of_service || 'Undated')}</div></li>`;
}

function renderFileItem(item, basePath) {
  return `<li class="health-list-item"><div><strong>${escapeHtml(item.fileName)}</strong><div class="health-meta">${escapeHtml(item.ext.replace('.', '').toUpperCase())} report</div></div><a class="health-link-inline" href="${basePath}/report/${encodeURIComponent(item.fileName)}">Open</a></li>`;
}

function renderStudyListItem(study, basePath) {
  return `<li class="health-list-item"><div><strong>${escapeHtml(study.title)}</strong><div class="health-meta">${escapeHtml(study.date || 'Undated')} · ${escapeHtml(String(study.imageCount))} image${study.imageCount === 1 ? '' : 's'}</div></div><a class="health-link-inline" href="${basePath}/images/${encodeURIComponent(study.slug)}">Open Study</a></li>`;
}

function renderHealthThemeAssets(title) {
  return `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script>
    (function() {
      var bs = localStorage.getItem('family-bento-scheme');
      if (!bs) bs = 'peach';
      document.documentElement.setAttribute('data-bento', bs);
    })();
  </script>
  <style>
    * { box-sizing: border-box; }
    html { color-scheme: dark; }
    [data-bento="peach"] { --b-bg:#1a1a2e; --b-tile:#252540; --b-text:#f0ede8; --b-muted:rgba(240,237,232,0.4); --b-dim:rgba(240,237,232,0.72); --b-accent:#e8a87c; --b-accent-rgb:232,168,124; --b-secondary:#a78bfa; --b-switcher-bg:rgba(37,37,64,0.9); }
    [data-bento="sage"] { --b-bg:#1a2420; --b-tile:#243530; --b-text:#e8ede6; --b-muted:rgba(232,237,230,0.4); --b-dim:rgba(232,237,230,0.72); --b-accent:#8fbc8f; --b-accent-rgb:143,188,143; --b-secondary:#d4859a; --b-switcher-bg:rgba(36,53,48,0.9); }
    [data-bento="midnight"] { --b-bg:#141420; --b-tile:#1e1e32; --b-text:#eae6f0; --b-muted:rgba(234,230,240,0.4); --b-dim:rgba(234,230,240,0.72); --b-accent:#d4a843; --b-accent-rgb:212,168,67; --b-secondary:#6b8cce; --b-switcher-bg:rgba(30,30,50,0.9); }
    [data-bento="nordic"] { --b-bg:#1c2028; --b-tile:#272d38; --b-text:#e0e4ea; --b-muted:rgba(224,228,234,0.4); --b-dim:rgba(224,228,234,0.72); --b-accent:#7eb8d4; --b-accent-rgb:126,184,212; --b-secondary:#c49070; --b-switcher-bg:rgba(39,45,56,0.9); }
    body { margin:0; min-height:100vh; color:var(--b-text); background:var(--b-bg); font-family:"DM Sans","Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
    main { width:min(1240px, calc(100vw - 32px)); margin:0 auto; padding:36px 0 72px; }
    .bento-palette { position:fixed; top:16px; right:16px; z-index:1000; display:flex; gap:6px; padding:6px 10px; border-radius:12px; background:var(--b-switcher-bg); border:1px solid rgba(var(--b-accent-rgb),0.15); }
    .palette-label { font-size:9px; text-transform:uppercase; letter-spacing:.1em; color:var(--b-muted); align-self:center; margin-right:4px; }
    .bento-swatch { width:22px; height:22px; border-radius:50%; border:2px solid transparent; cursor:pointer; }
    .bento-swatch.active { border-color:white; }
    .bento-swatch[data-scheme="peach"] { background:linear-gradient(135deg, #e8a87c 50%, #a78bfa 50%); }
    .bento-swatch[data-scheme="sage"] { background:linear-gradient(135deg, #8fbc8f 50%, #d4859a 50%); }
    .bento-swatch[data-scheme="midnight"] { background:linear-gradient(135deg, #d4a843 50%, #6b8cce 50%); }
    .bento-swatch[data-scheme="nordic"] { background:linear-gradient(135deg, #7eb8d4 50%, #c49070 50%); }
    .eyebrow { color:var(--b-accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; margin-bottom:10px; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a, .health-link-inline, .action-button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 14px; border-radius:999px; text-decoration:none; color:var(--b-text); background:rgba(var(--b-accent-rgb),0.08); border:1px solid rgba(var(--b-accent-rgb),0.15); font:inherit; cursor:pointer; }
    .links a.primary { background:rgba(var(--b-accent-rgb),0.18); border-color:rgba(var(--b-accent-rgb),0.28); }
    .panel, .hero-card, .health-card { background:var(--b-tile); border:1px solid rgba(var(--b-accent-rgb),0.12); border-radius:24px; box-shadow:0 18px 48px rgba(0,0,0,0.28); }
    .card-label { display:inline-flex; align-items:center; gap:8px; margin-bottom:12px; font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:var(--b-accent); }
    .card-copy, .lead, .health-meta, .stat-label, .bullet-list, .doc-copy { color:var(--b-dim); line-height:1.6; }
    .health-list { list-style:none; margin:16px 0 0; padding:0; display:flex; flex-direction:column; gap:10px; }
    .health-list-item, .bullet-list li { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:12px 14px; border-radius:16px; background:rgba(var(--b-accent-rgb),0.06); border:1px solid rgba(var(--b-accent-rgb),0.08); }
    .health-chip { flex-shrink:0; padding:6px 10px; border-radius:999px; background:rgba(var(--b-accent-rgb),0.14); color:var(--b-accent); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
    .viewer-frame { width:100%; min-height:72vh; border:0; border-radius:18px; background:white; }
    .image-stack { display:flex; flex-direction:column; gap:14px; margin-top:18px; }
    .image-stack img { width:100%; border-radius:18px; display:block; background:rgba(255,255,255,0.04); }
    .doc-copy { white-space:pre-wrap; background:rgba(var(--b-accent-rgb),0.04); border-radius:18px; padding:18px; border:1px solid rgba(var(--b-accent-rgb),0.08); }
    @media (max-width: 640px) { main { width:min(100vw - 20px, 100%); padding-top:20px; } .health-list-item { flex-direction:column; } .bento-palette { top:auto; bottom:16px; right:50%; transform:translateX(50%); } }
  </style>
</head>`;
}

function renderHealthThemePalette() {
  return `<div class="bento-palette"><span class="palette-label">Palette</span><div class="bento-swatch" data-scheme="peach" onclick="switchScheme('peach')"></div><div class="bento-swatch" data-scheme="sage" onclick="switchScheme('sage')"></div><div class="bento-swatch" data-scheme="midnight" onclick="switchScheme('midnight')"></div><div class="bento-swatch" data-scheme="nordic" onclick="switchScheme('nordic')"></div></div>`;
}

function renderHealthThemeScript() {
  return `<script>
    function switchScheme(scheme) {
      document.documentElement.setAttribute('data-bento', scheme);
      localStorage.setItem('family-bento-scheme', scheme);
      updateSwatches();
    }
    function updateSwatches() {
      var current = document.documentElement.getAttribute('data-bento') || 'peach';
      document.querySelectorAll('.bento-swatch').forEach(function(sw) {
        sw.classList.toggle('active', sw.getAttribute('data-scheme') === current);
      });
    }
    updateSwatches();
  </script>`;
}

function renderPersonHealthPage(healthData) {
  const { person, reminders, bloodworkReport, immunizations, concerns, latestLabs, imagingStudies } = healthData;
  const basePath = `/family/health/${person.slug}`;
  const otherSlug = person.slug === 'andrew' ? 'kaili' : 'andrew';
  const otherName = person.slug === 'andrew' ? 'Kaili' : 'Andrew';
  const reminderMarkup = reminders.length ? reminders.map(renderReminderItem).join('') : '<li class="health-list-item"><div><strong>No reminders yet</strong><div class="health-meta">No due items were derived from the current records.</div></div></li>';
  const vaccineMarkup = immunizations.length ? immunizations.slice(0, 4).map(renderBulletItem).join('') : '<li class="health-list-item"><div><strong>No vaccine history found</strong><div class="health-meta">Immunization records have not been ingested yet.</div></div></li>';
  const concernMarkup = concerns.length ? concerns.slice(0, 4).map(renderBulletItem).join('') : '<li class="health-list-item"><div><strong>No recent flagged concerns</strong><div class="health-meta">Nothing recent matched the current alert rules.</div></div></li>';

  return `<!DOCTYPE html>
<html lang="en">
${renderHealthThemeAssets(`${person.name} Health`)}
<body>
  ${renderHealthThemePalette()}
  <main>
    <div class="links" style="justify-content:space-between; margin-bottom:24px;">
      <div>
        <div class="eyebrow">Family Health</div>
        <h1 style="margin:0; font-size:clamp(2.2rem, 5vw, 4rem); line-height:0.95;">${escapeHtml(person.name)} Health</h1>
        <p class="lead" style="margin-top:14px; max-width:68ch;">Balanced bento overview of bloodwork, imaging, reminders, vaccine timing, and recent issues pulled from the ingested health database and report folder.</p>
      </div>
      <div class="links">
        <a href="/family" class="primary">Family Hub</a>
        <a href="/family/health/${otherSlug}">Switch To ${otherName}</a>
        <a href="${basePath}/bloodwork">Bloodwork</a>
        <a href="${basePath}/images">Images</a>
        <a href="${basePath}/reports">Reports</a>
      </div>
    </div>
    <section style="margin-bottom:18px;">
      <article class="hero-card" style="padding:28px;">
        <div class="card-label">Snapshot</div>
        <h2 style="margin:0 0 8px; font-size:1.35rem;">Health records anchored to live source material</h2>
        <p class="card-copy">The dashboard is using ${escapeHtml(person.name)}&#39;s health database, recent reports, and reminder rules so the top-level page stays actionable rather than document-heavy.</p>
        <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:22px;">
          <div class="health-list-item" style="display:block;"><div class="stat-label">Latest bloodwork</div><div style="margin-top:6px; font-size:1.35rem;">${escapeHtml(latestLabs ? latestLabs.date_of_service : 'Unknown')}</div></div>
          <div class="health-list-item" style="display:block;"><div class="stat-label">Flagged lab items</div><div style="margin-top:6px; font-size:1.35rem;">${escapeHtml(String((bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length) || 0))}</div></div>
          <div class="health-list-item" style="display:block;"><div class="stat-label">Imaging studies</div><div style="margin-top:6px; font-size:1.35rem;">${escapeHtml(String(imagingStudies.length))}</div></div>
        </div>
      </article>
    </section>
    <section style="display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:16px;">
      <article class="health-card" style="padding:22px;">
        <div class="card-label">Reminders</div>
        <h2 style="margin:0 0 8px; font-size:1.35rem;">Due soon and due this year</h2>
        <p class="card-copy">Vaccines, annual bloodwork timing, and short-horizon follow-ups inferred from recent records.</p>
        <ul class="health-list">${reminderMarkup}</ul>
      </article>
      <article class="health-card" style="padding:22px;">
        <div class="card-label">Findings</div>
        <h2 style="margin:0 0 8px; font-size:1.35rem;">Recent concerns</h2>
        <p class="card-copy">Current items worth checking soon based on the latest labs and imaging summaries.</p>
        <ul class="health-list">${concernMarkup}</ul>
      </article>
      <article class="health-card" style="padding:22px;">
        <div class="card-label">Vaccines</div>
        <h2 style="margin:0 0 8px; font-size:1.35rem;">Recorded immunizations</h2>
        <p class="card-copy">Recent vaccine history stays here while the top buttons handle deeper bloodwork, imaging, and report pages.</p>
        <ul class="health-list">${vaccineMarkup}</ul>
      </article>
    </section>
  </main>
  ${renderHealthThemeScript()}
</body>
</html>`;
}

function renderPersonHealthSectionPage(healthData, section) {
  const { person, bloodworkReport, latestImaging, reportFiles, latestLabs, concerns, imagingStudies } = healthData;
  const basePath = `/family/health/${person.slug}`;
  const otherSlug = person.slug === 'andrew' ? 'kaili' : 'andrew';
  const otherName = person.slug === 'andrew' ? 'Kaili' : 'Andrew';
  const pageTitle = section === 'bloodwork' ? 'Bloodwork' : section === 'images' ? 'Images' : 'Reports';
  const relatedReports = reportFiles.filter(file => {
    if (section === 'bloodwork') return /bloodwork|lab/i.test(file.fileName);
    if (section === 'images') return /mri|ct|xray|ultra|imaging|report/i.test(file.fileName);
    return true;
  });
  const listMarkup = section === 'bloodwork'
    ? ((bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length) ? bloodworkReport.flags.map(flag => `<li>${escapeHtml(flag)}</li>`).join('') : '<li>No flagged bloodwork markers were parsed from the current report.</li>')
    : section === 'images'
      ? (latestImaging.length ? latestImaging.map(item => `<li><strong>${escapeHtml(item.title)}</strong><br><span class="health-meta">${escapeHtml(item.date_of_service || 'Undated')} · ${escapeHtml(item.summary || '')}</span></li>`).join('') : '<li>No imaging findings are currently available.</li>')
      : (relatedReports.length ? relatedReports.map(item => `<li><strong>${escapeHtml(item.fileName)}</strong><br><span class="health-meta">${escapeHtml(item.ext.replace('.', '').toUpperCase())} source document ready to open in the viewer.</span></li>`).join('') : '<li>No report files were found in the reports folder.</li>');
  const secondaryMarkup = section === 'images'
    ? (imagingStudies.length ? imagingStudies.map(study => renderStudyListItem(study, basePath)).join('') : '<li class="health-list-item"><div><strong>No imaging studies found</strong><div class="health-meta">Rendered image folders were not found yet.</div></div></li>')
    : (relatedReports.length ? relatedReports.map(item => renderFileItem(item, basePath)).join('') : '<li class="health-list-item"><div><strong>No matching report files</strong><div class="health-meta">Nothing in the reports folder matched this section yet.</div></div></li>');

  return `<!DOCTYPE html>
<html lang="en">
${renderHealthThemeAssets(`${person.name} ${pageTitle}`)}
<body>
  ${renderHealthThemePalette()}
  <main style="width:min(1080px, calc(100vw - 32px));">
    <div class="links" style="margin-bottom:22px;">
      <a href="${basePath}">${escapeHtml(person.name)} Health</a>
      <a href="${basePath}/bloodwork">Bloodwork</a>
      <a href="${basePath}/images">Images</a>
      <a href="${basePath}/reports">Reports</a>
      <a href="/family/health/${otherSlug}">Switch To ${otherName}</a>
    </div>
    <section class="panel" style="padding:24px; margin-bottom:16px;">
      <div class="eyebrow">${escapeHtml(person.name)} ${escapeHtml(pageTitle)}</div>
      <h1 style="margin:0; font-size:clamp(2rem, 4vw, 3.2rem);">${escapeHtml(pageTitle)}</h1>
      <p class="lead">${section === 'bloodwork' ? 'Focused lab view with report-derived flags, recent draw timing, and source document viewers.' : section === 'images' ? 'Focused imaging view with study lists, narrative findings, and click-through image viewers.' : 'Focused report view with source documents opened in-browser whenever possible.'}</p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:18px;">
        <div class="health-list-item" style="display:block;"><div class="stat-label">Latest date</div><div style="margin-top:6px; font-size:1.15rem;">${escapeHtml(section === 'bloodwork' ? (latestLabs ? latestLabs.date_of_service : 'Unknown') : section === 'images' ? (latestImaging[0] ? latestImaging[0].date_of_service || 'Undated' : 'Unknown') : (reportFiles[0] ? reportFiles[0].fileName : 'Unknown'))}</div></div>
        <div class="health-list-item" style="display:block;"><div class="stat-label">${section === 'images' ? 'Studies' : 'Source files'}</div><div style="margin-top:6px; font-size:1.15rem;">${escapeHtml(String(section === 'images' ? imagingStudies.length : relatedReports.length))}</div></div>
        <div class="health-list-item" style="display:block;"><div class="stat-label">${section === 'reports' ? 'Viewer-ready' : 'Flagged items'}</div><div style="margin-top:6px; font-size:1.15rem;">${escapeHtml(String(section === 'bloodwork' ? ((bloodworkReport && bloodworkReport.flags && bloodworkReport.flags.length) || 0) : section === 'images' ? concerns.length : relatedReports.length))}</div></div>
      </div>
    </section>
    <section class="panel" style="padding:24px; margin-bottom:16px;">
      <h2 style="margin:0;">${section === 'bloodwork' ? 'Flags and trend highlights' : section === 'images' ? 'Recent imaging findings' : 'Available source documents'}</h2>
      <ul class="bullet-list" style="margin-top:16px; padding-left:18px;">${listMarkup}</ul>
    </section>
    <section class="panel" style="padding:24px;">
      <h2 style="margin:0;">${section === 'images' ? 'Imaging studies' : 'Related report files'}</h2>
      <ul class="health-list">${secondaryMarkup}</ul>
    </section>
  </main>
  ${renderHealthThemeScript()}
</body>
</html>`;
}

function renderPersonImagingStudyPage(healthData, study) {
  const { person } = healthData;
  const basePath = `/family/health/${person.slug}`;
  const otherSlug = person.slug === 'andrew' ? 'kaili' : 'andrew';
  const otherName = person.slug === 'andrew' ? 'Kaili' : 'Andrew';
  const imageMarkup = study.images.length
    ? study.images.map((image, index) => `<img src="${basePath}/images/${encodeURIComponent(study.slug)}/asset/${encodeURIComponent(image.relativePath)}" alt="${escapeHtml(study.title)} image ${index + 1}" loading="lazy">`).join('')
    : '<div class="health-list-item"><div><strong>No rendered images found</strong><div class="health-meta">This study does not have a rendered image set yet.</div></div></div>';
  const docMarkup = study.documents.length
    ? study.documents.map(file => `<li class="health-list-item"><div><strong>${escapeHtml(file.fileName)}</strong><div class="health-meta">${escapeHtml(file.ext.replace('.', '').toUpperCase())}</div></div><a class="health-link-inline" href="${basePath}/images/${encodeURIComponent(study.slug)}/document/${encodeURIComponent(file.relativePath)}">Open Doc</a></li>`).join('')
    : '<li class="health-list-item"><div><strong>No study documents</strong><div class="health-meta">Only images were found for this study.</div></div></li>';

  return `<!DOCTYPE html>
<html lang="en">
${renderHealthThemeAssets(`${person.name} ${study.title}`)}
<body>
  ${renderHealthThemePalette()}
  <main style="width:min(1180px, calc(100vw - 32px));">
    <div class="links" style="margin-bottom:22px;">
      <a href="${basePath}">${escapeHtml(person.name)} Health</a>
      <a href="${basePath}/images">All Imaging</a>
      <a href="${basePath}/reports">Reports</a>
      <a href="/family/health/${otherSlug}">Switch To ${otherName}</a>
    </div>
    <section class="panel" style="padding:24px; margin-bottom:16px;">
      <div class="eyebrow">Imaging Study</div>
      <h1 style="margin:0; font-size:clamp(2rem, 4vw, 3.2rem);">${escapeHtml(study.title)}</h1>
      <p class="lead">${escapeHtml(study.date || 'Undated')} · ${escapeHtml(String(study.imageCount))} rendered image${study.imageCount === 1 ? '' : 's'} available to scroll through below.</p>
    </section>
    <section class="panel" style="padding:24px; margin-bottom:16px;">
      <h2 style="margin:0;">Study Documents</h2>
      <ul class="health-list">${docMarkup}</ul>
    </section>
    <section class="panel" style="padding:24px;">
      <h2 style="margin:0;">Images</h2>
      <div class="image-stack">${imageMarkup}</div>
    </section>
  </main>
  ${renderHealthThemeScript()}
</body>
</html>`;
}

function renderPersonHealthFileViewerPage(title, bodyMarkup, actionsMarkup, shareFileUrl = '', shareFileName = '') {
  return `<!DOCTYPE html>
<html lang="en">
${renderHealthThemeAssets(title)}
<body>
  ${renderHealthThemePalette()}
  <main style="width:min(1180px, calc(100vw - 32px));">
    <div class="links" style="margin-bottom:22px;">${actionsMarkup}<button type="button" class="action-button" onclick="shareCurrentPage()">Share</button></div>
    <section class="panel" style="padding:24px;">
      <div class="eyebrow">Source Document</div>
      <h1 style="margin:0 0 16px; font-size:clamp(2rem, 4vw, 3.2rem);">${escapeHtml(title)}</h1>
      ${bodyMarkup}
    </section>
  </main>
  ${renderHealthThemeScript()}
  <script>
    async function shareCurrentPage() {
      var shareUrl = ${JSON.stringify(shareFileUrl)};
      var shareName = ${JSON.stringify(shareFileName)};
      try {
        if (shareUrl) {
          var response = await fetch(shareUrl, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('Failed to fetch file');
          var blob = await response.blob();
          var fileType = blob.type || 'application/octet-stream';
          var sharedFile = new File([blob], shareName || document.title, { type: fileType });
          if (navigator.canShare && navigator.canShare({ files: [sharedFile] }) && navigator.share) {
            await navigator.share({ title: document.title, files: [sharedFile] });
            return;
          }
          var downloadUrl = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = downloadUrl;
          link.download = shareName || document.title;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function() { URL.revokeObjectURL(downloadUrl); }, 1000);
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
      alert('Unable to share the file directly on this device.');
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
  renderPersonImagingStudyPage,
  renderPersonHealthFileViewerPage,
};

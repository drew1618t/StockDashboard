const express = require('express');
const path = require('path');

const {
  renderFamilyHealthChooserPage,
  renderFamilyHubPage,
  renderFamilySectionPage,
  renderPersonHealthFileViewerPage,
  renderPersonHealthPage,
  renderPersonHealthSectionPage,
  renderPersonImagingStudyPage,
} = require('../../familyPages');
const {
  findReportFile,
  getImagingStudy,
  getPersonConfig,
  getPersonHealthData,
  resolveStudyFile,
} = require('../../healthData');
const {
  DEFAULT_UPLOAD_DIR: PIGEON_UPLOAD_DIR,
} = require('../../pigeonImport');
const { renderPigeonsPage } = require('../../pigeonPages');
const { isPathUnder } = require('../../utils/pathSafety');

function createFamilyPageRoutes(options = {}) {
  const uploadDir = options.pigeonUploadDir || PIGEON_UPLOAD_DIR;
  const router = express.Router();

  router.use('/pigeons/uploads', express.static(uploadDir, {
    maxAge: 0,
    etag: true,
  }));

  router.get('/', (req, res) => {
    res.type('html').send(renderFamilyHubPage(undefined, undefined, req.user));
  });

  router.get('/pigeons', (req, res) => {
    res.type('html').send(renderPigeonsPage(req.user));
  });

  router.get('/health', (req, res) => {
    res.type('html').send(renderFamilyHealthChooserPage());
  });

  router.get('/health/andrew', (req, res) => {
    res.type('html').send(renderPersonHealthPage(getPersonHealthData('andrew')));
  });

  router.get('/health/kaili', (req, res) => {
    res.type('html').send(renderPersonHealthPage(getPersonHealthData('kaili')));
  });

  router.get('/health/:personSlug/bloodwork', (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'bloodwork'));
  });

  router.get('/health/:personSlug/images', (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'images'));
  });

  router.get('/health/:personSlug/reports', (req, res) => {
    const data = getPersonHealthData(req.params.personSlug);
    if (!data) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Health Profile Not Found', 'That health profile does not exist.')
      );
    }
    return res.type('html').send(renderPersonHealthSectionPage(data, 'reports'));
  });

  router.get('/health/:personSlug/report/:fileName', (req, res) => {
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

    if (!isPathUnder(person.reportsDir, report.fullPath) || !path.extname(report.fullPath)) {
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

  router.get('/health/:personSlug/report/raw/:fileName', (req, res) => {
    const person = getPersonConfig(req.params.personSlug);
    const report = person ? findReportFile(person, req.params.fileName) : null;
    if (!person || !report) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Report Not Found', 'The requested report file was not found.')
      );
    }
    return res.sendFile(report.fullPath);
  });

  router.get('/health/:personSlug/images/:studySlug', (req, res) => {
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

  router.get('/health/:personSlug/images/:studySlug/asset/:assetPath(*)', (req, res) => {
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

  router.get('/health/:personSlug/images/:studySlug/document/raw/:docPath(*)', (req, res) => {
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

  router.get('/health/:personSlug/images/:studySlug/document/:docPath(*)', (req, res) => {
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

  router.get('/medical', (req, res) => {
    res.redirect('/family/health');
  });

  router.get('/todos', (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Shared ToDos',
        'Protected placeholder for shared task lists, routines, and household follow-up items.'
      )
    );
  });

  router.get('/cameras', (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Camera Monitor',
        'Protected placeholder for security camera dashboards, snapshots, and future live feeds.'
      )
    );
  });

  router.get('/*', (req, res) => {
    res.status(404).type('html').send(
      renderFamilySectionPage(
        'Family Page Not Found',
        'This protected family route does not exist yet. The authorization boundary is still being enforced correctly.'
      )
    );
  });

  return router;
}

module.exports = {
  createFamilyPageRoutes,
};

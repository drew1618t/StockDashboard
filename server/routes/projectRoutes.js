const express = require('express');
const path = require('path');

const {
  findAgentWorkReport,
  listAgentWorkReports,
} = require('../agentWorkReports');
const {
  renderAgentWorkArchivePage,
  renderAgentWorkReportViewerPage,
  renderProjectsPage,
  renderSecuritySystemPage,
} = require('../agentWorkPages');
const { requireRole } = require('../auth/authorize');
const { renderFamilySectionPage } = require('../familyPages');
const { isPathUnder } = require('../utils/pathSafety');

function createProjectRoutes(options = {}) {
  const router = express.Router();
  const requireFamily = options.requireFamily || requireRole('family');

  router.get('/projects', (req, res) => {
    res.type('html').send(renderProjectsPage());
  });

  router.get('/projects/security-system', (req, res) => {
    res.type('html').send(renderSecuritySystemPage());
  });

  router.get('/projects/mosquito-trap', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'project-assets', 'mosquito-trap.html'));
  });

  router.get('/projects/agent-work', requireFamily, (req, res) => {
    res.type('html').send(renderAgentWorkArchivePage(listAgentWorkReports(options)));
  });

  router.get('/projects/agent-work/view/:fileName', requireFamily, (req, res) => {
    const report = findAgentWorkReport(req.params.fileName, options);
    if (!report) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Report Not Found', 'The requested agent work report was not found.')
      );
    }
    res.type('html').send(renderAgentWorkReportViewerPage(report));
  });

  router.get('/projects/agent-work/report/:fileName', requireFamily, (req, res) => {
    const reportsDir = options.agentActivityReportsDir || process.env.AGENT_ACTIVITY_REPORTS_DIR || '/home/andrew/.openclaw/workspace/agent-activity/reports';
    const report = findAgentWorkReport(req.params.fileName, options);
    if (!report || !isPathUnder(reportsDir, report.fullPath)) {
      return res.status(404).type('html').send(
        renderFamilySectionPage('Report Not Found', 'The requested agent work report was not found.')
      );
    }
    return res.sendFile(report.fullPath);
  });

  // Family-only static pages copied onto the server (e.g. the WoW Forever leveling guide).
  // They live outside public/ so the open static handler never serves them.
  router.get('/projects/wow-forever', requireFamily, (req, res) => {
    const privatePagesDir = options.privatePagesDir || path.join(__dirname, '..', '..', 'data', 'private-pages');
    const filePath = path.join(privatePagesDir, 'wow-forever-leveling.html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(filePath, err => {
      if (err && !res.headersSent) {
        res.status(404).type('html').send(
          renderFamilySectionPage('Page Not Found', 'The WoW Forever guide has not been copied to this server.')
        );
      }
    });
  });

  return router;
}

function redirectLegacyFamilyProjectRoutes(req, res) {
  const suffix = req.originalUrl.slice('/family/projects'.length);
  res.redirect(302, `/projects${suffix}`);
}

module.exports = {
  createProjectRoutes,
  redirectLegacyFamilyProjectRoutes,
};

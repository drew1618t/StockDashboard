const fs = require('fs');
const path = require('path');

const DEFAULT_REPORTS_DIR = process.env.AGENT_ACTIVITY_REPORTS_DIR || '/home/andrew/.openclaw/workspace/agent-activity/reports';

const REPORT_PATTERN = /^(daily|weekly|monthly|yearly)-agent-work-log-(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?:-to-(\d{4})-(\d{2})-(\d{2}))?\.html$/;

function getReportsDir(options = {}) {
  return options.agentActivityReportsDir || process.env.AGENT_ACTIVITY_REPORTS_DIR || DEFAULT_REPORTS_DIR;
}

function listAgentWorkReports(options = {}) {
  const reportsDir = getReportsDir(options);
  let files = [];
  try {
    files = fs.readdirSync(reportsDir);
  } catch {
    return [];
  }

  return files
    .map(fileName => reportFromFileName(reportsDir, fileName))
    .filter(Boolean)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function findAgentWorkReport(fileName, options = {}) {
  const reportsDir = getReportsDir(options);
  const report = reportFromFileName(reportsDir, fileName);
  if (!report) return null;
  if (!fs.existsSync(report.fullPath)) return null;
  return report;
}

function reportFromFileName(reportsDir, fileName) {
  if (typeof fileName !== 'string') return null;
  const match = fileName.match(REPORT_PATTERN);
  if (!match) return null;
  const [, type, year, month, day, endYear, endMonth, endDay] = match;
  if (type === 'daily' && (!month || !day)) return null;
  if (type === 'weekly' && (!month || !day || !endYear || !endMonth || !endDay)) return null;
  if (type === 'monthly' && (!month || day)) return null;
  if (type === 'yearly' && (month || day)) return null;
  if (type !== 'weekly' && (endYear || endMonth || endDay)) return null;

  const label = type === 'daily'
    ? `${year}-${month}-${day}`
    : type === 'weekly'
      ? `${year}-${month}-${day} to ${endYear}-${endMonth}-${endDay}`
      : type === 'monthly'
        ? `${year}-${month}`
        : year;
  return {
    type,
    year,
    month,
    day,
    endYear,
    endMonth,
    endDay,
    label,
    fileName,
    fullPath: path.join(reportsDir, fileName),
    href: `/projects/agent-work/view/${encodeURIComponent(fileName)}`,
    rawHref: `/projects/agent-work/report/${encodeURIComponent(fileName)}`,
    sortKey: `${label}-${type}`,
  };
}

function groupReportsByYearMonth(reports) {
  const years = new Map();
  for (const report of reports) {
    const monthKey = report.month || 'year';
    if (!years.has(report.year)) years.set(report.year, new Map());
    const months = years.get(report.year);
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey).push(report);
  }
  return [...years.entries()].map(([year, months]) => ({
    year,
    months: [...months.entries()].map(([month, items]) => ({ month, reports: items })),
  }));
}

module.exports = {
  DEFAULT_REPORTS_DIR,
  findAgentWorkReport,
  groupReportsByYearMonth,
  listAgentWorkReports,
};

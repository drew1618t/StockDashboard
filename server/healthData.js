const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function resolveHealthPaths(rootDir, defaults = {}) {
  return {
    rootDir,
    reportsDir: defaults.reportsDir || path.join(rootDir, 'Reports'),
    dbPath: defaults.dbPath || path.join(rootDir, 'health.db'),
    imagingDir: defaults.imagingDir || path.join(rootDir, 'Ingested', 'Imaging'),
  };
}

const DEFAULT_ANDREW_ROOT = 'C:\\Users\\Andrew\\OneDrive\\Documents\\Health';
const DEFAULT_KAILI_ROOT = 'C:\\Users\\Andrew\\OneDrive\\Documents\\Kaili Health';
const PYTHON_BIN = process.env.HEALTH_PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3');

const PERSON_CONFIG = {
  andrew: {
    slug: 'andrew',
    name: 'Andrew',
    ...resolveHealthPaths(
      process.env.HEALTH_ANDREW_ROOT || DEFAULT_ANDREW_ROOT,
      {
        reportsDir: process.env.HEALTH_ANDREW_REPORTS_DIR,
        dbPath: process.env.HEALTH_ANDREW_DB_PATH,
        imagingDir: process.env.HEALTH_ANDREW_IMAGING_DIR,
      }
    ),
  },
  kaili: {
    slug: 'kaili',
    name: 'Kaili',
    ...resolveHealthPaths(
      process.env.HEALTH_KAILI_ROOT || DEFAULT_KAILI_ROOT,
      {
        reportsDir: process.env.HEALTH_KAILI_REPORTS_DIR || path.join(process.env.HEALTH_KAILI_ROOT || DEFAULT_KAILI_ROOT, 'reports'),
        dbPath: process.env.HEALTH_KAILI_DB_PATH,
        imagingDir: process.env.HEALTH_KAILI_IMAGING_DIR || path.join(process.env.HEALTH_KAILI_ROOT || DEFAULT_KAILI_ROOT, 'ingested', 'Imaging'),
      }
    ),
  },
};

function getPersonConfig(slug) {
  if (!slug) return null;
  return PERSON_CONFIG[String(slug).toLowerCase()] || null;
}

function runSqliteQuery(dbPath, sql, params = []) {
  const script = [
    'import json, sqlite3, sys',
    'db_path, sql, params_json = sys.argv[1], sys.argv[2], sys.argv[3]',
    'conn = sqlite3.connect(db_path)',
    'conn.row_factory = sqlite3.Row',
    'params = json.loads(params_json)',
    'rows = [dict(row) for row in conn.execute(sql, params).fetchall()]',
    'print(json.dumps(rows, ensure_ascii=True))',
  ].join('\n');

  const output = execFileSync(PYTHON_BIN, ['-c', script, dbPath, sql, JSON.stringify(params)], {
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function safeQuery(dbPath, sql, params = [], fallback = []) {
  try {
    return runSqliteQuery(dbPath, sql, params);
  } catch (err) {
    return fallback;
  }
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBloodworkReport(reportPath) {
  if (!exists(reportPath)) return null;

  const html = fs.readFileSync(reportPath, 'utf8');
  const stats = {};
  const statRegex = /<div class="stat-label">([^<]+)<\/div><div class="stat-value">([^<]+)<\/div>/g;
  let match = statRegex.exec(html);
  while (match) {
    stats[stripTags(match[1])] = stripTags(match[2]);
    match = statRegex.exec(html);
  }

  const flags = [];
  const flagBlock = html.match(/<section class=['"]flag-box['"][\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
  if (flagBlock) {
    const flagRegex = /<li>([\s\S]*?)<\/li>/g;
    let item = flagRegex.exec(flagBlock[1]);
    while (item) {
      flags.push(stripTags(item[1]));
      item = flagRegex.exec(flagBlock[1]);
    }
  }

  return {
    path: reportPath,
    fileName: path.basename(reportPath),
    stats,
    flags,
  };
}

function parseDate(dateText) {
  if (!dateText) return null;
  const normalized = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function formatDate(dateText) {
  const date = parseDate(dateText);
  if (!date) return 'Unknown';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addYears(dateText, years) {
  const date = parseDate(dateText);
  if (!date) return null;
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return isoDate(next);
}

function buildVaccineReminders(immunizations) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const fluCutoff = `${currentYear - 1}-09-01`;
  const reminders = [];

  const fluShot = immunizations.find(item =>
    /flu|influenza|flucelvax/i.test(String(item.title || ''))
  );
  const tetanusShot = immunizations.find(item =>
    /tdap|tetanus|^td\b/i.test(String(item.title || ''))
  );

  reminders.push({
    label: 'Seasonal flu shot',
    dueDate: `${currentYear}-09-01`,
    status: fluShot && String(fluShot.date_of_service || '') >= fluCutoff ? 'planned next season' : 'due this year',
    note: fluShot ? `Last recorded: ${formatDate(fluShot.date_of_service)}.` : 'No recent flu vaccine found in the record.',
  });

  if (tetanusShot && tetanusShot.date_of_service) {
    const dueDate = addYears(tetanusShot.date_of_service, 10);
    reminders.push({
      label: 'Td / Tdap booster',
      dueDate,
      status: dueDate && dueDate < isoDate(now) ? 'overdue' : 'upcoming',
      note: `Last recorded: ${formatDate(tetanusShot.date_of_service)}.`,
    });
  }

  return reminders;
}

function buildConcernReminders(concerns) {
  return concerns.slice(0, 3).map(item => ({
    label: item.title,
    dueDate: item.date_of_service || null,
    status: 'review soon',
    note: item.summary || 'Recent item flagged in the record.',
  }));
}

function isBenignOrNoFollowup(item) {
  const haystack = `${item.title || ''} ${item.summary || ''}`.toUpperCase();
  const blockedPhrases = [
    'NO FOLLOW-UP REQUIRED',
    'NO FOLLOW UP REQUIRED',
    'BENIGN INCIDENTAL',
    'NO ACUTE FINDINGS',
    'WITHOUT ACUTE FINDINGS',
    'NO SIGNIFICANT ABNORMALITY',
    'NORMAL STUDY',
    'BOSNIAK I',
  ];
  return blockedPhrases.some(phrase => haystack.includes(phrase));
}

function isLowSignalConcern(item) {
  const haystack = `${item.title || ''} ${item.summary || ''}`.toUpperCase();
  const lowSignalPhrases = [
    'ALL NORMAL',
    'NO ACUTE FINDINGS',
    'NORMAL.',
    'NORMAL ',
    'IMPROVED FROM',
    'RECOVERED FROM',
  ];
  return lowSignalPhrases.some(phrase => haystack.includes(phrase));
}

function scoreConcern(item) {
  const haystack = `${item.title || ''} ${item.summary || ''}`.toUpperCase();
  let score = 0;

  if (item.category === 'diagnosis') score += 100;
  if (item.category === 'imaging_report' || item.category === 'imaging_finding') score += 80;
  if (item.category === 'lab_result') score += 30;

  if (haystack.includes('HOSPITAL')) score += 120;
  if (haystack.includes('ADENOMYOSIS')) score += 110;
  if (haystack.includes('ENLARGED')) score += 90;
  if (haystack.includes('INCREASED FROM')) score += 90;
  if (haystack.includes('DOUBLED')) score += 90;
  if (haystack.includes('INTENSE COLIC')) score += 80;
  if (haystack.includes('SEVERE')) score += 70;
  if (haystack.includes('FOLLOW-UP') || haystack.includes('FOLLOW UP')) score += 60;
  if (haystack.includes('RECOMMEND')) score += 60;
  if (haystack.includes('HIGH') || haystack.includes('LOW') || haystack.includes('ABNORMAL')) score += 25;

  return score;
}

function listReportFiles(reportsDir) {
  if (!exists(reportsDir)) return [];
  const files = fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const fullPath = path.join(reportsDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        fullPath,
        ext: path.extname(entry.name).toLowerCase(),
        modifiedAt: stat.mtime.toISOString(),
      };
    });

  return preferPdfVariants(files).sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
}

function listFilesRecursive(rootDir, allowedExts) {
  if (!exists(rootDir)) return [];
  const results = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExts.includes(ext)) return;
      results.push(fullPath);
    });
  }

  return results.sort();
}

function relativePath(rootDir, fullPath) {
  return path.relative(rootDir, fullPath).replace(/\\/g, '/');
}

function buildImagingStudies(person) {
  if (!exists(person.imagingDir)) return [];

  return fs
    .readdirSync(person.imagingDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const studyPath = path.join(person.imagingDir, entry.name);
      const renderedDir = path.join(studyPath, 'rendered_png');
      const imagePaths = exists(renderedDir)
        ? listFilesRecursive(renderedDir, ['.png', '.jpg', '.jpeg', '.webp', '.gif'])
        : listFilesRecursive(studyPath, ['.png', '.jpg', '.jpeg', '.webp', '.gif']);
      const documentPaths = listFilesRecursive(studyPath, ['.pdf', '.docx', '.md', '.txt', '.html']);
      const dateMatch = entry.name.match(/^(\d{4}-\d{2}-\d{2})_/);
      const studyTitle = entry.name.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/_/g, ' ');

      const documents = preferPdfVariants(
        documentPaths.map(filePath => ({
          fileName: path.basename(filePath),
          fullPath: filePath,
          relativePath: relativePath(studyPath, filePath),
          ext: path.extname(filePath).toLowerCase(),
        }))
      );
      const reportEntry = documents.find(file => /\.pdf$|\.docx$|\.md$|\.html$/i.test(file.fullPath));

      return {
        slug: slugify(entry.name),
        folderName: entry.name,
        title: studyTitle || entry.name,
        date: dateMatch ? dateMatch[1] : null,
        fullPath: studyPath,
        imageCount: imagePaths.length,
        images: imagePaths.map(filePath => ({
          fileName: path.basename(filePath),
          fullPath: filePath,
          relativePath: relativePath(studyPath, filePath),
        })),
        documents,
        primaryDocument: reportEntry
          ? {
              fileName: reportEntry.fileName,
              fullPath: reportEntry.fullPath,
              relativePath: reportEntry.relativePath,
              ext: reportEntry.ext,
            }
          : null,
      };
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function findReportFile(person, fileName) {
  const files = listReportFiles(person.reportsDir);
  const direct = files.find(file => file.fileName === fileName);
  if (direct) return direct;
  const parsed = path.parse(fileName);
  const siblingPdf = files.find(file => path.parse(file.fileName).name === parsed.name && file.ext === '.pdf');
  return siblingPdf || null;
}

function getImagingStudy(person, studySlug) {
  return buildImagingStudies(person).find(study => study.slug === slugify(studySlug)) || null;
}

function resolveStudyFile(study, relativeFilePath) {
  const normalized = String(relativeFilePath || '').replace(/\\/g, '/');
  const allFiles = study.images.concat(study.documents);
  const direct = allFiles.find(file => file.relativePath === normalized);
  if (direct) return direct;
  const parsed = path.parse(normalized);
  return allFiles.find(file => path.parse(file.relativePath).name === parsed.name && path.extname(file.relativePath).toLowerCase() === '.pdf') || null;
}

function preferPdfVariants(files) {
  const byBase = new Map();
  files.forEach(file => {
    const base = path.parse(file.fileName).name.toLowerCase();
    const existing = byBase.get(base);
    if (!existing) {
      byBase.set(base, file);
      return;
    }
    if (existing.ext !== '.pdf' && file.ext === '.pdf') {
      byBase.set(base, file);
    }
  });
  return Array.from(byBase.values());
}

function getPersonHealthData(slug) {
  const person = getPersonConfig(slug);
  if (!person) return null;

  const bloodworkReportPath = path.join(person.reportsDir, 'bloodwork_report.html');
  const bloodworkReport = parseBloodworkReport(bloodworkReportPath);
  const reportFiles = listReportFiles(person.reportsDir);
  const imagingStudies = buildImagingStudies(person);

  const latestLabs = safeQuery(
    person.dbPath,
    `SELECT date_of_service, COUNT(*) AS count
     FROM entries
     WHERE category = 'lab_result' AND date_of_service IS NOT NULL
     GROUP BY date_of_service
     ORDER BY date_of_service DESC
     LIMIT 1`
  )[0] || null;

  const latestImaging = safeQuery(
    person.dbPath,
    `SELECT title, date_of_service, summary, category
     FROM entries
     WHERE category IN ('imaging_report', 'imaging_finding')
     ORDER BY COALESCE(date_of_service, '') DESC, id DESC
     LIMIT 6`
  );

  const immunizations = safeQuery(
    person.dbPath,
    `SELECT title, date_of_service, summary
     FROM entries
     WHERE category = 'immunization'
     ORDER BY COALESCE(date_of_service, '') DESC, id DESC
     LIMIT 12`
  );

  const concerns = safeQuery(
    person.dbPath,
    `SELECT title, date_of_service, summary
            , category
     FROM entries
     WHERE
       (category = 'lab_result' AND (
         UPPER(COALESCE(summary, '')) LIKE '%HIGH%' OR
         UPPER(COALESCE(summary, '')) LIKE '%LOW%' OR
         UPPER(COALESCE(summary, '')) LIKE '%ABNORMAL%' OR
         UPPER(COALESCE(summary, '')) LIKE '%TOXIC%'
       ))
       OR
       (category IN ('imaging_report', 'imaging_finding') AND (
         UPPER(COALESCE(summary, '')) LIKE '%OMITTED%' OR
         UPPER(COALESCE(summary, '')) LIKE '%CONTRADICT%' OR
         UPPER(COALESCE(summary, '')) LIKE '%FOLLOW%' OR
         UPPER(COALESCE(summary, '')) LIKE '%INCREASED FROM%' OR
         UPPER(COALESCE(summary, '')) LIKE '%ENLARGED%' OR
         UPPER(COALESCE(summary, '')) LIKE '%INTENSE COLIC%' OR
         UPPER(COALESCE(summary, '')) LIKE '%ADENOMYOSIS%'
       ))
       OR
       (category = 'diagnosis' AND (
         UPPER(COALESCE(summary, '')) LIKE '%ADENOMYOSIS%' OR
         UPPER(COALESCE(summary, '')) LIKE '%ENLARG%' OR
         UPPER(COALESCE(summary, '')) LIKE '%HOSPITAL%'
       ))
     ORDER BY COALESCE(date_of_service, '') DESC, id DESC
     LIMIT 20`
  )
    .filter(item => !isBenignOrNoFollowup(item))
    .filter(item => !isLowSignalConcern(item))
    .sort((a, b) => {
      const scoreDiff = scoreConcern(b) - scoreConcern(a);
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.date_of_service || '').localeCompare(String(a.date_of_service || ''));
    })
    .slice(0, 8);

  const vaccines = buildVaccineReminders(immunizations);
  const annualBloodworkDue = latestLabs && latestLabs.date_of_service
    ? {
        label: 'Annual bloodwork',
        dueDate: addYears(latestLabs.date_of_service, 1),
        status: 'planned',
        note: `Last draw recorded on ${formatDate(latestLabs.date_of_service)}.`,
      }
    : null;

  const reminders = []
    .concat(annualBloodworkDue ? [annualBloodworkDue] : [])
    .concat(vaccines)
    .concat(buildConcernReminders(concerns));

  return {
    person,
    bloodworkReport,
    latestLabs,
    latestImaging,
    immunizations,
    concerns,
    reminders,
    reportFiles,
    imagingStudies,
  };
}

module.exports = {
  getPersonConfig,
  getPersonHealthData,
  formatDate,
  findReportFile,
  getImagingStudy,
  resolveStudyFile,
};

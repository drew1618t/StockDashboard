const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'default.json');
const LOCAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'local.json');

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const value = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (err) {
    throw new Error(`Cannot read investing config ${filePath}: ${err.message}`);
  }
}

function resolveFromProject(configuredPath) {
  if (!configuredPath) return null;
  return path.isAbsolute(configuredPath)
    ? path.normalize(configuredPath)
    : path.resolve(PROJECT_ROOT, configuredPath);
}

function loadInvestingConfig(env = process.env) {
  const defaults = readJson(DEFAULT_CONFIG_PATH);
  const local = readJson(env.INVESTING_CONFIG_PATH || LOCAL_CONFIG_PATH);
  const config = { ...defaults, ...local };

  const saulRoot = resolveFromProject(config.saul_investing_root || '../SaulInvesting');
  const reportsDir = env.DATA_DIR
    ? resolveFromProject(env.DATA_DIR)
    : resolveFromProject(config.saul_reports_dir) || path.join(saulRoot, 'reports');

  return {
    projectRoot: PROJECT_ROOT,
    saulInvestingRoot: saulRoot,
    reportsDir,
    sheetsCsvUrl: env.SHEETS_CSV_URL || config.sheets_csv_url || null,
    liveSnapshotPath: resolveFromProject(
      env.LIVE_PORTFOLIO_SNAPSHOT_PATH
        || config.live_portfolio_snapshot_path
        || 'data/live-portfolio-snapshot.json'
    ),
    pollIntervalMs: Number.parseInt(env.SHEETS_POLL_INTERVAL_MS, 10)
      || Number.parseInt(config.sheets_poll_interval_ms, 10)
      || (60 * 60 * 1000),
  };
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  PROJECT_ROOT,
  loadInvestingConfig,
  resolveFromProject,
};

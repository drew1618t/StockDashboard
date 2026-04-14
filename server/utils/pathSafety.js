const path = require('path');

function normalizeBase(basePath) {
  const resolved = path.resolve(basePath);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
}

function safeResolveUnder(basePath, relativePath) {
  if (!basePath || !relativePath) return null;
  const resolvedBase = normalizeBase(basePath);
  const fullPath = path.resolve(basePath, relativePath);
  if (fullPath === path.resolve(basePath) || fullPath.startsWith(resolvedBase)) {
    return fullPath;
  }
  return null;
}

function isPathUnder(basePath, candidatePath) {
  if (!basePath || !candidatePath) return false;
  const resolvedBase = normalizeBase(basePath);
  const fullPath = path.resolve(candidatePath);
  return fullPath === path.resolve(basePath) || fullPath.startsWith(resolvedBase);
}

module.exports = {
  isPathUnder,
  safeResolveUnder,
};

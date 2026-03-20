function parseCsvList(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeDomain(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.replace(/^https?:\/\//i, '').toLowerCase();
}

function getAccessConfig(env = process.env) {
  return {
    audience: String(env.CLOUDFLARE_ACCESS_AUD || '').trim(),
    teamDomain: normalizeDomain(env.CLOUDFLARE_TEAM_DOMAIN),
    familyEmails: parseCsvList(env.FAMILY_EMAILS),
    generalEmails: parseCsvList(env.ALLOW_GENERAL_EMAILS),
    generalDomains: parseCsvList(env.ALLOW_GENERAL_DOMAINS),
    devAccessEmail: String(env.DEV_ACCESS_EMAIL || '').trim().toLowerCase(),
    nodeEnv: String(env.NODE_ENV || '').trim().toLowerCase(),
  };
}

function hasGeneralAccessConfig(config) {
  return config.generalEmails.size > 0 || config.generalDomains.size > 0;
}

function getRoleForEmail(email, config) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  if (config.familyEmails.has(normalizedEmail)) return 'family';
  if (config.generalEmails.has(normalizedEmail)) return 'general';

  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex === -1) return null;

  const domain = normalizedEmail.slice(atIndex + 1);
  if (config.generalDomains.has(domain)) return 'general';
  return null;
}

function validateConfig(config) {
  const problems = [];
  const isDevOverride = config.nodeEnv !== 'production' && !!config.devAccessEmail;

  if (!config.audience && !isDevOverride) problems.push('CLOUDFLARE_ACCESS_AUD is required');
  if (!config.teamDomain && !isDevOverride) problems.push('CLOUDFLARE_TEAM_DOMAIN is required');
  if (config.familyEmails.size === 0) problems.push('FAMILY_EMAILS must contain at least one email');
  if (!hasGeneralAccessConfig(config)) {
    problems.push('ALLOW_GENERAL_EMAILS or ALLOW_GENERAL_DOMAINS must be configured');
  }
  return problems;
}

module.exports = {
  getAccessConfig,
  getRoleForEmail,
  hasGeneralAccessConfig,
  parseCsvList,
  validateConfig,
};

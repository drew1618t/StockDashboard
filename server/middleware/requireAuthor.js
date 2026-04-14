const DEFAULT_AUTHOR_EMAIL = 'drew1618t@gmail.com';

function createRequireAuthor(authorEmail = DEFAULT_AUTHOR_EMAIL) {
  const normalizedAuthorEmail = String(authorEmail || '').trim().toLowerCase();

  return function requireAuthor(req, res, next) {
    const email = String((req.user && req.user.email) || '').trim().toLowerCase();
    if (!email || email !== normalizedAuthorEmail) {
      return res.status(403).json({ error: 'Only the author can perform this action' });
    }
    next();
  };
}

module.exports = {
  DEFAULT_AUTHOR_EMAIL,
  createRequireAuthor,
};

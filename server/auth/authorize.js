function isHtmlRequest(req) {
  return req.accepts(['html', 'json']) === 'html';
}

function renderAuthErrorPage(statusCode, title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0a0e17;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(560px, calc(100vw - 32px));
      padding: 32px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #151d2e;
      border-radius: 8px;
    }
    h1 {
      margin: 0 0 12px;
      color: #ff6600;
      font-size: 20px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    p {
      margin: 0 0 16px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    a {
      color: #ff6600;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .status {
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <main>
    <div class="status">HTTP ${statusCode}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Return home</a>
  </main>
</body>
</html>`;
}

function sendUnauthorized(res, req, statusCode, message) {
  if (isHtmlRequest(req)) {
    const title = statusCode === 401 ? 'Authentication Required' : 'Access Restricted';
    return res
      .status(statusCode)
      .type('html')
      .send(renderAuthErrorPage(statusCode, title, message));
  }

  return res.status(statusCode).json({ error: message });
}

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  return sendUnauthorized(res, req, 401, 'A valid Cloudflare Access session is required.');
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res, req, 401, 'A valid Cloudflare Access session is required.');
    }
    if (req.user.role === role) {
      return next();
    }

    console.warn(
      `[auth] forbidden role=${req.user.role} email=${req.user.email} path=${req.originalUrl}`
    );
    return sendUnauthorized(
      res,
      req,
      403,
      'Your account is signed in, but this area is restricted to the family tier.'
    );
  };
}

function authErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.warn(`[auth] rejected path=${req.originalUrl} reason=${err.message}`);
  return sendUnauthorized(res, req, 401, 'Your Cloudflare Access session could not be verified.');
}

module.exports = {
  authErrorHandler,
  renderAuthErrorPage,
  requireAuth,
  requireRole,
};

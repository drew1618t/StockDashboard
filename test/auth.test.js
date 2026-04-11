const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { createAccessAuth } = require('../server/auth/accessAuth');
const { getAccessConfig, getRoleForEmail } = require('../server/auth/config');
const { requireRole } = require('../server/auth/authorize');

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createJwt(privateKey, payload, kid = 'test-key') {
  const header = {
    alg: 'RS256',
    kid,
    typ: 'JWT',
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
  const encodedSignature = signature
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${signingInput}.${encodedSignature}`;
}

test('family email resolves to family role', () => {
  const config = getAccessConfig({
    CLOUDFLARE_ACCESS_AUD: 'aud-1',
    CLOUDFLARE_TEAM_DOMAIN: 'example.cloudflareaccess.com',
    FAMILY_EMAILS: 'me@example.com, wife@example.com',
    ALLOW_GENERAL_DOMAINS: 'example.org',
  });

  assert.equal(getRoleForEmail('wife@example.com', config), 'family');
  assert.equal(getRoleForEmail('friend@example.org', config), 'general');
  assert.equal(getRoleForEmail('stranger@example.net', config), null);
});

test('access auth authenticates family and general roles', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const middleware = createAccessAuth({
    config: {
      audience: 'aud-test',
      teamDomain: 'example.cloudflareaccess.com',
      familyEmails: new Set(['me@example.com']),
      generalEmails: new Set(),
      generalDomains: new Set(['example.org']),
    },
    jwksCache: {
      async getKey() {
        return publicKey;
      },
    },
  });

  const now = Math.floor(Date.now() / 1000);
  const familyToken = createJwt(privateKey, {
    aud: 'aud-test',
    iss: 'https://example.cloudflareaccess.com',
    sub: 'me@example.com',
    email: 'me@example.com',
    exp: now + 60,
  });
  const generalToken = createJwt(privateKey, {
    aud: 'aud-test',
    iss: 'https://example.cloudflareaccess.com',
    sub: 'friend@example.org',
    email: 'friend@example.org',
    exp: now + 60,
  });

  const familyUser = await middleware.authenticateRequest({
    headers: {
      'cf-access-jwt-assertion': familyToken,
    },
  });
  const generalUser = await middleware.authenticateRequest({
    headers: {
      'cf-access-jwt-assertion': generalToken,
    },
  });

  assert.equal(familyUser.role, 'family');
  assert.equal(generalUser.role, 'general');
});

test('access auth rejects missing or invalid tokens', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrongKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const middleware = createAccessAuth({
    config: {
      audience: 'aud-test',
      teamDomain: 'example.cloudflareaccess.com',
      familyEmails: new Set(['me@example.com']),
      generalEmails: new Set(),
      generalDomains: new Set(['example.org']),
    },
    jwksCache: {
      async getKey() {
        return publicKey;
      },
    },
  });

  await assert.rejects(
    middleware.authenticateRequest({ headers: {} }),
    /Missing Cloudflare Access JWT/
  );

  const now = Math.floor(Date.now() / 1000);
  const wrongAudience = createJwt(privateKey, {
    aud: 'different-aud',
    iss: 'https://example.cloudflareaccess.com',
    sub: 'me@example.com',
    email: 'me@example.com',
    exp: now + 60,
  });
  await assert.rejects(
    middleware.authenticateRequest({
      headers: {
        'cf-access-jwt-assertion': wrongAudience,
      },
    }),
    /audience mismatch/
  );

  const invalidSignature = createJwt(wrongKeyPair.privateKey, {
    aud: 'aud-test',
    iss: 'https://example.cloudflareaccess.com',
    sub: 'me@example.com',
    email: 'me@example.com',
    exp: now + 60,
  });
  await assert.rejects(
    middleware.authenticateRequest({
      headers: {
        'cf-access-jwt-assertion': invalidSignature,
      },
    }),
    /signature/
  );
});

test('requireRole blocks non-family users with 403', () => {
  const middleware = requireRole('family');
  let statusCode = null;
  let body = null;

  middleware(
    {
      user: { email: 'friend@example.org', role: 'general' },
      originalUrl: '/family',
      accepts() {
        return 'json';
      },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
    () => {
      throw new Error('next should not be called');
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /family tier/);
});

test('family role can pass the pigeon API authorization boundary', () => {
  const middleware = requireRole('family');
  let nextCalled = false;

  middleware(
    {
      user: { email: 'me@example.com', role: 'family' },
      originalUrl: '/api/family/pigeons/summary',
      accepts() {
        return 'json';
      },
    },
    {},
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});

const crypto = require('crypto');
const https = require('https');

const { getAccessConfig, getRoleForEmail, validateConfig } = require('./config');

const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Buffer.from(padded, 'base64');
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
    payload = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  } catch (err) {
    throw new Error('Invalid JWT encoding');
  }

  return {
    header,
    payload,
    signature: decodeBase64Url(parts[2]),
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

class JwksCache {
  constructor(teamDomain) {
    this.teamDomain = teamDomain;
    this.keys = new Map();
    this.expiresAt = 0;
    this.pendingFetch = null;
  }

  async getKey(kid) {
    if (!kid) {
      throw new Error('JWT missing key id');
    }

    const now = Date.now();
    if (this.keys.has(kid) && now < this.expiresAt) {
      return this.keys.get(kid);
    }

    if (!this.pendingFetch) {
      this.pendingFetch = this.refresh().finally(() => {
        this.pendingFetch = null;
      });
    }

    await this.pendingFetch;
    const key = this.keys.get(kid);
    if (!key) {
      throw new Error(`Unknown JWT key id: ${kid}`);
    }
    return key;
  }

  async refresh() {
    const url = `https://${this.teamDomain}/cdn-cgi/access/certs`;
    const body = await fetchJson(url);
    const keys = Array.isArray(body.keys) ? body.keys : [];
    if (keys.length === 0) {
      throw new Error('Cloudflare cert endpoint returned no keys');
    }

    const nextKeys = new Map();
    keys.forEach(jwk => {
      if (jwk && jwk.kid && jwk.kty === 'RSA') {
        const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
        nextKeys.set(jwk.kid, publicKey);
      }
    });

    if (nextKeys.size === 0) {
      throw new Error('Cloudflare cert endpoint returned no RSA keys');
    }

    this.keys = nextKeys;
    this.expiresAt = Date.now() + JWKS_CACHE_TTL_MS;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Failed to fetch Cloudflare certs: ${res.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Cloudflare cert endpoint returned invalid JSON'));
          }
        });
      }
    );

    req.on('error', reject);
  });
}

function verifyAudience(payloadAud, expectedAudience) {
  if (Array.isArray(payloadAud)) {
    return payloadAud.includes(expectedAudience);
  }
  return payloadAud === expectedAudience;
}

function assertClaimChecks(payload, config) {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    throw new Error('JWT expired');
  }
  if (payload.nbf && now < payload.nbf) {
    throw new Error('JWT not active yet');
  }
  if (!verifyAudience(payload.aud, config.audience)) {
    throw new Error('JWT audience mismatch');
  }

  const expectedIssuer = `https://${config.teamDomain}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error('JWT issuer mismatch');
  }
}

function extractEmail(payload) {
  const email = payload.email || payload.sub || '';
  const normalized = String(email).trim().toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('JWT missing email claim');
  }
  return normalized;
}

function createAccessAuth(options = {}) {
  const config = {
    ...getAccessConfig(options.env),
    ...(options.config || {}),
  };

  const problems = validateConfig(config);
  if (problems.length > 0) {
    throw new Error(`Access auth misconfigured: ${problems.join('; ')}`);
  }

  const jwks = options.jwksCache || new JwksCache(config.teamDomain);

  async function authenticateRequest(req) {
    const canUseDevOverride = config.nodeEnv !== 'production' && config.devAccessEmail;
    if (canUseDevOverride) {
      const role = getRoleForEmail(config.devAccessEmail, config);
      if (!role) {
        throw new Error('DEV_ACCESS_EMAIL is not on an approved access list');
      }

      return {
        email: config.devAccessEmail,
        role,
        subject: config.devAccessEmail,
        issuer: 'dev-override',
      };
    }

    const token = req.headers[ACCESS_JWT_HEADER];
    if (!token) {
      throw new Error('Missing Cloudflare Access JWT');
    }

    const parsed = parseJwt(token);
    const publicKey = await jwks.getKey(parsed.header.kid);
    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(parsed.signingInput),
      publicKey,
      parsed.signature
    );

    if (!isValid) {
      throw new Error('Invalid Cloudflare Access JWT signature');
    }

    assertClaimChecks(parsed.payload, config);

    const email = extractEmail(parsed.payload);
    const role = getRoleForEmail(email, config);
    if (!role) {
      throw new Error('User is not on an approved access list');
    }

    return {
      email,
      role,
      subject: String(parsed.payload.sub || ''),
      issuer: String(parsed.payload.iss || ''),
    };
  }

  async function accessAuth(req, res, next) {
    try {
      req.user = await authenticateRequest(req);
      next();
    } catch (err) {
      next(err);
    }
  }

  accessAuth.authenticateRequest = authenticateRequest;
  accessAuth.config = config;
  return accessAuth;
}

module.exports = {
  ACCESS_JWT_HEADER,
  JwksCache,
  assertClaimChecks,
  createAccessAuth,
  extractEmail,
  parseJwt,
  verifyAudience,
};

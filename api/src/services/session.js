/**
 * Self-issued session tokens.
 *
 * Both login fronts (admin password, optional OIDC providers) mint the same
 * HS256 JWT signed with the per-deployment SESSION_SECRET; the API trusts
 * only this token. Provider tokens are used solely at the login moment.
 */
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);
const SESSION_TTL_HOURS = Number.parseInt(process.env.SESSION_TTL_HOURS || '12', 10);
const ISSUER = 'postline';

let cachedSecret = null;

function getSecret() {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) {
    cachedSecret = configured;
    return cachedSecret;
  }
  if (IS_PRODUCTION) {
    throw new Error('SESSION_SECRET must be set (at least 32 chars) in production');
  }
  // Dev convenience: ephemeral secret per process — sessions reset on restart.
  cachedSecret = randomBytes(32).toString('base64');
  return cachedSecret;
}

export function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      name: user.name || '',
      email: user.email || '',
    },
    getSecret(),
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      expiresIn: `${SESSION_TTL_HOURS}h`,
    }
  );
}

export function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, getSecret(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
    });
    return {
      userId: decoded.sub,
      email: decoded.email || '',
      name: decoded.name || '',
    };
  } catch {
    return null;
  }
}

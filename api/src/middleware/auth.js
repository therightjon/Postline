import { verifySessionToken } from '../services/session.js';

/**
 * Bearer-token validation for the self-issued session JWT.
 *
 * Both login fronts (admin password, optional OIDC) mint the same HS256
 * session token (services/session.js); this middleware is the only thing the
 * API trusts. Identity-provider tokens never reach protected routes.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);

// Strictly-gated local dev affordance: accept the client's dev-bypass token so
// the full stack runs locally with zero auth config. Can NEVER fire in
// production (IS_PRODUCTION is always true on Azure via WEBSITE_SITE_NAME).
const ALLOW_DEV_AUTH = !IS_PRODUCTION && process.env.ALLOW_DEV_AUTH === 'true';
const DEV_AUTH_TOKEN = process.env.DEV_AUTH_TOKEN || 'dev-token';

// Fail fast on misconfiguration: a production deployment must have a real
// session secret and at least one way to sign in.
if (IS_PRODUCTION) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be set (at least 32 chars) in production');
  }
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD must be set in production (node scripts/hash-password.mjs)');
  }
}

/**
 * Validates a bearer token and returns the user info, or null.
 */
export async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) return null;

  if (ALLOW_DEV_AUTH && token === DEV_AUTH_TOKEN) {
    return { userId: 'dev-user-001', email: 'dev@postline.app', name: 'Dev User' };
  }

  return verifySessionToken(token);
}

/**
 * Middleware helper — returns 401 if not authenticated.
 */
export async function requireAuth(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return {
      status: 401,
      jsonBody: { error: 'Unauthorized. Please sign in.' },
    };
  }
  return user;
}

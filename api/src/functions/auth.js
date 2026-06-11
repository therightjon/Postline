import { app } from '@azure/functions';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { hashPassword, verifyPassword } from '../services/password.js';
import { createSessionToken } from '../services/session.js';
import { checkLoginAllowed, getClientKey, recordLoginFailure, recordLoginSuccess } from '../services/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { createItem, queryItems, deleteItem } from '../services/cosmos.js';
import { enabledLoginProviders, getLoginProvider, buildLoginAuthorizeUrl, exchangeLoginCode } from '../services/loginProviders.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);
// Prefer a pre-computed hash. ADMIN_PASSWORD (plaintext) is accepted as a
// fallback so template-based deploys (ARM can't run scrypt) work one-click —
// it is hashed in memory at startup and compared exactly like the hash path.
// Docs recommend switching to ADMIN_PASSWORD_HASH after first deploy.
const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  (process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : '');
const ALLOW_DEV_AUTH = !IS_PRODUCTION && process.env.ALLOW_DEV_AUTH === 'true';

const OAUTH_STATE_CONTAINER = 'oauthStates';
const LOGIN_STATE_TTL_MS = Number.parseInt(process.env.OAUTH_STATE_TTL_MS || '600000', 10);
const LOGIN_GRANT_TTL_MS = 60_000; // one-time grant: 60s to redeem

// Single-user instance: every successful sign-in (password or OIDC) maps to
// the one canonical owner id so all data partitions stay shared.
const OWNER_USER_ID = 'owner';

// Sign-in allowlist for OIDC: explicit ALLOWED_EMAILS wins; otherwise the
// first email to sign in claims the instance and becomes the only one allowed.
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const APP_BASE_URL = normalizeBaseUrl(process.env.APP_BASE_URL || 'http://localhost:5173');
const API_BASE_URL = normalizeBaseUrl(process.env.API_BASE_URL || 'http://localhost:7071');

function normalizeBaseUrl(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

function loginRedirect(query) {
  const url = new URL('/login', APP_BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return { status: 302, headers: { Location: url.toString() } };
}

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = toBase64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function getStateRecord(id, kind) {
  const matches = await queryItems(
    OAUTH_STATE_CONTAINER,
    'SELECT TOP 1 * FROM c WHERE c.id = @id AND c.kind = @kind',
    [
      { name: '@id', value: id },
      { name: '@kind', value: kind },
    ]
  );
  return matches[0] || null;
}

async function consumeStateRecord(id) {
  try {
    await deleteItem(OAUTH_STATE_CONTAINER, id, id);
  } catch {
    // Cleanup failures must not block the flow.
  }
}

// First-user-claims persistence: a singleton record in the oauthStates
// container (no new infra needed; the record has no expiry and is never purged).
const OWNER_CLAIM_ID = 'owner-claim';

async function isEmailAllowed(email) {
  const normalized = email.trim().toLowerCase();
  if (ALLOWED_EMAILS.length > 0) {
    return ALLOWED_EMAILS.includes(normalized);
  }
  const claim = await getStateRecord(OWNER_CLAIM_ID, 'owner-claim');
  if (!claim) {
    await createItem(OAUTH_STATE_CONTAINER, { id: OWNER_CLAIM_ID, kind: 'owner-claim', email: normalized });
    return true;
  }
  return claim.email === normalized;
}

// Tells the login page which sign-in methods this deployment supports.
app.http('authProviders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/providers',
  handler: async () => ({
    jsonBody: {
      password: Boolean(ADMIN_PASSWORD_HASH),
      devBypass: ALLOW_DEV_AUTH,
      oidc: enabledLoginProviders(),
    },
  }),
});

app.http('authLogin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (request, context) => {
    if (!ADMIN_PASSWORD_HASH) {
      return {
        status: 503,
        jsonBody: { error: 'Password sign-in is not configured. Set ADMIN_PASSWORD_HASH on the server.' },
      };
    }

    const clientKey = getClientKey(request);
    const locked = checkLoginAllowed(clientKey);
    if (locked) {
      return {
        status: 429,
        headers: { 'Retry-After': String(locked.retryAfterSeconds) },
        jsonBody: { error: `Too many attempts. Try again in ${locked.retryAfterSeconds}s.` },
      };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid request body' } };
    }

    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !verifyPassword(password, ADMIN_PASSWORD_HASH)) {
      recordLoginFailure(clientKey);
      context.warn(`Failed login attempt from ${clientKey}`);
      // Identical response for empty/wrong password — no oracle.
      return { status: 401, jsonBody: { error: 'Incorrect password' } };
    }

    recordLoginSuccess(clientKey);
    const token = createSessionToken({ userId: OWNER_USER_ID, name: 'Owner', email: '' });
    return { jsonBody: { token, user: { name: 'Owner', email: '' } } };
  },
});

// Start an OIDC sign-in: create the state (+PKCE), 302 to the provider.
app.http('authOidcStart', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/login/{provider}',
  handler: async (request, context) => {
    const providerId = request.params.provider;
    if (!getLoginProvider(providerId)) {
      return { status: 404, jsonBody: { error: `Login provider not configured: ${providerId}` } };
    }

    const pkce = createPkcePair();
    const state = await createItem(OAUTH_STATE_CONTAINER, {
      id: randomUUID(),
      kind: 'login',
      provider: providerId,
      pkceVerifier: pkce.verifier,
      expiresAt: new Date(Date.now() + LOGIN_STATE_TTL_MS).toISOString(),
      // Cosmos per-item TTL — auto-purge when container TTL is enabled.
      ttl: Math.ceil(LOGIN_STATE_TTL_MS / 1000),
    });

    const authUrl = buildLoginAuthorizeUrl(providerId, {
      redirectUri: `${API_BASE_URL}/api/auth/callback/${providerId}`,
      state: state.id,
      codeChallenge: pkce.challenge,
    });

    return { status: 302, headers: { Location: authUrl } };
  },
});

// Provider redirect target: validate state, exchange the code server-side,
// resolve the identity, enforce the allowlist, then stage a one-time grant
// and bounce to the app (no tokens ever appear in a URL).
app.http('authOidcCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback/{provider}',
  handler: async (request, context) => {
    const providerId = request.params.provider;
    const code = request.query.get('code');
    const stateId = request.query.get('state');

    try {
      if (!getLoginProvider(providerId)) throw new Error('Provider not configured');
      if (!code || !stateId) throw new Error('Missing code or state');

      const state = await getStateRecord(stateId, 'login');
      if (!state) throw new Error('Invalid login state');
      await consumeStateRecord(stateId); // single-use, burn before exchange
      if (state.provider !== providerId) throw new Error('Login state does not match provider');
      if (new Date(state.expiresAt).getTime() < Date.now()) throw new Error('Login state expired');

      const identity = await exchangeLoginCode(providerId, {
        code,
        redirectUri: `${API_BASE_URL}/api/auth/callback/${providerId}`,
        pkceVerifier: state.pkceVerifier,
      });

      if (!(await isEmailAllowed(identity.email))) {
        context.warn(`OIDC sign-in rejected for non-allowlisted email via ${providerId}`);
        return loginRedirect({ error: 'not_allowed' });
      }

      const grant = await createItem(OAUTH_STATE_CONTAINER, {
        id: randomUUID(),
        kind: 'login-grant',
        email: identity.email.trim().toLowerCase(),
        name: identity.name || '',
        expiresAt: new Date(Date.now() + LOGIN_GRANT_TTL_MS).toISOString(),
        ttl: Math.ceil(LOGIN_GRANT_TTL_MS / 1000),
      });

      return loginRedirect({ grant: grant.id });
    } catch (err) {
      context.error(`OIDC login callback error for ${providerId}:`, err.message);
      return loginRedirect({ error: 'login_failed' });
    }
  },
});

// Redeem a one-time login grant for a session token.
app.http('authRedeem', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/redeem',
  handler: async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid request body' } };
    }

    const grantId = typeof body?.grantId === 'string' ? body.grantId : '';
    if (!grantId) {
      return { status: 400, jsonBody: { error: 'grantId is required' } };
    }

    const grant = await getStateRecord(grantId, 'login-grant');
    if (!grant) {
      return { status: 400, jsonBody: { error: 'Invalid or expired sign-in. Please try again.' } };
    }
    await consumeStateRecord(grantId); // single-use
    if (new Date(grant.expiresAt).getTime() < Date.now()) {
      return { status: 400, jsonBody: { error: 'Sign-in expired. Please try again.' } };
    }

    const user = { userId: OWNER_USER_ID, name: grant.name || 'Owner', email: grant.email || '' };
    const token = createSessionToken(user);
    return { jsonBody: { token, user: { name: user.name, email: user.email } } };
  },
});

app.http('authMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: async (request) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;
    return { jsonBody: { user: { name: auth.name, email: auth.email } } };
  },
});

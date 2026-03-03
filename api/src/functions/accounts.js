import { app } from '@azure/functions';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { createItem, queryItems, deleteItem } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';

const CONTAINER = 'socialAccounts';
const OAUTH_STATE_CONTAINER = 'oauthStates';
const OAUTH_STATE_TTL_MS = Number.parseInt(process.env.OAUTH_STATE_TTL_MS || '600000', 10);
const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin'];
const APP_BASE_URL_RAW = process.env.APP_BASE_URL;
const API_BASE_URL_RAW = process.env.API_BASE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);

if (IS_PRODUCTION && (!APP_BASE_URL_RAW || !API_BASE_URL_RAW)) {
  throw new Error('APP_BASE_URL and API_BASE_URL must be set in production');
}

const APP_BASE_URL = normalizeBaseUrl(APP_BASE_URL_RAW || 'http://localhost:5173', 'APP_BASE_URL');
const API_BASE_URL = normalizeBaseUrl(API_BASE_URL_RAW || 'http://localhost:7071', 'API_BASE_URL');

function normalizeBaseUrl(value, settingName) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    throw new Error(`${settingName} must be a valid absolute URL: "${value}"`);
  }
}

function getCallbackUrl(platform) {
  return `${API_BASE_URL}/api/accounts/callback/${platform}`;
}

function buildUrl(base, query) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function getAccountsRedirectUrl(query) {
  return buildUrl(new URL('/accounts', APP_BASE_URL).toString(), query);
}

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = toBase64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function createOAuthState({ userId, platform, pkceVerifier }) {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  return createItem(OAUTH_STATE_CONTAINER, {
    id: randomUUID(),
    userId,
    platform,
    pkceVerifier: pkceVerifier || null,
    expiresAt,
  });
}

async function getOAuthState(stateId) {
  const matches = await queryItems(
    OAUTH_STATE_CONTAINER,
    'SELECT TOP 1 * FROM c WHERE c.id = @stateId',
    [{ name: '@stateId', value: stateId }]
  );
  return matches[0] || null;
}

async function consumeOAuthState(stateId) {
  try {
    await deleteItem(OAUTH_STATE_CONTAINER, stateId, stateId);
  } catch {
    // Ignore state cleanup failures to avoid blocking callback completion.
  }
}

// List connected accounts
app.http('listAccounts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'accounts',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    const accounts = await queryItems(
      CONTAINER,
      'SELECT c.id, c.platform, c.platformName, c.platformUsername, c.connectedAt FROM c WHERE c.userId = @userId',
      [{ name: '@userId', value: auth.userId }]
    );

    return { jsonBody: accounts };
  },
});

// Initiate OAuth connection
app.http('connectAccount', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'accounts/connect/{platform}',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    const platform = request.params.platform;
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return { status: 400, jsonBody: { error: `Unsupported platform: ${platform}` } };
    }

    const oauthClientIds = {
      facebook: process.env.FACEBOOK_APP_ID,
      instagram: process.env.FACEBOOK_APP_ID,
      twitter: process.env.TWITTER_API_KEY,
      linkedin: process.env.LINKEDIN_CLIENT_ID,
    };

    if (!oauthClientIds[platform]) {
      return {
        status: 500,
        jsonBody: { error: `${platform} OAuth is not configured on the server` },
      };
    }

    const pkce = platform === 'twitter' ? createPkcePair() : null;
    const state = await createOAuthState({
      userId: auth.userId,
      platform,
      pkceVerifier: pkce?.verifier || null,
    });

    // Generate OAuth URLs per platform
    const oauthUrls = {
      facebook: buildUrl('https://www.facebook.com/v19.0/dialog/oauth', {
        client_id: oauthClientIds.facebook,
        redirect_uri: getCallbackUrl('facebook'),
        scope: 'pages_manage_posts,pages_read_engagement',
        state: state.id,
      }),
      instagram: buildUrl('https://www.facebook.com/v19.0/dialog/oauth', {
        client_id: oauthClientIds.instagram,
        redirect_uri: getCallbackUrl('instagram'),
        scope: 'instagram_basic,instagram_content_publish,pages_show_list',
        state: state.id,
      }),
      twitter: buildUrl('https://twitter.com/i/oauth2/authorize', {
        response_type: 'code',
        client_id: oauthClientIds.twitter,
        redirect_uri: getCallbackUrl('twitter'),
        scope: 'tweet.read tweet.write users.read offline.access',
        state: state.id,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
      }),
      linkedin: buildUrl('https://www.linkedin.com/oauth/v2/authorization', {
        response_type: 'code',
        client_id: oauthClientIds.linkedin,
        redirect_uri: getCallbackUrl('linkedin'),
        scope: 'w_member_social r_liteprofile',
        state: state.id,
      }),
    };

    return { jsonBody: { authUrl: oauthUrls[platform] } };
  },
});

// OAuth callback handler
app.http('accountCallback', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'accounts/callback/{platform}',
  handler: async (request, context) => {
    const platform = request.params.platform;
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return { status: 400, jsonBody: { error: `Unsupported platform: ${platform}` } };
    }

    const code = request.query.get('code');
    const stateId = request.query.get('state');

    if (!code || !stateId) {
      return { status: 400, jsonBody: { error: 'Missing code or state' } };
    }

    try {
      const oauthState = await getOAuthState(stateId);
      if (!oauthState) {
        throw new Error('Invalid OAuth state');
      }
      if (oauthState.platform !== platform) {
        await consumeOAuthState(stateId);
        throw new Error('OAuth state does not match platform');
      }
      if (new Date(oauthState.expiresAt).getTime() < Date.now()) {
        await consumeOAuthState(stateId);
        throw new Error('OAuth state expired');
      }

      await consumeOAuthState(stateId);

      // Exchange code for tokens (platform-specific)
      // In production, each platform has its own token exchange flow
      await createItem(CONTAINER, {
        id: randomUUID(),
        userId: oauthState.userId,
        platform,
        platformName: platform.charAt(0).toUpperCase() + platform.slice(1),
        platformUsername: 'connected_user',
        accessToken: code, // In production, exchange for real token
        refreshToken: null,
        tokenExpiresAt: null,
        connectedAt: new Date().toISOString(),
      });

      // Redirect back to the app
      return {
        status: 302,
        headers: { Location: getAccountsRedirectUrl({ connected: platform }) },
      };
    } catch (err) {
      context.error(`OAuth callback error for ${platform}:`, err.message);
      return {
        status: 302,
        headers: { Location: getAccountsRedirectUrl({ error: err.message }) },
      };
    }
  },
});

// Disconnect account
app.http('disconnectAccount', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'accounts/{id}',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    await deleteItem(CONTAINER, request.params.id, auth.userId);
    return { status: 204 };
  },
});

/**
 * Per-platform OAuth authorization-code → token exchange and refresh.
 *
 * Called by the authenticated /api/accounts/finalize endpoint after the
 * provider redirect has been validated and bound to the signed-in user.
 * Each exchange returns the tokens plus the platform identifier the matching
 * publisher needs (Facebook pageId, Instagram instagramUserId, LinkedIn
 * linkedinUrn).
 *
 * These flows are correct against the documented provider endpoints but can
 * only run once you create the developer apps and set the *_SECRET app
 * settings. Scopes requested at connect time (accounts.js) must match the
 * products enabled on each app.
 */

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v19.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function readJsonOrThrow(response, label) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === 'string' ? data.error : null) ||
      data?.detail ||
      `${label} failed (${response.status})`;
    throw new Error(typeof message === 'string' ? message : `${label} failed (${response.status})`);
  }
  return data;
}

function expiryFrom(expiresInSeconds) {
  const seconds = Number(expiresInSeconds);
  if (!seconds || Number.isNaN(seconds)) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

// --- X (Twitter) — OAuth2 Authorization Code with PKCE (confidential client) ---

async function exchangeTwitter({ code, pkceVerifier, redirectUri }) {
  const clientId = requireEnv('TWITTER_API_KEY');
  const clientSecret = requireEnv('TWITTER_API_SECRET');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceVerifier || '',
      client_id: clientId,
    }),
  });
  const tokens = await readJsonOrThrow(res, 'Twitter token exchange');

  let platformUsername = 'connected_user';
  try {
    const meRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await readJsonOrThrow(meRes, 'Twitter user lookup');
    if (me?.data?.username) platformUsername = `@${me.data.username}`;
  } catch {
    // Username is cosmetic — don't fail the connection over it.
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    tokenExpiresAt: expiryFrom(tokens.expires_in),
    platformUsername,
  };
}

// --- LinkedIn — OAuth2; member id via OIDC userinfo (needs openid/profile) ---

async function exchangeLinkedIn({ code, redirectUri }) {
  const clientId = requireEnv('LINKEDIN_CLIENT_ID');
  const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET');

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokens = await readJsonOrThrow(res, 'LinkedIn token exchange');

  const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = await readJsonOrThrow(meRes, 'LinkedIn profile lookup');
  if (!me?.sub) {
    throw new Error('Could not resolve LinkedIn member id (the app needs the openid + profile scopes)');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    tokenExpiresAt: expiryFrom(tokens.expires_in),
    platformUsername: me.name || 'connected_user',
    linkedinUrn: `urn:li:person:${me.sub}`,
  };
}

// --- Meta (Facebook + Instagram) — shared user-token exchange + Page lookup ---

async function exchangeMetaUserToken({ code, redirectUri }) {
  const clientId = requireEnv('FACEBOOK_APP_ID');
  const clientSecret = requireEnv('FACEBOOK_APP_SECRET');

  const shortRes = await fetch(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        client_secret: clientSecret,
        code,
      })
  );
  const short = await readJsonOrThrow(shortRes, 'Facebook token exchange');

  // Trade the short-lived token for a long-lived (~60 day) one.
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: short.access_token,
      })
  );
  const long = await readJsonOrThrow(longRes, 'Facebook long-lived token exchange');
  return long.access_token;
}

async function getFirstPage(userToken) {
  const res = await fetch(
    `${GRAPH}/me/accounts?` + new URLSearchParams({ access_token: userToken, fields: 'id,name,access_token' })
  );
  const data = await readJsonOrThrow(res, 'Facebook Page lookup');
  const page = data?.data?.[0];
  if (!page?.access_token) {
    throw new Error('No Facebook Page with publish access was found for this account');
  }
  return page;
}

async function exchangeFacebook({ code, redirectUri }) {
  const userToken = await exchangeMetaUserToken({ code, redirectUri });
  const page = await getFirstPage(userToken);
  return {
    // Page access tokens derived from a long-lived user token do not expire.
    accessToken: page.access_token,
    refreshToken: null,
    tokenExpiresAt: null,
    platformUsername: page.name,
    pageId: page.id,
  };
}

async function exchangeInstagram({ code, redirectUri }) {
  const userToken = await exchangeMetaUserToken({ code, redirectUri });
  const page = await getFirstPage(userToken);

  const igRes = await fetch(
    `${GRAPH}/${page.id}?` +
      new URLSearchParams({ fields: 'instagram_business_account', access_token: page.access_token })
  );
  const igData = await readJsonOrThrow(igRes, 'Instagram account lookup');
  const igId = igData?.instagram_business_account?.id;
  if (!igId) {
    throw new Error('No Instagram Business account is linked to this Facebook Page');
  }

  let platformUsername = 'connected_user';
  try {
    const uRes = await fetch(
      `${GRAPH}/${igId}?` + new URLSearchParams({ fields: 'username', access_token: page.access_token })
    );
    const u = await readJsonOrThrow(uRes, 'Instagram username lookup');
    if (u?.username) platformUsername = `@${u.username}`;
  } catch {
    // cosmetic
  }

  return {
    accessToken: page.access_token,
    refreshToken: null,
    tokenExpiresAt: null,
    platformUsername,
    pageId: page.id,
    instagramUserId: igId,
  };
}

export async function exchangeCodeForTokens(platform, { code, pkceVerifier, redirectUri } = {}) {
  switch (platform) {
    case 'twitter':
      return exchangeTwitter({ code, pkceVerifier, redirectUri });
    case 'linkedin':
      return exchangeLinkedIn({ code, redirectUri });
    case 'facebook':
      return exchangeFacebook({ code, redirectUri });
    case 'instagram':
      return exchangeInstagram({ code, redirectUri });
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Refreshes an access token. Only X/Twitter issues programmatic refresh
 * tokens here (via offline.access); Meta Page tokens are effectively
 * non-expiring and LinkedIn refresh requires special approval, so those
 * surface a clear "reconnect" error instead.
 */
export async function refreshAccessToken(platform, refreshToken) {
  if (platform !== 'twitter') {
    throw new Error(`Automatic refresh is not available for ${platform}; please reconnect the account`);
  }
  if (!refreshToken) {
    throw new Error('No refresh token stored; please reconnect the account');
  }
  const clientId = requireEnv('TWITTER_API_KEY');
  const clientSecret = requireEnv('TWITTER_API_SECRET');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  const tokens = await readJsonOrThrow(res, 'Twitter token refresh');
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    tokenExpiresAt: expiryFrom(tokens.expires_in),
  };
}

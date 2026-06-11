/**
 * Optional OIDC/OAuth2 *login* providers (distinct from the social
 * publishing connections). A provider is enabled only when the deployer
 * supplies its client id + secret; the login page renders exactly the
 * enabled set.
 *
 * Security model: the browser never handles provider tokens. The server
 * exchanges the code at the provider's token endpoint (confidential client,
 * TLS) and then asks the provider's userinfo/profile API who the user is —
 * so no ID-token signature validation is needed; we only trust what the
 * provider tells us directly. Whatever identity comes back must still pass
 * the instance allowlist before a session is minted.
 */

const FB_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v19.0';

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
      data?.error_description ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `${label} failed (${response.status})`;
    throw new Error(typeof message === 'string' ? message : `${label} failed (${response.status})`);
  }
  return data;
}

const PROVIDERS = {
  google: {
    name: 'Google',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    extraAuthParams: { prompt: 'select_account' },
    async fetchIdentity(accessToken) {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = await readJsonOrThrow(res, 'Google profile lookup');
      if (!me.email) throw new Error('Google did not return an email');
      if (me.email_verified === false) throw new Error('Google email is not verified');
      return { email: me.email, name: me.name || '' };
    },
  },

  microsoft: {
    name: 'Microsoft',
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    // `common` accepts both personal Microsoft accounts and work/school accounts.
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile',
    pkce: true,
    async fetchIdentity(accessToken) {
      const res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = await readJsonOrThrow(res, 'Microsoft profile lookup');
      if (!me.email) throw new Error('Microsoft did not return an email');
      return { email: me.email, name: me.name || '' };
    },
  },

  github: {
    name: 'GitHub',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    pkce: false,
    async fetchIdentity(accessToken) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'postline',
      };
      const userRes = await fetch('https://api.github.com/user', { headers });
      const user = await readJsonOrThrow(userRes, 'GitHub profile lookup');

      let email = user.email || null;
      if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
        const emails = await readJsonOrThrow(emailsRes, 'GitHub email lookup');
        const primary = Array.isArray(emails)
          ? emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified)
          : null;
        email = primary?.email || null;
      }
      if (!email) throw new Error('GitHub did not return a verified email');
      return { email, name: user.name || user.login || '' };
    },
  },

  facebook: {
    name: 'Facebook',
    // Deliberately separate from the FACEBOOK_APP_ID publishing keys so that
    // configuring publishing does not silently enable Facebook login.
    clientIdEnv: 'FACEBOOK_LOGIN_APP_ID',
    clientSecretEnv: 'FACEBOOK_LOGIN_APP_SECRET',
    authUrl: `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token`,
    scope: 'email public_profile',
    pkce: false,
    tokenMethod: 'GET',
    async fetchIdentity(accessToken) {
      const res = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/me?` +
          new URLSearchParams({ fields: 'id,name,email', access_token: accessToken })
      );
      const me = await readJsonOrThrow(res, 'Facebook profile lookup');
      if (!me.email) throw new Error('Facebook did not return an email (the email permission may have been declined)');
      return { email: me.email, name: me.name || '' };
    },
  },
};

function providerCredentials(provider) {
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Providers with credentials configured — drives the login page. */
export function enabledLoginProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, provider]) => providerCredentials(provider))
    .map(([id, provider]) => ({ id, name: provider.name }));
}

export function getLoginProvider(id) {
  const provider = PROVIDERS[id];
  return provider && providerCredentials(provider) ? provider : null;
}

export function buildLoginAuthorizeUrl(providerId, { redirectUri, state, codeChallenge }) {
  const provider = getLoginProvider(providerId);
  if (!provider) throw new Error(`Login provider not configured: ${providerId}`);
  const { clientId } = providerCredentials(provider);

  const url = new URL(provider.authUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scope);
  url.searchParams.set('state', state);
  if (provider.pkce && codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [key, value] of Object.entries(provider.extraAuthParams || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function exchangeLoginCode(providerId, { code, redirectUri, pkceVerifier }) {
  const provider = getLoginProvider(providerId);
  if (!provider) throw new Error(`Login provider not configured: ${providerId}`);
  const { clientId, clientSecret } = providerCredentials(provider);

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (provider.pkce && pkceVerifier) {
    params.set('code_verifier', pkceVerifier);
  }

  let response;
  if (provider.tokenMethod === 'GET') {
    response = await fetch(`${provider.tokenUrl}?${params}`, {
      headers: { Accept: 'application/json' },
    });
  } else {
    response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params,
    });
  }
  const tokens = await readJsonOrThrow(response, `${provider.name} token exchange`);
  if (!tokens.access_token) throw new Error(`${provider.name} token exchange returned no access token`);

  return provider.fetchIdentity(tokens.access_token);
}

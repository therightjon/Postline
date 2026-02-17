import { app } from '@azure/functions';
import { randomUUID } from 'crypto';
import { createItem, queryItems, deleteItem } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';

const CONTAINER = 'socialAccounts';

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
    const redirectBase = request.headers.get('origin') || '';

    // Generate OAuth URLs per platform
    const oauthUrls = {
      facebook: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${redirectBase}/api/accounts/callback/facebook&scope=pages_manage_posts,pages_read_engagement&state=${auth.userId}`,
      instagram: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${redirectBase}/api/accounts/callback/instagram&scope=instagram_basic,instagram_content_publish,pages_show_list&state=${auth.userId}`,
      twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_API_KEY}&redirect_uri=${redirectBase}/api/accounts/callback/twitter&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${auth.userId}&code_challenge=challenge&code_challenge_method=plain`,
      linkedin: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${redirectBase}/api/accounts/callback/linkedin&scope=w_member_social%20r_liteprofile&state=${auth.userId}`,
    };

    const url = oauthUrls[platform];
    if (!url) {
      return { status: 400, jsonBody: { error: `Unsupported platform: ${platform}` } };
    }

    return { jsonBody: { authUrl: url } };
  },
});

// OAuth callback handler
app.http('accountCallback', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'accounts/callback/{platform}',
  handler: async (request, context) => {
    const platform = request.params.platform;
    const code = request.query.get('code');
    const userId = request.query.get('state');

    if (!code || !userId) {
      return { status: 400, jsonBody: { error: 'Missing code or state' } };
    }

    try {
      // Exchange code for tokens (platform-specific)
      // In production, each platform has its own token exchange flow
      const account = await createItem(CONTAINER, {
        id: randomUUID(),
        userId,
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
        headers: { Location: '/accounts?connected=' + platform },
      };
    } catch (err) {
      context.error(`OAuth callback error for ${platform}:`, err.message);
      return {
        status: 302,
        headers: { Location: '/accounts?error=' + encodeURIComponent(err.message) },
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

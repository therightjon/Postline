import { app } from '@azure/functions';
import { getItem, updateItem, queryItems } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';
import { publishToFacebook } from '../services/social/facebook.js';
import { publishToInstagram } from '../services/social/instagram.js';
import { publishToTwitter } from '../services/social/twitter.js';
import { publishToLinkedIn } from '../services/social/linkedin.js';
import { assertAllowedMediaUrl, toClientMediaUrl } from '../services/mediaSecurity.js';
import { decryptSecret, encryptSecret } from '../services/crypto.js';
import { refreshAccessToken } from '../services/social/oauth.js';

const TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * Refreshes an account's access token if it is expired or about to expire,
 * persisting the new (re-encrypted) tokens. Non-expiring tokens pass through.
 */
async function ensureFreshAccount(account, userId) {
  const expiresMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null;
  if (!expiresMs || expiresMs - Date.now() > TOKEN_REFRESH_SKEW_MS) {
    return account;
  }
  const refreshed = await refreshAccessToken(account.platform, account.refreshToken);
  await updateItem(ACCOUNTS, account.id, userId, {
    accessToken: encryptSecret(refreshed.accessToken),
    refreshToken: encryptSecret(refreshed.refreshToken),
    tokenExpiresAt: refreshed.tokenExpiresAt,
  });
  return { ...account, ...refreshed };
}

const POSTS = 'posts';
const ACCOUNTS = 'socialAccounts';

const PUBLISHERS = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToTwitter,
  linkedin: publishToLinkedIn,
};
const PUBLISH_MEDIA_SAS_TTL_MINUTES = Number.parseInt(
  process.env.PUBLISH_MEDIA_SAS_TTL_MINUTES || process.env.MEDIA_SAS_TTL_MINUTES || '120',
  10
);

/**
 * Publishes a post to all selected platforms.
 * Records per-platform success/failure.
 */
export async function publishPost(postId, userId) {
  const post = await getItem(POSTS, postId, userId);
  if (!post) throw new Error('Post not found');

  // Get connected accounts for this user
  const accounts = await queryItems(
    ACCOUNTS,
    'SELECT * FROM c WHERE c.userId = @userId',
    [{ name: '@userId', value: userId }]
  );

  // Tokens are encrypted at rest — decrypt only in-memory for the publish call.
  const accountMap = {};
  for (const acc of accounts) {
    accountMap[acc.platform] = {
      ...acc,
      accessToken: decryptSecret(acc.accessToken),
      refreshToken: decryptSecret(acc.refreshToken),
    };
  }

  const results = {};
  let hasError = false;
  let mediaUrlError = null;
  let publishPostInput = post;

  if (post.mediaUrl) {
    try {
      const normalizedMediaUrl = assertAllowedMediaUrl(post.mediaUrl);
      publishPostInput = {
        ...post,
        mediaUrl: toClientMediaUrl(normalizedMediaUrl, PUBLISH_MEDIA_SAS_TTL_MINUTES),
      };
    } catch (err) {
      mediaUrlError = err.message;
      hasError = true;
    }
  }

  for (const platform of post.platforms) {
    const publisher = PUBLISHERS[platform];
    const account = accountMap[platform];

    if (mediaUrlError) {
      results[platform] = { success: false, error: `Invalid media URL: ${mediaUrlError}` };
      continue;
    }

    if (!publisher) {
      results[platform] = { success: false, error: 'Unsupported platform' };
      hasError = true;
      continue;
    }

    if (!account) {
      results[platform] = { success: false, error: 'Account not connected' };
      hasError = true;
      continue;
    }

    try {
      const freshAccount = await ensureFreshAccount(account, userId);
      const result = await publisher(publishPostInput, freshAccount);
      results[platform] = { success: true, platformPostId: result.id || null };
    } catch (err) {
      results[platform] = { success: false, error: err.message };
      hasError = true;
    }
  }

  // Update post status
  await updateItem(POSTS, postId, userId, {
    status: hasError ? 'failed' : 'published',
    publishedAt: new Date().toISOString(),
    publishResults: results,
    error: hasError
      ? Object.entries(results)
          .filter(([, r]) => !r.success)
          .map(([p, r]) => `${p}: ${r.error}`)
          .join('; ')
      : null,
  });

  return results;
}

// HTTP endpoint to publish a post immediately
app.http('publishPost', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'posts/{id}/publish',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    try {
      const results = await publishPost(request.params.id, auth.userId);
      return { jsonBody: { results } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

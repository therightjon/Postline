import { app } from '@azure/functions';
import { getItem, updateItem, queryItems } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';
import { publishToFacebook } from '../services/social/facebook.js';
import { publishToInstagram } from '../services/social/instagram.js';
import { publishToTwitter } from '../services/social/twitter.js';
import { publishToLinkedIn } from '../services/social/linkedin.js';

const POSTS = 'posts';
const ACCOUNTS = 'socialAccounts';

const PUBLISHERS = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToTwitter,
  linkedin: publishToLinkedIn,
};

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

  const accountMap = {};
  for (const acc of accounts) {
    accountMap[acc.platform] = acc;
  }

  const results = {};
  let hasError = false;

  for (const platform of post.platforms) {
    const publisher = PUBLISHERS[platform];
    const account = accountMap[platform];

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
      const result = await publisher(post, account);
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

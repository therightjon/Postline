import { app } from '@azure/functions';
import { queryItems } from '../services/cosmos.js';
import { publishPost } from './publish.js';

/**
 * Timer Trigger: runs every minute to check for scheduled posts
 * that are due for publishing.
 */
app.timer('scheduler', {
  schedule: '0 */1 * * * *', // Every minute
  handler: async (timer, context) => {
    context.log('Scheduler triggered at:', new Date().toISOString());

    try {
      const now = new Date().toISOString();

      // Find all posts that are scheduled and due
      const duePosts = await queryItems(
        'posts',
        'SELECT * FROM c WHERE c.status = "scheduled" AND c.scheduledAt <= @now',
        [{ name: '@now', value: now }]
      );

      context.log(`Found ${duePosts.length} posts due for publishing`);

      for (const post of duePosts) {
        try {
          context.log(`Publishing post ${post.id} for user ${post.userId}`);
          await publishPost(post.id, post.userId);
          context.log(`Successfully published post ${post.id}`);
        } catch (err) {
          context.error(`Failed to publish post ${post.id}:`, err.message);
        }
      }
    } catch (err) {
      context.error('Scheduler error:', err.message);
    }
  },
});

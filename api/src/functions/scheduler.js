import { app } from '@azure/functions';
import { queryItems } from '../services/cosmos.js';
import { publishPost } from './publish.js';

// Bound each tick so a flood of due posts can't fan out unboundedly
// (cost spikes / starved publishes — threat model TM-004).
const BATCH_SIZE = Number.parseInt(process.env.SCHEDULER_BATCH_SIZE || '100', 10);
const CONCURRENCY = Number.parseInt(process.env.SCHEDULER_CONCURRENCY || '5', 10);

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

      // Oldest-due first, capped per tick. Remaining posts roll to the next run.
      const duePosts = await queryItems(
        'posts',
        'SELECT TOP @limit * FROM c WHERE c.status = "scheduled" AND c.scheduledAt <= @now ORDER BY c.scheduledAt ASC',
        [
          { name: '@now', value: now },
          { name: '@limit', value: BATCH_SIZE },
        ]
      );

      context.log(`Found ${duePosts.length} posts due for publishing`);

      for (let i = 0; i < duePosts.length; i += CONCURRENCY) {
        const batch = duePosts.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map((post) => publishPost(post.id, post.userId))
        );
        settled.forEach((result, idx) => {
          const post = batch[idx];
          if (result.status === 'rejected') {
            context.error(`Failed to publish post ${post.id}:`, result.reason?.message || result.reason);
          } else {
            context.log(`Successfully published post ${post.id}`);
          }
        });
      }

      if (duePosts.length === BATCH_SIZE) {
        context.log('Scheduler hit the per-tick batch cap; remaining due posts will publish on the next tick.');
      }
    } catch (err) {
      context.error('Scheduler error:', err.message);
    }
  },
});

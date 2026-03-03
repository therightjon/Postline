/**
 * Instagram Graph API Publishing Service
 * Publishes posts to Instagram Business/Creator accounts via the Graph API.
 * 
 * Requirements:
 * - Instagram Business or Creator account connected to a Facebook Page
 * - Facebook App with `instagram_basic` and `instagram_content_publish` permissions
 * 
 * Note: Instagram API requires a two-step publish flow:
 * 1. Create a media container
 * 2. Publish the container
 */

import { assertAllowedMediaUrl } from '../mediaSecurity.js';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export async function publishToInstagram(post, account) {
  const igUserId = account.instagramUserId;
  const accessToken = account.accessToken;

  if (!accessToken || !igUserId) {
    throw new Error('Instagram account not properly connected');
  }

  if (!post.mediaUrl) {
    throw new Error('Instagram requires an image to publish');
  }
  const safeMediaUrl = assertAllowedMediaUrl(post.mediaUrl);

  // Step 1: Create media container
  const containerResponse = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: safeMediaUrl,
      caption: post.content,
      access_token: accessToken,
    }),
  });

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    throw new Error(error.error?.message || 'Instagram container creation failed');
  }

  const { id: containerId } = await containerResponse.json();

  // Step 2: Publish the container
  const publishResponse = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    throw new Error(error.error?.message || 'Instagram publish failed');
  }

  return await publishResponse.json();
}

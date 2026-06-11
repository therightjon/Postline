/**
 * X (Twitter) API v2 Publishing Service
 * Posts tweets using the Twitter API v2.
 * 
 * Requirements:
 * - Twitter Developer account with API v2 access
 * - Free tier: up to 1,500 tweets per month
 * 
 * Uses OAuth 2.0 user context for posting on behalf of users.
 */

import { assertAllowedMediaUrl, safeFetchMedia } from '../mediaSecurity.js';

const TWITTER_API = 'https://api.twitter.com/2';

export async function publishToTwitter(post, account) {
  const accessToken = account.accessToken;

  if (!accessToken) {
    throw new Error('No Twitter access token available');
  }

  const tweetData = {
    text: post.content.slice(0, 280), // Enforce 280 char limit
  };

  // If there's media, upload it first
  if (post.mediaUrl) {
    try {
      const mediaId = await uploadTwitterMedia(assertAllowedMediaUrl(post.mediaUrl), account);
      if (mediaId) {
        tweetData.media = { media_ids: [mediaId] };
      }
    } catch (err) {
      console.error('Twitter media upload failed, posting without media:', err.message);
    }
  }

  const response = await fetch(`${TWITTER_API}/tweets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(tweetData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.title || 'Tweet failed');
  }

  const result = await response.json();
  return { id: result.data?.id };
}

async function uploadTwitterMedia(mediaUrl, account) {
  // Twitter media upload uses v1.1 API
  // This is a simplified version — full implementation requires chunked upload for large files
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  const { buffer } = await safeFetchMedia(mediaUrl);
  const base64 = buffer.toString('base64');

  const formBody = new URLSearchParams({
    media_data: base64,
  });

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
    },
    body: formBody,
  });

  if (!response.ok) {
    throw new Error('Twitter media upload failed');
  }

  const result = await response.json();
  return result.media_id_string;
}

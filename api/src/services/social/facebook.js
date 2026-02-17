/**
 * Facebook Graph API Publishing Service
 * Publishes posts to Facebook Pages via the Graph API.
 * 
 * Requires:
 * - Facebook App with `pages_manage_posts` permission
 * - A connected Page access token stored in the social account
 */

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export async function publishToFacebook(post, account) {
  const pageId = account.pageId || 'me';
  const accessToken = account.accessToken;

  if (!accessToken) {
    throw new Error('No Facebook access token available');
  }

  const body = {
    message: post.content,
    access_token: accessToken,
  };

  // If there's a media URL, create a photo post
  if (post.mediaUrl) {
    const response = await fetch(`${GRAPH_API}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        url: post.mediaUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Facebook photo post failed');
    }

    return await response.json();
  }

  // Text-only post
  const response = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Facebook post failed');
  }

  return await response.json();
}

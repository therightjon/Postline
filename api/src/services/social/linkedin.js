/**
 * LinkedIn Share API Publishing Service
 * Publishes posts to LinkedIn profiles/pages.
 * 
 * Requirements:
 * - LinkedIn Marketing Developer Platform access
 * - OAuth token with `w_member_social` scope
 */

const LINKEDIN_API = 'https://api.linkedin.com/v2';

export async function publishToLinkedIn(post, account) {
  const accessToken = account.accessToken;
  const personUrn = account.linkedinUrn; // e.g. "urn:li:person:XXXXX"

  if (!accessToken || !personUrn) {
    throw new Error('LinkedIn account not properly connected');
  }

  const shareBody = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: post.content,
        },
        shareMediaCategory: post.mediaUrl ? 'IMAGE' : 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  // If there's media, register and upload it first
  if (post.mediaUrl) {
    try {
      const mediaAsset = await uploadLinkedInMedia(post.mediaUrl, personUrn, accessToken);
      shareBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          description: { text: 'Post image' },
          media: mediaAsset,
        },
      ];
    } catch (err) {
      console.error('LinkedIn media upload failed, posting without media:', err.message);
    }
  }

  const response = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(shareBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn post failed: ${error}`);
  }

  const postId = response.headers.get('X-RestLi-Id') || 'unknown';
  return { id: postId };
}

async function uploadLinkedInMedia(mediaUrl, personUrn, accessToken) {
  // Step 1: Register upload
  const registerResponse = await fetch(`${LINKEDIN_API}/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  if (!registerResponse.ok) {
    throw new Error('LinkedIn media registration failed');
  }

  const registerData = await registerResponse.json();
  const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = registerData.value?.asset;

  if (!uploadUrl || !asset) {
    throw new Error('LinkedIn media registration returned invalid data');
  }

  // Step 2: Upload the image
  const imageResponse = await fetch(mediaUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: Buffer.from(imageBuffer),
  });

  if (!uploadResponse.ok) {
    throw new Error('LinkedIn media upload failed');
  }

  return asset;
}

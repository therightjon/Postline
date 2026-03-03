import { app } from '@azure/functions';
import { randomUUID } from 'crypto';
import { createItem, queryItems, getItem, updateItem, deleteItem } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';
import { assertAllowedMediaUrl, toClientMediaUrl } from '../services/mediaSecurity.js';

const CONTAINER = 'posts';
const SUPPORTED_PLATFORMS = new Set(['facebook', 'instagram', 'twitter', 'linkedin']);
const USER_WRITABLE_STATUSES = new Set(['draft', 'scheduled']);

function normalizePlatforms(platforms) {
  if (!Array.isArray(platforms)) {
    throw new Error('platforms must be an array');
  }

  const normalized = [...new Set(platforms.map((platform) => String(platform).toLowerCase()))];
  if (normalized.length === 0) {
    throw new Error('At least one platform is required');
  }

  for (const platform of normalized) {
    if (!SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  return normalized;
}

function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (!USER_WRITABLE_STATUSES.has(normalized)) {
    throw new Error(`Unsupported status: ${status}`);
  }
  return normalized;
}

function normalizeScheduledAt(scheduledAt) {
  if (scheduledAt === null || scheduledAt === '') return null;
  const parsed = new Date(scheduledAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('scheduledAt must be a valid ISO datetime');
  }
  return parsed.toISOString();
}

function normalizeMediaUrl(mediaUrl) {
  if (mediaUrl === undefined) return undefined;
  if (mediaUrl === null || mediaUrl === '') return null;
  return assertAllowedMediaUrl(mediaUrl);
}

function presentPost(post) {
  if (!post) return post;
  return {
    ...post,
    mediaBlobUrl: post.mediaUrl || null,
    mediaUrl: post.mediaUrl ? toClientMediaUrl(post.mediaUrl) : null,
  };
}

// List posts
app.http('listPosts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'posts',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth; // 401

    const status = request.query.get('status');
    let query = 'SELECT * FROM c WHERE c.userId = @userId';
    const params = [{ name: '@userId', value: auth.userId }];

    if (status && status !== 'all') {
      query += ' AND c.status = @status';
      params.push({ name: '@status', value: status });
    }

    query += ' ORDER BY c.createdAt DESC';

    const posts = await queryItems(CONTAINER, query, params);
    return { jsonBody: posts.map(presentPost) };
  },
});

// Get single post
app.http('getPost', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'posts/{id}',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    const id = request.params.id;
    const post = await getItem(CONTAINER, id, auth.userId);

    if (!post || post.userId !== auth.userId) {
      return { status: 404, jsonBody: { error: 'Post not found' } };
    }

    return { jsonBody: presentPost(post) };
  },
});

// Create post
app.http('createPost', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'posts',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    try {
      const body = await request.json();
      const status = normalizeStatus(body.status || 'draft');
      const scheduledAt = body.scheduledAt ? normalizeScheduledAt(body.scheduledAt) : null;
      if (status === 'scheduled' && !scheduledAt) {
        return { status: 400, jsonBody: { error: 'scheduledAt is required for scheduled posts' } };
      }

      const post = await createItem(CONTAINER, {
        id: randomUUID(),
        userId: auth.userId,
        content: typeof body.content === 'string' ? body.content : '',
        platforms: normalizePlatforms(body.platforms || []),
        mediaUrl: normalizeMediaUrl(body.mediaUrl) || null,
        status,
        scheduledAt,
        publishedAt: null,
        publishResults: {},
        error: null,
      });

      return { status: 201, jsonBody: presentPost(post) };
    } catch (err) {
      return { status: 400, jsonBody: { error: err.message } };
    }
  },
});

// Update post
app.http('updatePost', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'posts/{id}',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    const id = request.params.id;

    try {
      const body = await request.json();
      const updates = {};

      if (Object.prototype.hasOwnProperty.call(body, 'content')) {
        updates.content = typeof body.content === 'string' ? body.content : '';
      }
      if (Object.prototype.hasOwnProperty.call(body, 'platforms')) {
        updates.platforms = normalizePlatforms(body.platforms);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'mediaUrl')) {
        updates.mediaUrl = normalizeMediaUrl(body.mediaUrl);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        updates.status = normalizeStatus(body.status);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'scheduledAt')) {
        updates.scheduledAt = normalizeScheduledAt(body.scheduledAt);
      }

      if (updates.status === 'scheduled' && updates.scheduledAt === null) {
        return { status: 400, jsonBody: { error: 'scheduledAt is required for scheduled posts' } };
      }

      const updated = await updateItem(CONTAINER, id, auth.userId, updates);
      return { jsonBody: presentPost(updated) };
    } catch (err) {
      return { status: 400, jsonBody: { error: err.message } };
    }
  },
});

// Delete post
app.http('deletePost', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'posts/{id}',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    await deleteItem(CONTAINER, request.params.id, auth.userId);
    return { status: 204 };
  },
});

import { app } from '@azure/functions';
import { randomUUID } from 'crypto';
import { createItem, queryItems, getItem, updateItem, deleteItem } from '../services/cosmos.js';
import { requireAuth } from '../middleware/auth.js';

const CONTAINER = 'posts';

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
    return { jsonBody: posts };
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

    return { jsonBody: post };
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

    const body = await request.json();
    const post = await createItem(CONTAINER, {
      id: randomUUID(),
      userId: auth.userId,
      content: body.content || '',
      platforms: body.platforms || [],
      mediaUrl: body.mediaUrl || null,
      status: body.status || 'draft',
      scheduledAt: body.scheduledAt || null,
      publishedAt: null,
      publishResults: {},
      error: null,
    });

    return { status: 201, jsonBody: post };
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
    const body = await request.json();

    const updated = await updateItem(CONTAINER, id, auth.userId, {
      content: body.content,
      platforms: body.platforms,
      mediaUrl: body.mediaUrl,
      status: body.status,
      scheduledAt: body.scheduledAt,
    });

    return { jsonBody: updated };
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

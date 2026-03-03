import { app } from '@azure/functions';
import { uploadMedia } from '../services/blob.js';
import { requireAuth } from '../middleware/auth.js';
import { toClientMediaUrl } from '../services/mediaSecurity.js';

const MAX_MEDIA_BYTES = Number.parseInt(process.env.MAX_MEDIA_BYTES || '10485760', 10);
const ALLOWED_MEDIA_TYPES = new Set(
  (process.env.ALLOWED_MEDIA_TYPES || 'image/jpeg,image/png,image/webp,image/gif,video/mp4')
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean)
);

// Media upload endpoint
app.http('uploadMedia', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'media',
  handler: async (request, context) => {
    const auth = await requireAuth(request);
    if (auth.status) return auth;

    try {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return { status: 400, jsonBody: { error: 'No file provided' } };
      }

      const contentType = (file.type || '').toLowerCase();
      if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
        return { status: 415, jsonBody: { error: `Unsupported media type: ${contentType || 'unknown'}` } };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_MEDIA_BYTES) {
        return { status: 413, jsonBody: { error: 'File exceeds maximum size limit' } };
      }

      const blobUrl = await uploadMedia(buffer, file.name, contentType);
      const url = toClientMediaUrl(blobUrl);

      return {
        jsonBody: {
          url,
          blobUrl,
          name: file.name,
          size: buffer.length,
          contentType,
        },
      };
    } catch (err) {
      context.error('Media upload error:', err.message);
      return { status: 500, jsonBody: { error: 'Failed to upload media' } };
    }
  },
});

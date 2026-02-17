import { app } from '@azure/functions';
import { uploadMedia } from '../services/blob.js';
import { requireAuth } from '../middleware/auth.js';

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

      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadMedia(buffer, file.name, file.type);

      return { jsonBody: { url, name: file.name, size: buffer.length } };
    } catch (err) {
      context.error('Media upload error:', err.message);
      return { status: 500, jsonBody: { error: 'Failed to upload media' } };
    }
  },
});

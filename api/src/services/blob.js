import { BlobServiceClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';

let blobServiceClient = null;
let containerClient = null;

function getContainerClient() {
  if (!containerClient) {
    const connectionString = process.env.BLOB_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('BLOB_CONNECTION_STRING must be set');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(
      process.env.BLOB_CONTAINER || 'media'
    );
  }
  return containerClient;
}

export async function uploadMedia(buffer, originalName, contentType) {
  const container = getContainerClient();
  // Ensure container exists
  await container.createIfNotExists({ access: 'blob' });

  const ext = originalName.split('.').pop() || 'jpg';
  const blobName = `${Date.now()}-${randomUUID()}.${ext}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

export async function deleteMedia(blobUrl) {
  const container = getContainerClient();
  const url = new URL(blobUrl);
  const blobName = url.pathname.split('/').pop();
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

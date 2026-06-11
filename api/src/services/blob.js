import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { randomUUID } from 'crypto';

let cachedConfig = null;

function parseConnectionString(connectionString) {
  const parts = {};
  for (const segment of connectionString.split(';')) {
    if (!segment) continue;
    const idx = segment.indexOf('=');
    if (idx === -1) continue;
    const key = segment.slice(0, idx);
    const value = segment.slice(idx + 1);
    parts[key] = value;
  }
  return parts;
}

function getBlobConfig() {
  if (!cachedConfig) {
    const connectionString = process.env.BLOB_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('BLOB_CONNECTION_STRING must be set');
    }

    const parsed = parseConnectionString(connectionString);
    const accountName = parsed.AccountName;
    const accountKey = parsed.AccountKey;
    if (!accountName || !accountKey) {
      throw new Error('BLOB_CONNECTION_STRING must include AccountName and AccountKey');
    }

    const containerName = process.env.BLOB_CONTAINER || 'media';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobHost = new URL(blobServiceClient.url).host;

    cachedConfig = {
      accountName,
      blobHost,
      containerName,
      containerClient,
      credential,
    };
  }

  return cachedConfig;
}

function parseBlobUrl(blobUrl) {
  const config = getBlobConfig();
  const url = new URL(blobUrl);
  const path = url.pathname.replace(/^\/+/, '');
  const [containerName, ...blobParts] = path.split('/');
  const blobName = blobParts.join('/');
  if (!containerName || !blobName) {
    throw new Error('Invalid blob URL');
  }

  return {
    host: url.host,
    containerName,
    blobName,
    normalizedUrl: `${url.protocol}//${url.host}/${path}`,
    isManaged:
      url.host === config.blobHost &&
      containerName === config.containerName,
  };
}

function sanitizeFileNameExtension(originalName, contentType) {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
  };

  const extFromName = originalName?.split('.').pop()?.toLowerCase();
  if (extFromName && /^[a-z0-9]+$/.test(extFromName)) {
    return extFromName;
  }

  return mimeToExt[contentType] || 'bin';
}

export function isManagedBlobUrl(blobUrl) {
  try {
    return parseBlobUrl(blobUrl).isManaged;
  } catch {
    return false;
  }
}

export function stripBlobUrlSignature(blobUrl) {
  const parsed = parseBlobUrl(blobUrl);
  return parsed.normalizedUrl;
}

export function getManagedBlobHost() {
  return getBlobConfig().blobHost;
}

export function createReadSignedBlobUrl(blobUrl, expiresInMinutes = 60) {
  const config = getBlobConfig();
  const parsed = parseBlobUrl(blobUrl);
  if (!parsed.isManaged) {
    return parsed.normalizedUrl;
  }

  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: parsed.containerName,
      blobName: parsed.blobName,
      startsOn,
      expiresOn,
      permissions: BlobSASPermissions.parse('r'),
    },
    config.credential
  ).toString();

  return `${parsed.normalizedUrl}?${sas}`;
}

function getContainerClient() {
  return getBlobConfig().containerClient;
}

export async function uploadMedia(buffer, originalName, contentType) {
  const container = getContainerClient();
  await container.createIfNotExists();

  const ext = sanitizeFileNameExtension(originalName, contentType);
  const blobName = `${Date.now()}-${randomUUID()}.${ext}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

export async function deleteMedia(blobUrl) {
  const container = getContainerClient();
  const parsed = parseBlobUrl(blobUrl);
  if (!parsed.isManaged) {
    throw new Error('Cannot delete media outside managed blob container');
  }

  const blobName = parsed.blobName;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

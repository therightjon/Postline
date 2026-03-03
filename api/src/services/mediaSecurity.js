import { createReadSignedBlobUrl, getManagedBlobHost, isManagedBlobUrl, stripBlobUrlSignature } from './blob.js';

const DEFAULT_SAS_TTL_MINUTES = Number.parseInt(process.env.MEDIA_SAS_TTL_MINUTES || '60', 10);

function parseAllowedHosts() {
  const configuredHosts = (process.env.MEDIA_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  try {
    configuredHosts.push(getManagedBlobHost().toLowerCase());
  } catch {
    // Storage may not be configured in some local/demo paths.
  }

  return new Set(configuredHosts);
}

export function normalizeMediaUrl(mediaUrl) {
  if (!mediaUrl) return null;

  const url = new URL(mediaUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Media URL must use HTTPS');
  }

  url.search = '';
  url.hash = '';
  return url.toString();
}

export function assertAllowedMediaUrl(mediaUrl) {
  if (!mediaUrl) return null;

  const normalizedUrl = normalizeMediaUrl(mediaUrl);
  const allowedHosts = parseAllowedHosts();
  const host = new URL(normalizedUrl).host.toLowerCase();
  if (!allowedHosts.has(host)) {
    throw new Error(`Media host not allowed: ${host}`);
  }

  return normalizedUrl;
}

export function toClientMediaUrl(mediaUrl, expiresInMinutes = DEFAULT_SAS_TTL_MINUTES) {
  if (!mediaUrl) return null;
  if (!isManagedBlobUrl(mediaUrl)) return mediaUrl;
  return createReadSignedBlobUrl(stripBlobUrlSignature(mediaUrl), expiresInMinutes);
}

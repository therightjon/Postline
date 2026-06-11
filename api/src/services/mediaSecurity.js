import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { createReadSignedBlobUrl, getManagedBlobHost, isManagedBlobUrl, stripBlobUrlSignature } from './blob.js';

const DEFAULT_SAS_TTL_MINUTES = Number.parseInt(process.env.MEDIA_SAS_TTL_MINUTES || '60', 10);
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.MEDIA_FETCH_TIMEOUT_MS || '10000', 10);
const MAX_FETCH_BYTES = Number.parseInt(process.env.MEDIA_FETCH_MAX_BYTES || '15728640', 10); // 15 MB

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

function isPrivateIpv4(ip) {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  const mapped = lower.match(/(?:::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true; // not an IP literal → unsafe
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

/**
 * Fetches media for server-side upload (X/LinkedIn) with SSRF protections
 * (threat model TM-002): host allowlist, DNS resolution to a public address,
 * no redirects, a request timeout, and a response-size cap.
 *
 * Note: a strict allowlist is the primary control here; the DNS check narrows
 * the residual DNS-rebinding window but cannot fully eliminate it without
 * pinning the connection to the resolved IP.
 */
export async function safeFetchMedia(mediaUrl) {
  const url = assertAllowedMediaUrl(mediaUrl);
  const { hostname } = new URL(url);

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Media URL targets a non-public address');
    }
  } else {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length) {
      throw new Error('Media host did not resolve');
    }
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        throw new Error('Media URL resolves to a non-public address');
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Media fetch failed with status ${response.status}`);
    }

    const declaredLength = Number.parseInt(response.headers.get('content-length') || '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FETCH_BYTES) {
      throw new Error('Media exceeds maximum fetch size');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const reader = response.body?.getReader();
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_FETCH_BYTES) {
        throw new Error('Media exceeds maximum fetch size');
      }
      return { buffer, contentType };
    }

    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FETCH_BYTES) {
        await reader.cancel();
        throw new Error('Media exceeds maximum fetch size');
      }
      chunks.push(Buffer.from(value));
    }
    return { buffer: Buffer.concat(chunks), contentType };
  } finally {
    clearTimeout(timer);
  }
}

export function toClientMediaUrl(mediaUrl, expiresInMinutes = DEFAULT_SAS_TTL_MINUTES) {
  if (!mediaUrl) return null;
  if (!isManagedBlobUrl(mediaUrl)) return mediaUrl;
  return createReadSignedBlobUrl(stripBlobUrlSignature(mediaUrl), expiresInMinutes);
}

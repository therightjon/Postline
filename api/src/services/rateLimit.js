/**
 * In-memory login throttle with exponential lockout backoff.
 *
 * Scope note: state is per Function-App instance. For a single-user
 * deployment on the Consumption plan this is an acceptable trade — the slow
 * scrypt hash is the floor defense, and a distributed attacker still hits
 * per-instance lockouts. A shared store (Cosmos/Redis) would be needed for a
 * multi-instance public service, which this deliberately is not.
 */

const MAX_FREE_ATTEMPTS = 5; // failures before lockout kicks in
const BASE_LOCKOUT_MS = 30_000; // first lockout: 30s, doubles each failure
const MAX_LOCKOUT_MS = 15 * 60_000; // cap: 15 minutes
const ENTRY_TTL_MS = 60 * 60_000; // forget an IP after an hour of silence

const attempts = new Map(); // key -> { failures, lockedUntil, lastSeen }

function prune() {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.lastSeen > ENTRY_TTL_MS) attempts.delete(key);
  }
}

export function getClientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0].trim();
  return first || 'unknown';
}

/** Returns null if allowed, or { retryAfterSeconds } while locked out. */
export function checkLoginAllowed(key) {
  prune();
  const entry = attempts.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return null;
}

export function recordLoginFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key) || { failures: 0, lockedUntil: 0, lastSeen: now };
  entry.failures += 1;
  entry.lastSeen = now;
  if (entry.failures > MAX_FREE_ATTEMPTS) {
    const exponent = entry.failures - MAX_FREE_ATTEMPTS - 1;
    const lockout = Math.min(BASE_LOCKOUT_MS * 2 ** exponent, MAX_LOCKOUT_MS);
    entry.lockedUntil = now + lockout;
  }
  attempts.set(key, entry);
}

export function recordLoginSuccess(key) {
  attempts.delete(key);
}

/**
 * Password hashing/verification for the single admin credential.
 *
 * Uses Node's built-in scrypt (memory-hard KDF) so there are zero native or
 * third-party dependencies — important for a self-hostable tool that must
 * build identically on Azure Functions, Docker, and bare metal.
 *
 * Stored format: scrypt:<N>:<r>:<p>:<salt-base64>:<hash-base64>
 * Generate one with: node scripts/hash-password.mjs "your-password"
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_N = 16384; // cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelization
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual;
  try {
    actual = scryptSync(password, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

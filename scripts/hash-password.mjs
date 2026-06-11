#!/usr/bin/env node
/**
 * Generates the ADMIN_PASSWORD_HASH value for Postline.
 *
 * Usage:
 *   node scripts/hash-password.mjs "your-password"     # hash a chosen password
 *   node scripts/hash-password.mjs --generate          # generate a random password and hash it
 *
 * The hash (not the password) goes in the ADMIN_PASSWORD_HASH app setting /
 * env var. Uses the same scrypt parameters as the API (api/src/services/password.js).
 */
import { randomBytes, scryptSync } from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

const arg = process.argv[2];

if (!arg) {
  console.error('Usage: node scripts/hash-password.mjs "your-password" | --generate');
  process.exit(1);
}

if (arg === '--generate') {
  const password = randomBytes(18).toString('base64url');
  console.log(`Generated password (save this — it is shown only once):\n  ${password}\n`);
  console.log(`ADMIN_PASSWORD_HASH:\n  ${hashPassword(password)}`);
} else {
  console.log(hashPassword(arg));
}

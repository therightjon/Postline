/**
 * Application-level envelope encryption for secrets stored at rest
 * (OAuth access/refresh tokens in the socialAccounts container).
 *
 * Uses AES-256-GCM with a 32-byte key supplied via TOKEN_ENCRYPTION_KEY
 * (base64). In production the key should be sourced from Key Vault and
 * injected as an app setting / Key Vault reference.
 *
 * Generate a key with:  openssl rand -base64 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set to encrypt/decrypt stored secrets');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64 of `openssl rand -base64 32`)');
  }
  cachedKey = key;
  return key;
}

export function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(value) {
  if (value === null || value === undefined) return null;
  // Tolerate legacy plaintext values so pre-existing records keep working.
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) {
    return value;
  }
  const key = getKey();
  const data = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// src/utils/encryption.util.js
import crypto from 'crypto';
import { env } from '../config/env.js';
const ALGORITHM  = 'aes-256-gcm';
const KEY_HEX    = env.FIELD_ENCRYPTION_KEY; // must be 64 hex chars = 32 bytes

if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error(
    'FIELD_ENCRYPTION_KEY must be set in .env as a 64-character hex string.\n' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const KEY = Buffer.from(KEY_HEX, 'hex'); // 32-byte key for AES-256

/**
 * Encrypts a plain-text string.
 * Returns a single string: iv:authTag:ciphertext  (all hex)
 */
export function encrypt(plainText) {
  if (!plainText) return plainText;

  const iv         = crypto.randomBytes(12);              // 96-bit IV for GCM
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const authTag    = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a string previously produced by encrypt().
 * Returns the original plain-text value.
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  const [ivHex, authTagHex, cipherHex] = encryptedText.split(':');

  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Invalid encrypted field format');
  }

  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const cipherText = Buffer.from(cipherHex, 'hex');

  const decipher   = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]).toString('utf8');
}
/**
 * Client-side encryption for backup files using the Web Crypto API.
 * Uses AES-GCM for authenticated encryption.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: string, password: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(data)
  );

  // Combine salt + iv + encrypted data into a single buffer
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

  return result.buffer;
}

export async function decryptData(buffer: ArrayBuffer, password: string): Promise<string> {
  const data = new Uint8Array(buffer);
  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = data.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

export function isEncryptionSupported(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

// ---- Encrypted Sync Helpers ----

import { SYNC_ENCRYPTION_KEY } from '@/lib/constants/storageKeys';

export interface SyncEncryptionConfig {
  enabled: boolean;
  /** Encrypted passphrase check - used to verify the correct password on unlock */
  passphraseCheck?: string;
}

export function getSyncEncryptionConfig(): SyncEncryptionConfig {
  try {
    const data = localStorage.getItem(SYNC_ENCRYPTION_KEY);
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { enabled: false };
}

export function setSyncEncryptionConfig(config: SyncEncryptionConfig): void {
  localStorage.setItem(SYNC_ENCRYPTION_KEY, JSON.stringify(config));
}

/**
 * Encrypt a sync payload (JSON string) with the user's passphrase.
 * Returns a base64-encoded string suitable for transmission.
 */
export async function encryptSyncPayload(jsonData: string, passphrase: string): Promise<string> {
  const buffer = await encryptData(jsonData, passphrase);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decrypt a base64-encoded encrypted sync payload.
 * Returns the original JSON string.
 */
export async function decryptSyncPayload(base64Data: string, passphrase: string): Promise<string> {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decryptData(bytes.buffer, passphrase);
}

/**
 * Initialize sync encryption: sets up a passphrase check value.
 */
export async function initSyncEncryption(passphrase: string): Promise<void> {
  const checkValue = await encryptSyncPayload('draftharbour-encryption-check', passphrase);
  setSyncEncryptionConfig({ enabled: true, passphraseCheck: checkValue });
}

/**
 * Verify a passphrase against the stored check.
 */
export async function verifySyncPassphrase(passphrase: string): Promise<boolean> {
  const config = getSyncEncryptionConfig();
  if (!config.passphraseCheck) return false;
  try {
    const decrypted = await decryptSyncPayload(config.passphraseCheck, passphrase);
    return decrypted === 'draftharbour-encryption-check';
  } catch {
    return false;
  }
}

/**
 * Disable sync encryption and clear config.
 */
export function disableSyncEncryption(): void {
  setSyncEncryptionConfig({ enabled: false });
}

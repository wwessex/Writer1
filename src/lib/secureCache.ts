import { getSecret, isDesktop, setSecret } from '@/lib/desktopSecrets';

const CACHE_KEY_SECRET = 'local_cache_encryption_key';
const FALLBACK_KEY_STORAGE = 'draftharbour_cache_key_v1';
const BYTE_CHUNK_SIZE = 8 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i += BYTE_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BYTE_CHUNK_SIZE);
    let chunkBinary = '';

    for (let j = 0; j < chunk.length; j++) {
      chunkBinary += String.fromCharCode(chunk[j]);
    }

    binary += chunkBinary;
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function getOrCreateKeyMaterial(): Promise<string> {
  if (isDesktop()) {
    const existing = await getSecret(CACHE_KEY_SECRET);
    if (existing) return existing;
    const created = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await setSecret(CACHE_KEY_SECRET, created);
    return created;
  }

  const existing = localStorage.getItem(FALLBACK_KEY_STORAGE);
  if (existing) return existing;
  const created = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  localStorage.setItem(FALLBACK_KEY_STORAGE, created);
  return created;
}

async function deriveAesKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function secureCacheEncode(value: string): Promise<string> {
  const material = await getOrCreateKeyMaterial();
  const key = await deriveAesKey(material);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(payload);
}

export async function secureCacheDecode(value: string): Promise<string | null> {
  try {
    const bytes = base64ToBytes(value);
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    const material = await getOrCreateKeyMaterial();
    const key = await deriveAesKey(material);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

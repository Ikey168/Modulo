// Client-side note encryption (AES-256-GCM via Web Crypto).
//
// This is the foundation of the end-to-end encrypted sharing epic (#243): a
// note is encrypted on the device with a per-note symmetric key before it is
// ever uploaded, so IPFS (and any relay) only ever sees ciphertext. Sharing
// that key with collaborators (wrapping it to their wallet key) is handled
// separately in #239; this module is only the symmetric encrypt/decrypt and
// key handling.

/**
 * Versioned, self-describing envelope for an encrypted note payload.
 * `iv` and `ct` are base64. `ct` includes the GCM authentication tag.
 */
export interface EncryptedEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  iv: string;
  ct: string;
}

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // 96-bit nonce, the recommended size for AES-GCM

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available in this environment');
  }
  return c.subtle;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Generate a fresh, extractable AES-256-GCM key for a single note. */
export async function generateNoteKey(): Promise<CryptoKey> {
  return getSubtle().generateKey(
    { name: ALGORITHM, length: KEY_LENGTH_BITS },
    true, // extractable so it can be exported and (later) wrapped for recipients
    ['encrypt', 'decrypt'],
  );
}

/** Export a key as raw base64 (for storage or, later, wrapping to a recipient). */
export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await getSubtle().exportKey('raw', key);
  return bufferToBase64(raw);
}

/** Import a raw base64 key produced by {@link exportKeyBase64}. */
export async function importKeyBase64(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  return getSubtle().importKey('raw', raw, { name: ALGORITHM }, true, ['encrypt', 'decrypt']);
}

/** Encrypt a UTF-8 string into a self-describing envelope using a random IV. */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedEnvelope> {
  const iv = (globalThis.crypto as Crypto).getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const ct = await getSubtle().encrypt({ name: ALGORITHM, iv }, key, data);
  return {
    v: 1,
    alg: 'AES-256-GCM',
    iv: bufferToBase64(iv.buffer),
    ct: bufferToBase64(ct),
  };
}

/**
 * Decrypt an envelope produced by {@link encryptString}. Throws if the key is
 * wrong or the ciphertext was tampered with (GCM authentication failure).
 */
export async function decryptString(key: CryptoKey, envelope: EncryptedEnvelope): Promise<string> {
  if (envelope?.v !== 1 || envelope.alg !== 'AES-256-GCM') {
    throw new Error(`Unsupported envelope: v=${envelope?.v} alg=${envelope?.alg}`);
  }
  const iv = base64ToBytes(envelope.iv);
  const ct = base64ToBytes(envelope.ct);
  const plaintext = await getSubtle().decrypt({ name: ALGORITHM, iv }, key, ct);
  return new TextDecoder().decode(plaintext);
}

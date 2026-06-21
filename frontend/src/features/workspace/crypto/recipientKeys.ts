// Per-recipient key wrapping for end-to-end encrypted sharing (#239).
//
// A note's symmetric key (see noteCrypto) is "wrapped" (encrypted) to each
// recipient so only they can unwrap it. We use the x25519-xsalsa20-poly1305
// sealed-box scheme (the same primitive MetaMask's eth_decrypt uses), so the
// wrapped blob is interoperable with that format.
//
// Recipient keypair: instead of MetaMask's deprecated eth_getEncryptionPublicKey
// / eth_decrypt RPCs, a recipient derives a stable X25519 keypair from a
// signature over a fixed message (see deriveEncryptionKeyPair). This works with
// any wallet that can sign a message. See
// docs/architecture/adr-0001-encryption-key-derivation.md for the rationale and
// the determinism caveat.

import nacl from 'tweetnacl';

/**
 * A wrapped (recipient-encrypted) symmetric key. Field names/algorithm match
 * MetaMask's EthEncryptedData so the blob is compatible with eth_decrypt.
 */
export interface WrappedKey {
  v: 1;
  alg: 'x25519-xsalsa20-poly1305';
  ephemPublicKey: string; // base64
  nonce: string; // base64
  ciphertext: string; // base64
}

/** An X25519 keypair, base64-encoded. The public key is safe to publish. */
export interface EncryptionKeyPair {
  publicKey: string;
  secretKey: string;
}

/** Message a user signs to derive their encryption keypair. Versioned. */
export const ENCRYPTION_KEY_MESSAGE =
  'Modulo encryption key (v1)\n\n' +
  'Sign to derive the key that lets you read notes shared with you. ' +
  'This is gas-free and only authorizes this app to decrypt your shared notes.';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid hex signature');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Deterministically derive an X25519 keypair from a wallet signature.
 *
 * The same signature always yields the same keypair, so a recipient can
 * re-derive their key on any device. Requires the wallet to produce a
 * deterministic signature for a fixed message (true for MetaMask / RFC-6979
 * ECDSA wallets); see the ADR for the caveat on non-deterministic wallets.
 */
export function deriveEncryptionKeyPair(signatureHex: string): EncryptionKeyPair {
  const sigBytes = hexToBytes(signatureHex);
  if (sigBytes.length === 0) throw new Error('Empty signature');
  // SHA-512 of the signature, truncated to a 32-byte X25519 secret scalar.
  const seed = nacl.hash(sigBytes).slice(0, nacl.box.secretKeyLength);
  const kp = nacl.box.keyPair.fromSecretKey(seed);
  return { publicKey: bytesToBase64(kp.publicKey), secretKey: bytesToBase64(kp.secretKey) };
}

/**
 * Convenience wrapper: ask the wallet to sign {@link ENCRYPTION_KEY_MESSAGE}
 * and derive the keypair. `signPersonalMessage` should call the wallet
 * (e.g. personal_sign) and return the signature hex.
 */
export async function deriveEncryptionKeyPairFromWallet(
  signPersonalMessage: (message: string) => Promise<string>,
): Promise<EncryptionKeyPair> {
  const signature = await signPersonalMessage(ENCRYPTION_KEY_MESSAGE);
  return deriveEncryptionKeyPair(signature);
}

/**
 * Wrap a raw symmetric key (base64, e.g. from noteCrypto.exportKeyBase64) so
 * only the holder of `recipientPublicKeyB64`'s secret key can unwrap it. Uses
 * an ephemeral sender keypair (sealed box), so the wrap reveals no sender.
 */
export function wrapKeyForRecipient(rawKeyB64: string, recipientPublicKeyB64: string): WrappedKey {
  const message = base64ToBytes(rawKeyB64);
  const recipientPublicKey = base64ToBytes(recipientPublicKeyB64);
  if (recipientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error('Invalid recipient public key length');
  }
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(message, nonce, recipientPublicKey, ephemeral.secretKey);
  return {
    v: 1,
    alg: 'x25519-xsalsa20-poly1305',
    ephemPublicKey: bytesToBase64(ephemeral.publicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * Unwrap a {@link WrappedKey} with the recipient's secret key, returning the
 * raw symmetric key (base64). Throws if the key is for someone else or the
 * blob was tampered with (authentication failure).
 */
export function unwrapKey(wrapped: WrappedKey, recipientSecretKeyB64: string): string {
  if (wrapped?.v !== 1 || wrapped.alg !== 'x25519-xsalsa20-poly1305') {
    throw new Error(`Unsupported wrapped key: v=${wrapped?.v} alg=${wrapped?.alg}`);
  }
  const opened = nacl.box.open(
    base64ToBytes(wrapped.ciphertext),
    base64ToBytes(wrapped.nonce),
    base64ToBytes(wrapped.ephemPublicKey),
    base64ToBytes(recipientSecretKeyB64),
  );
  if (!opened) {
    throw new Error('Failed to unwrap key: wrong recipient or tampered data');
  }
  return bytesToBase64(opened);
}

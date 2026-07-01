import { describe, it, expect } from 'vitest';
import {
  WrappedKey,
  deriveEncryptionKeyPair,
  deriveEncryptionKeyPairFromWallet,
  unwrapKey,
  wrapKeyForRecipient,
  ENCRYPTION_KEY_MESSAGE,
} from '../recipientKeys';
import {
  decryptString,
  encryptString,
  exportKeyBase64,
  generateNoteKey,
  importKeyBase64,
} from '../noteCrypto';

// A stand-in deterministic wallet signature (65-byte ECDSA sig as hex).
const SIG_A = '0x' + '11'.repeat(65);
const SIG_B = '0x' + '22'.repeat(65);

describe('recipientKeys: key derivation', () => {
  it('derives a 32-byte X25519 keypair from a signature', () => {
    const kp = deriveEncryptionKeyPair(SIG_A);
    expect(atob(kp.publicKey).length).toBe(32);
    expect(atob(kp.secretKey).length).toBe(32);
  });

  it('is deterministic: same signature -> same keypair', () => {
    expect(deriveEncryptionKeyPair(SIG_A)).toEqual(deriveEncryptionKeyPair(SIG_A));
  });

  it('different signatures -> different keypairs', () => {
    expect(deriveEncryptionKeyPair(SIG_A).publicKey).not.toBe(deriveEncryptionKeyPair(SIG_B).publicKey);
  });

  it('signs the versioned message via the wallet wrapper', async () => {
    let signed: string | undefined;
    const kp = await deriveEncryptionKeyPairFromWallet(async (msg) => {
      signed = msg;
      return SIG_A;
    });
    expect(signed).toBe(ENCRYPTION_KEY_MESSAGE);
    expect(kp).toEqual(deriveEncryptionKeyPair(SIG_A));
  });
});

describe('recipientKeys: wrap / unwrap', () => {
  it('round-trips a raw key to the intended recipient', () => {
    const recipient = deriveEncryptionKeyPair(SIG_A);
    const rawKey = btoa('0123456789abcdef0123456789abcdef'); // 32 bytes

    const wrapped = wrapKeyForRecipient(rawKey, recipient.publicKey);
    expect(wrapped.alg).toBe('x25519-xsalsa20-poly1305');

    expect(unwrapKey(wrapped, recipient.secretKey)).toBe(rawKey);
  });

  it('does not leak the raw key into the wrapped blob', () => {
    const recipient = deriveEncryptionKeyPair(SIG_A);
    const rawKey = btoa('SECRETKEYMATERIAL_SECRETKEYMATER'); // 32 bytes
    const wrapped = wrapKeyForRecipient(rawKey, recipient.publicKey);
    expect(JSON.stringify(wrapped)).not.toContain(rawKey);
  });

  it('uses a fresh ephemeral key + nonce each time', () => {
    const recipient = deriveEncryptionKeyPair(SIG_A);
    const rawKey = btoa('0123456789abcdef0123456789abcdef');
    const a = wrapKeyForRecipient(rawKey, recipient.publicKey);
    const b = wrapKeyForRecipient(rawKey, recipient.publicKey);
    expect(a.ephemPublicKey).not.toBe(b.ephemPublicKey);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('cannot be unwrapped by a different recipient', () => {
    const intended = deriveEncryptionKeyPair(SIG_A);
    const other = deriveEncryptionKeyPair(SIG_B);
    const wrapped = wrapKeyForRecipient(btoa('0123456789abcdef0123456789abcdef'), intended.publicKey);
    expect(() => unwrapKey(wrapped, other.secretKey)).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const recipient = deriveEncryptionKeyPair(SIG_A);
    const wrapped = wrapKeyForRecipient(btoa('0123456789abcdef0123456789abcdef'), recipient.publicKey);
    const bytes = atob(wrapped.ciphertext).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    const tampered: WrappedKey = { ...wrapped, ciphertext: btoa(bytes.join('')) };
    expect(() => unwrapKey(tampered, recipient.secretKey)).toThrow();
  });
});

describe('end-to-end: note encrypted (#238) + key wrapped to recipient (#239)', () => {
  it('owner encrypts a note, recipient unwraps the key and decrypts it', async () => {
    // Owner side: encrypt the note with a per-note key (#238).
    const noteKey = await generateNoteKey();
    const plaintext = 'a note shared with a collaborator';
    const envelope = await encryptString(noteKey, plaintext);
    const rawNoteKey = await exportKeyBase64(noteKey);

    // Recipient publishes a derived X25519 public key (#239).
    const recipient = deriveEncryptionKeyPair(SIG_A);

    // Owner wraps the note key for the recipient.
    const wrapped = wrapKeyForRecipient(rawNoteKey, recipient.publicKey);

    // Recipient unwraps the note key and decrypts the note.
    const unwrappedRaw = unwrapKey(wrapped, recipient.secretKey);
    const recoveredKey = await importKeyBase64(unwrappedRaw);
    expect(await decryptString(recoveredKey, envelope)).toBe(plaintext);
  });
});

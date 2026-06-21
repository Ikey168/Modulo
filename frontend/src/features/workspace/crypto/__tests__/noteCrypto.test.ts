import { describe, it, expect } from 'vitest';
import {
  EncryptedEnvelope,
  decryptString,
  encryptString,
  exportKeyBase64,
  generateNoteKey,
  importKeyBase64,
} from '../noteCrypto';
import { CiphertextStore, encryptAndStore, fetchAndDecrypt } from '../noteSharing';

// In-memory stand-in for IPFS so the full encrypt -> store -> fetch -> decrypt
// round-trip can be exercised without a live node.
class InMemoryStore implements CiphertextStore {
  readonly blobs = new Map<string, string>();
  private seq = 0;

  async put(envelope: EncryptedEnvelope): Promise<string> {
    const cid = `mem-${++this.seq}`;
    this.blobs.set(cid, JSON.stringify(envelope));
    return cid;
  }

  async get(cid: string): Promise<EncryptedEnvelope> {
    const raw = this.blobs.get(cid);
    if (!raw) throw new Error(`not found: ${cid}`);
    return JSON.parse(raw) as EncryptedEnvelope;
  }
}

describe('noteCrypto', () => {
  it('round-trips a string through encrypt/decrypt', async () => {
    const key = await generateNoteKey();
    const plaintext = 'sensitive note body with unicode: café 🔐';
    const env = await encryptString(key, plaintext);

    expect(env.v).toBe(1);
    expect(env.alg).toBe('AES-256-GCM');
    expect(env.iv).toBeTruthy();
    expect(env.ct).toBeTruthy();

    expect(await decryptString(key, env)).toBe(plaintext);
  });

  it('produces a different IV (and thus ciphertext) each time', async () => {
    const key = await generateNoteKey();
    const a = await encryptString(key, 'same input');
    const b = await encryptString(key, 'same input');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('does not leak plaintext into the envelope', async () => {
    const key = await generateNoteKey();
    const plaintext = 'TOP-SECRET-MARKER';
    const env = await encryptString(key, plaintext);
    expect(JSON.stringify(env)).not.toContain(plaintext);
  });

  it('fails to decrypt with the wrong key', async () => {
    const env = await encryptString(await generateNoteKey(), 'hello');
    const otherKey = await generateNoteKey();
    await expect(decryptString(otherKey, env)).rejects.toBeDefined();
  });

  it('rejects tampered ciphertext (GCM authentication)', async () => {
    const key = await generateNoteKey();
    const env = await encryptString(key, 'hello');
    // Flip a byte in the ciphertext.
    const bytes = atob(env.ct).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    const tampered: EncryptedEnvelope = { ...env, ct: btoa(bytes.join('')) };
    await expect(decryptString(key, tampered)).rejects.toBeDefined();
  });

  it('exports and re-imports a key without losing the ability to decrypt', async () => {
    const key = await generateNoteKey();
    const env = await encryptString(key, 'persisted');
    const reimported = await importKeyBase64(await exportKeyBase64(key));
    expect(await decryptString(reimported, env)).toBe('persisted');
  });
});

describe('noteSharing', () => {
  it('round-trips through a content-addressed store', async () => {
    const store = new InMemoryStore();
    const plaintext = 'note that will be uploaded as ciphertext';

    const { cid, keyB64 } = await encryptAndStore(plaintext, store);

    // What is "uploaded" must be opaque ciphertext, not the note.
    expect(store.blobs.get(cid)).not.toContain(plaintext);

    const decrypted = await fetchAndDecrypt(cid, keyB64, store);
    expect(decrypted).toBe(plaintext);
  });
});

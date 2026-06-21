import { describe, it, expect } from 'vitest';
import { EncryptedEnvelope, decryptString, encryptString, generateNoteKey, importKeyBase64 } from '../noteCrypto';
import { CiphertextStore } from '../noteSharing';
import { deriveEncryptionKeyPair, unwrapKey } from '../recipientKeys';
import { RecipientKey, reEncryptAndRewrap } from '../keyRotation';

class InMemoryStore implements CiphertextStore {
  readonly blobs = new Map<string, EncryptedEnvelope>();
  private seq = 0;
  async put(env: EncryptedEnvelope): Promise<string> {
    const cid = `mem-${++this.seq}`;
    this.blobs.set(cid, env);
    return cid;
  }
  async get(cid: string): Promise<EncryptedEnvelope> {
    const env = this.blobs.get(cid);
    if (!env) throw new Error(`not found: ${cid}`);
    return env;
  }
}

const alice = deriveEncryptionKeyPair('0x' + 'a1'.repeat(65));
const bob = deriveEncryptionKeyPair('0x' + 'b2'.repeat(65));
const carol = deriveEncryptionKeyPair('0x' + 'c3'.repeat(65));

const recipientKey = (addr: string, kp: { publicKey: string }): RecipientKey => ({
  address: addr,
  publicKey: kp.publicKey,
});

// Recover the note plaintext the way a recipient would: unwrap the key, then
// fetch + decrypt the ciphertext at `cid`.
async function recipientReads(
  cid: string,
  wrapped: { wrappedKey: import('../recipientKeys').WrappedKey } | undefined,
  secretKeyB64: string,
  store: InMemoryStore,
): Promise<string> {
  if (!wrapped) throw new Error('no wrapped key for this recipient');
  const rawKey = unwrapKey(wrapped.wrappedKey, secretKeyB64);
  const key = await importKeyBase64(rawKey);
  return decryptString(key, await store.get(cid));
}

describe('reEncryptAndRewrap (revocation / key rotation)', () => {
  it('produces a fresh CID and key on each call', async () => {
    const store = new InMemoryStore();
    const recips = [recipientKey('0xA', alice)];
    const a = await reEncryptAndRewrap('content', recips, store);
    const b = await reEncryptAndRewrap('content', recips, store);
    expect(a.cid).not.toBe(b.cid);
    expect(a.noteKeyB64).not.toBe(b.noteKeyB64);
  });

  it('wraps the new key for exactly the recipients provided', async () => {
    const store = new InMemoryStore();
    const result = await reEncryptAndRewrap('content', [recipientKey('0xA', alice), recipientKey('0xB', bob)], store);
    expect(result.wrapped.map((w) => w.address)).toEqual(['0xA', '0xB']);
  });

  it('lets every remaining recipient decrypt the re-encrypted note', async () => {
    const store = new InMemoryStore();
    const plaintext = 'rotated note body';
    const result = await reEncryptAndRewrap(plaintext, [recipientKey('0xA', alice), recipientKey('0xB', bob)], store);

    const forA = result.wrapped.find((w) => w.address === '0xA');
    const forB = result.wrapped.find((w) => w.address === '0xB');
    expect(await recipientReads(result.cid, forA, alice.secretKey, store)).toBe(plaintext);
    expect(await recipientReads(result.cid, forB, bob.secretKey, store)).toBe(plaintext);
  });

  it('revokes carol: she has no wrapped key for the new version', async () => {
    const store = new InMemoryStore();
    // Initially shared with alice, bob, carol; now re-share without carol.
    const remaining = [recipientKey('0xA', alice), recipientKey('0xB', bob)];
    const result = await reEncryptAndRewrap('secret v2', remaining, store);

    expect(result.wrapped.find((w) => w.address === '0xC')).toBeUndefined();
    // Even though carol still holds her own keypair, nothing wraps the new key
    // to her, so she cannot obtain it.
    const carolWrapped = result.wrapped.find((w) => w.address === '0xC');
    await expect(recipientReads(result.cid, carolWrapped, carol.secretKey, store)).rejects.toBeDefined();
  });

  it('the old note key cannot decrypt the new ciphertext', async () => {
    const store = new InMemoryStore();
    // Old version encrypted with an old key.
    const oldKey = await generateNoteKey();
    const oldEnvelope = await encryptString(oldKey, 'v1');
    const oldCid = await store.put(oldEnvelope);

    // Rotate.
    const result = await reEncryptAndRewrap('v2', [recipientKey('0xA', alice)], store);

    // The new ciphertext is a different object and the old key fails on it.
    expect(result.cid).not.toBe(oldCid);
    await expect(decryptString(oldKey, await store.get(result.cid))).rejects.toBeDefined();
  });
});

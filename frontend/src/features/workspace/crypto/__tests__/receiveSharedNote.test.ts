import { describe, it, expect } from 'vitest';
import { EncryptedEnvelope, encryptString, exportKeyBase64, generateNoteKey } from '../noteCrypto';
import { CiphertextStore } from '../noteSharing';
import { WrappedKey, deriveEncryptionKeyPair, wrapKeyForRecipient } from '../recipientKeys';
import { SharedNoteError, SharedNoteSource, openSharedNote } from '../receiveSharedNote';

const SIG_RECIPIENT = '0x' + 'ab'.repeat(65);
const SIG_OTHER = '0x' + 'cd'.repeat(65);

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

/** Minimal on-chain stand-in mirroring NoteSharingContract.getSharedNote. */
class FakeChain implements SharedNoteSource {
  cid = '';
  wrappedByNote = new Map<string | number, WrappedKey>();
  revoked = false;

  async getSharedNote(noteId: string | number) {
    if (this.revoked) throw new Error('revert: No read access');
    const wrappedKey = this.wrappedByNote.get(noteId) ?? null;
    if (!wrappedKey) throw new Error('revert: No read access');
    return { cid: this.cid, wrappedKey };
  }
}

// Sets up an encrypted note shared with `recipientPub`, returns the pieces.
async function setupSharedNote(recipientPublicKey: string) {
  const noteKey = await generateNoteKey();
  const plaintext = 'the decrypted note body';
  const envelope = await encryptString(noteKey, plaintext);
  const rawNoteKey = await exportKeyBase64(noteKey);

  const store = new InMemoryStore();
  const cid = await store.put(envelope);

  const chain = new FakeChain();
  chain.cid = cid;
  chain.wrappedByNote.set(1, wrapKeyForRecipient(rawNoteKey, recipientPublicKey));

  return { store, chain, plaintext };
}

describe('openSharedNote', () => {
  it('lets a granted recipient decrypt the note end-to-end', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { store, chain, plaintext } = await setupSharedNote(recipient.publicKey);

    const result = await openSharedNote(1, recipient.secretKey, chain, store);
    expect(result).toBe(plaintext);
  });

  it('denies a non-grantee with NO_ACCESS', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { store, chain } = await setupSharedNote(recipient.publicKey);

    // A different account asks for a note never shared with them.
    await expect(openSharedNote(99, recipient.secretKey, chain, store)).rejects.toMatchObject({
      code: 'NO_ACCESS',
    });
  });

  it('reports NO_ACCESS after revocation (contract reverts)', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { store, chain } = await setupSharedNote(recipient.publicKey);
    chain.revoked = true;

    await expect(openSharedNote(1, recipient.secretKey, chain, store)).rejects.toMatchObject({
      code: 'NO_ACCESS',
    });
  });

  it('fails with DECRYPT_FAILED when the wrong account tries to unwrap', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const other = deriveEncryptionKeyPair(SIG_OTHER);
    const { store, chain } = await setupSharedNote(recipient.publicKey);

    // Key was wrapped to `recipient`, but `other` presents their secret key.
    await expect(openSharedNote(1, other.secretKey, chain, store)).rejects.toMatchObject({
      code: 'DECRYPT_FAILED',
    });
  });

  it('rejects tampered ciphertext with DECRYPT_FAILED', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { store, chain } = await setupSharedNote(recipient.publicKey);

    // Corrupt the stored ciphertext.
    const env = store.blobs.get(chain.cid)!;
    const bytes = atob(env.ct).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    store.blobs.set(chain.cid, { ...env, ct: btoa(bytes.join('')) });

    await expect(openSharedNote(1, recipient.secretKey, chain, store)).rejects.toMatchObject({
      code: 'DECRYPT_FAILED',
    });
  });

  it('reports IPFS_UNAVAILABLE when the ciphertext cannot be fetched', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { chain } = await setupSharedNote(recipient.publicKey);
    const emptyStore = new InMemoryStore(); // never has the CID

    await expect(openSharedNote(1, recipient.secretKey, chain, emptyStore)).rejects.toMatchObject({
      code: 'IPFS_UNAVAILABLE',
    });
  });

  it('throws a SharedNoteError (categorized) rather than a raw error', async () => {
    const recipient = deriveEncryptionKeyPair(SIG_RECIPIENT);
    const { chain } = await setupSharedNote(recipient.publicKey);
    const emptyStore = new InMemoryStore();

    const err = await openSharedNote(1, recipient.secretKey, chain, emptyStore).catch((e) => e);
    expect(err).toBeInstanceOf(SharedNoteError);
  });
});

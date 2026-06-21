// Recipient decryption flow (#241): given a note shared on-chain, read the CID
// and the wrapped key, unwrap the note key locally, fetch the ciphertext from
// IPFS, and decrypt it. Decryption happens entirely on the device; the
// plaintext is returned to the caller and never persisted here.
//
// Ties together #240 (on-chain CID + wrapped key), #239 (key unwrapping), and
// #238 (ciphertext fetch + AES-GCM decryption).

import { WrappedKey, unwrapKey } from './recipientKeys';
import { CiphertextStore } from './noteSharing';
import { decryptString, importKeyBase64 } from './noteCrypto';

/** What the recipient can read on-chain for a note (see sharingContract). */
export interface SharedNoteSource {
  getSharedNote(noteId: string | number): Promise<{ cid: string; wrappedKey: WrappedKey | null }>;
}

export type SharedNoteErrorCode =
  | 'NO_ACCESS' // not a grantee, or access was revoked
  | 'IPFS_UNAVAILABLE' // CID couldn't be fetched (unpinned/unreachable)
  | 'DECRYPT_FAILED'; // wrong key for this account, or tampered data

/** A categorized failure so the UI can show a clear, specific message. */
export class SharedNoteError extends Error {
  constructor(
    public readonly code: SharedNoteErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SharedNoteError';
  }
}

/**
 * Open a shared note end-to-end.
 *
 * @param noteId               the note's on-chain id
 * @param recipientSecretKeyB64 the recipient's X25519 secret key (base64),
 *                              derived from their wallet signature (#239)
 * @param source               on-chain reader (e.g. NoteSharingContract)
 * @param store                ciphertext store (e.g. IpfsCiphertextStore)
 * @returns the decrypted note plaintext
 */
export async function openSharedNote(
  noteId: string | number,
  recipientSecretKeyB64: string,
  source: SharedNoteSource,
  store: CiphertextStore,
): Promise<string> {
  // 1. Read the CID + this account's wrapped key from chain. A revert here
  //    means the caller has no read access (not a grantee, or revoked).
  let shared: { cid: string; wrappedKey: WrappedKey | null };
  try {
    shared = await source.getSharedNote(noteId);
  } catch (cause) {
    throw new SharedNoteError('NO_ACCESS', 'You do not have access to this note, or it was revoked.', cause);
  }
  if (!shared.wrappedKey) {
    throw new SharedNoteError('NO_ACCESS', 'No key is shared with this account for this note.');
  }
  if (!shared.cid) {
    throw new SharedNoteError('IPFS_UNAVAILABLE', 'This note has no ciphertext reference yet.');
  }

  // 2. Unwrap the note key with the recipient's secret key. A failure means
  //    the wrapped key was not encrypted to this account (or was tampered).
  let rawKeyB64: string;
  try {
    rawKeyB64 = unwrapKey(shared.wrappedKey, recipientSecretKeyB64);
  } catch (cause) {
    throw new SharedNoteError('DECRYPT_FAILED', 'Could not unwrap the note key for this account.', cause);
  }

  // 3. Fetch the ciphertext from IPFS by CID.
  let envelope;
  try {
    envelope = await store.get(shared.cid);
  } catch (cause) {
    throw new SharedNoteError('IPFS_UNAVAILABLE', 'The encrypted note could not be retrieved from IPFS.', cause);
  }

  // 4. Decrypt locally. A failure here is a wrong key or tampered ciphertext
  //    (AES-GCM authentication failure).
  try {
    const key = await importKeyBase64(rawKeyB64);
    return await decryptString(key, envelope);
  } catch (cause) {
    throw new SharedNoteError('DECRYPT_FAILED', 'The note could not be decrypted (wrong key or tampered data).', cause);
  }
}

// Key rotation for revocation / re-sharing (#242).
//
// On-chain data and IPFS objects are public and permanent, so "revoking" a
// recipient cannot retract what they already downloaded. Real revocation is
// therefore cryptographic: rotate to a NEW note key, re-encrypt the note (new
// CID), and re-wrap the new key for the *remaining* recipients only. The
// revoked party keeps no wrapped copy of the new key, so they cannot read any
// future version of the note.
//
// This module produces the new ciphertext + wrapped keys. The caller then
// commits the result on-chain (see the on-chain sequence below) using the
// NoteSharingContract (#240):
//   1. setNoteCid(noteId, result.cid)
//   2. grantAccess(noteId, addr, wrapped)  // for each remaining recipient
//   3. revokeAccess(noteId, revokedAddr)   // for the removed recipient(s)

import { CiphertextStore } from './noteSharing';
import { encryptString, exportKeyBase64, generateNoteKey } from './noteCrypto';
import { WrappedKey, wrapKeyForRecipient } from './recipientKeys';

/** A recipient and the public key the note key should be wrapped to. */
export interface RecipientKey {
  address: string;
  publicKey: string; // X25519 public key (base64)
}

export interface WrappedRecipient {
  address: string;
  wrappedKey: WrappedKey;
}

export interface ReshareResult {
  /** CID of the freshly re-encrypted ciphertext. */
  cid: string;
  /** The new raw note key (base64) for the owner to keep. */
  noteKeyB64: string;
  /** The new note key wrapped for each recipient passed in. */
  wrapped: WrappedRecipient[];
}

/**
 * Re-encrypt a note under a fresh key and wrap that key for the given
 * recipients. To revoke someone, call this with the current recipient list
 * **minus** the revoked address; to add someone, include them.
 *
 * @param plaintext   the current note content to re-encrypt
 * @param recipients  the recipients who should retain (or gain) access
 * @param store       ciphertext store (e.g. IpfsCiphertextStore)
 */
export async function reEncryptAndRewrap(
  plaintext: string,
  recipients: RecipientKey[],
  store: CiphertextStore,
): Promise<ReshareResult> {
  const key = await generateNoteKey();
  const envelope = await encryptString(key, plaintext);
  const cid = await store.put(envelope);
  const noteKeyB64 = await exportKeyBase64(key);

  const wrapped = recipients.map((recipient) => ({
    address: recipient.address,
    wrappedKey: wrapKeyForRecipient(noteKeyB64, recipient.publicKey),
  }));

  return { cid, noteKeyB64, wrapped };
}

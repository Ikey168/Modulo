// Frontend wiring for the on-chain encrypted-sharing functions added to
// NoteRegistryWithAccessControl (#240): set the ciphertext CID, grant/revoke a
// recipient's wrapped key, and read a recipient's CID + wrapped key.
//
// The per-recipient wrapped key (see recipientKeys.WrappedKey) is stored
// on-chain as opaque bytes; encode/decode map the envelope to/from those bytes.
//
// NOTE: this targets the NoteRegistryWithAccessControl contract. The app
// currently wires the simpler NoteRegistry (services/blockchain.ts); switching
// over needs the access-control contract's deployed address per network, which
// is deployment config tracked alongside the recipient flow (#241).

import { ethers } from 'ethers';
import { WrappedKey } from './recipientKeys';

/** Minimal ABI for the encrypted-sharing functions and events. */
export const NOTE_SHARING_ABI = [
  'function setNoteCid(uint256 noteId, string cid)',
  'function grantAccess(uint256 noteId, address grantee, bytes wrappedKey)',
  'function revokeAccess(uint256 noteId, address grantee)',
  'function getSharedNote(uint256 noteId) view returns (string cid, bytes wrappedKey)',
  'function getWrappedKey(uint256 noteId, address grantee) view returns (bytes)',
  'event AccessGranted(uint256 indexed noteId, address indexed grantee, address indexed granter, uint256 timestamp)',
  'event AccessRevoked(uint256 indexed noteId, address indexed grantee, address indexed revoker, uint256 timestamp)',
  'event NoteCidSet(uint256 indexed noteId, string cid, uint256 timestamp)',
];

/** Encode a wrapped-key envelope as the on-chain `bytes` value. */
export function encodeWrappedKey(wrapped: WrappedKey): string {
  return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(JSON.stringify(wrapped)));
}

/** Decode an on-chain `bytes` value back into a wrapped-key envelope. */
export function decodeWrappedKey(bytesHex: string): WrappedKey {
  if (!bytesHex || bytesHex === '0x') {
    throw new Error('No wrapped key stored on-chain for this recipient');
  }
  return JSON.parse(ethers.utils.toUtf8String(bytesHex)) as WrappedKey;
}

export interface SharedNoteView {
  /** IPFS CID of the note's ciphertext. */
  cid: string;
  /** The note key wrapped to the caller, or null (e.g. the owner has none). */
  wrappedKey: WrappedKey | null;
}

/** Thin typed wrapper over the on-chain sharing functions. */
export class NoteSharingContract {
  private readonly contract: ethers.Contract;

  constructor(address: string, signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    this.contract = new ethers.Contract(address, NOTE_SHARING_ABI, signerOrProvider);
  }

  /** Owner: set/update the note's ciphertext CID. */
  async setNoteCid(noteId: ethers.BigNumberish, cid: string): Promise<void> {
    const tx = await this.contract.setNoteCid(noteId, cid);
    await tx.wait();
  }

  /** Owner/admin: grant a recipient access by storing their wrapped key. */
  async grantAccess(noteId: ethers.BigNumberish, grantee: string, wrapped: WrappedKey): Promise<void> {
    const tx = await this.contract.grantAccess(noteId, grantee, encodeWrappedKey(wrapped));
    await tx.wait();
  }

  /** Owner/admin: revoke a recipient's access (drops their wrapped key). */
  async revokeAccess(noteId: ethers.BigNumberish, grantee: string): Promise<void> {
    const tx = await this.contract.revokeAccess(noteId, grantee);
    await tx.wait();
  }

  /** Recipient/owner: read the CID and (for a recipient) the wrapped key. */
  async getSharedNote(noteId: ethers.BigNumberish): Promise<SharedNoteView> {
    const res = await this.contract.getSharedNote(noteId);
    const wrappedKeyBytes: string = res.wrappedKey;
    const wrappedKey = wrappedKeyBytes && wrappedKeyBytes !== '0x' ? decodeWrappedKey(wrappedKeyBytes) : null;
    return { cid: res.cid, wrappedKey };
  }
}

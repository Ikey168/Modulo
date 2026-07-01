// Orchestrates "encrypt locally -> store ciphertext -> fetch -> decrypt" on top
// of the symmetric primitives in noteCrypto. Storage is abstracted behind
// CiphertextStore so the flow can be unit-tested with an in-memory store and
// run against IPFS in the app. Part of the encrypted-sharing epic (#243).

import {
  EncryptedEnvelope,
  decryptString,
  encryptString,
  exportKeyBase64,
  generateNoteKey,
  importKeyBase64,
} from './noteCrypto';

/** A content-addressed store for opaque encrypted envelopes. */
export interface CiphertextStore {
  /** Persist an envelope and return its content identifier (CID). */
  put(envelope: EncryptedEnvelope): Promise<string>;
  /** Retrieve an envelope by CID. */
  get(cid: string): Promise<EncryptedEnvelope>;
}

export interface EncryptResult {
  /** Content identifier of the stored ciphertext. */
  cid: string;
  /**
   * Raw note key, base64. INTERIM: the caller is responsible for keeping this
   * so the note can be decrypted later. #239 replaces this by wrapping the key
   * to each recipient's wallet key and delivering it via the contract; until
   * then this is effectively "shared with self".
   */
  keyB64: string;
}

/** Generate a key, encrypt the plaintext, and store the ciphertext. */
export async function encryptAndStore(plaintext: string, store: CiphertextStore): Promise<EncryptResult> {
  const key = await generateNoteKey();
  const envelope = await encryptString(key, plaintext);
  const cid = await store.put(envelope);
  const keyB64 = await exportKeyBase64(key);
  return { cid, keyB64 };
}

/** Fetch the ciphertext for a CID and decrypt it with the given raw key. */
export async function fetchAndDecrypt(cid: string, keyB64: string, store: CiphertextStore): Promise<string> {
  const envelope = await store.get(cid);
  const key = await importKeyBase64(keyB64);
  return decryptString(key, envelope);
}

/**
 * CiphertextStore backed by the backend IPFS relay. The backend uploads/serves
 * the envelope as an opaque blob and never has the key, so it cannot read the
 * note. Requires an IPFS node to be configured for the backend.
 */
export class IpfsCiphertextStore implements CiphertextStore {
  constructor(private readonly baseUrl: string = '/api/ipfs') {}

  async put(envelope: EncryptedEnvelope): Promise<string> {
    const res = await fetch(`${this.baseUrl}/encrypted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // The envelope is serialized to a string the backend treats as opaque.
      body: JSON.stringify({ ciphertext: JSON.stringify(envelope) }),
    });
    if (!res.ok) {
      throw new Error(`IPFS upload failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data?.cid) {
      throw new Error('IPFS upload response missing cid');
    }
    return data.cid as string;
  }

  async get(cid: string): Promise<EncryptedEnvelope> {
    const res = await fetch(`${this.baseUrl}/encrypted/${encodeURIComponent(cid)}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`IPFS fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return JSON.parse(data.ciphertext as string) as EncryptedEnvelope;
  }
}

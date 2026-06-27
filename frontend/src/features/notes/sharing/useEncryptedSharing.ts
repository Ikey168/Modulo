import { useState, useCallback } from 'react';
import { deriveEncryptionKeyPairFromWallet, wrapKeyForRecipient, EncryptionKeyPair } from '../../workspace/crypto/recipientKeys';
import { encryptAndStore, IpfsCiphertextStore } from '../../workspace/crypto/noteSharing';
import { reEncryptAndRewrap } from '../../workspace/crypto/keyRotation';
import { NoteSharingContract } from '../../workspace/crypto/sharingContract';

// Use type assertion when accessing window.ethereum to avoid conflicts with global declarations
type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; selectedAddress?: string };
function getEthereum(): EthereumProvider | undefined { return (window as unknown as { ethereum?: EthereumProvider }).ethereum; }

const IPFS_STORE = new IpfsCiphertextStore('/api/ipfs');
const CONTRACT_ADDRESS = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_NOTE_SHARING_CONTRACT ?? '';

export type EncSharingStatus = 'idle' | 'deriving-key' | 'encrypting' | 'sharing' | 'revoking' | 'ready' | 'error';

export interface Recipient {
  address: string;
  publicKey: string;
}

export interface UseEncryptedSharingResult {
  status: EncSharingStatus;
  error: string | null;
  keyPair: EncryptionKeyPair | null;
  /** Derive encryption keypair from wallet signature */
  deriveKey: () => Promise<void>;
  /** Encrypt a note and share with recipients via on-chain contract */
  shareNote: (noteId: number, content: string, recipients: Recipient[]) => Promise<void>;
  /** Re-encrypt and revoke one recipient */
  revokeRecipient: (noteId: number, content: string, remainingRecipients: Recipient[], revokedAddress: string) => Promise<void>;
}

export function useEncryptedSharing(): UseEncryptedSharingResult {
  const [status, setStatus] = useState<EncSharingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [keyPair, setKeyPair] = useState<EncryptionKeyPair | null>(null);

  const contract = useCallback((): NoteSharingContract | null => {
    const eth = getEthereum();
    if (!CONTRACT_ADDRESS || !eth) return null;
    const { ethers } = require('ethers') as typeof import('ethers');
    const provider = new ethers.providers.Web3Provider(eth as never);
    return new NoteSharingContract(CONTRACT_ADDRESS, provider.getSigner());
  }, []);

  const deriveKey = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) { setError('No wallet detected. Install MetaMask or a compatible wallet.'); return; }
    setStatus('deriving-key');
    setError(null);
    try {
      const signPersonalMessage = async (msg: string) => {
        const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[];
        return eth.request({ method: 'personal_sign', params: [msg, accounts[0]] }) as Promise<string>;
      };
      const kp = await deriveEncryptionKeyPairFromWallet(signPersonalMessage);
      setKeyPair(kp);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to derive encryption key');
      setStatus('error');
    }
  }, []);

  const shareNote = useCallback(async (noteId: number, content: string, recipients: Recipient[]) => {
    const c = contract();
    if (!c) { setError('Contract not configured or wallet unavailable'); return; }

    setStatus('encrypting');
    setError(null);
    try {
      // 1. Encrypt + upload to IPFS
      const { cid, keyB64 } = await encryptAndStore(content, IPFS_STORE);

      setStatus('sharing');
      // 2. Set CID on-chain
      await c.setNoteCid(noteId, cid);

      // 3. Wrap the note key for each recipient and grant on-chain
      for (const r of recipients) {
        const wrapped = wrapKeyForRecipient(keyB64, r.publicKey);
        await c.grantAccess(noteId, r.address, wrapped);
      }
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to share note');
      setStatus('error');
    }
  }, [contract]);

  const revokeRecipient = useCallback(async (
    noteId: number,
    content: string,
    remainingRecipients: Recipient[],
    revokedAddress: string,
  ) => {
    const c = contract();
    if (!c) { setError('Contract not configured or wallet unavailable'); return; }

    setStatus('revoking');
    setError(null);
    try {
      // Re-encrypt under a new key; only remaining recipients get the new wrapped key
      const result = await reEncryptAndRewrap(content, remainingRecipients, IPFS_STORE);
      await c.setNoteCid(noteId, result.cid);
      for (const w of result.wrapped) {
        await c.grantAccess(noteId, w.address, w.wrappedKey);
      }
      await c.revokeAccess(noteId, revokedAddress);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke access');
      setStatus('error');
    }
  }, [contract]);

  return { status, error, keyPair, deriveKey, shareNote, revokeRecipient };
}

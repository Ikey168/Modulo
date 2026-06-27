import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { deriveEncryptionKeyPairFromWallet } from '../../workspace/crypto/recipientKeys';
import { IpfsCiphertextStore } from '../../workspace/crypto/noteSharing';
import { NoteSharingContract } from '../../workspace/crypto/sharingContract';
import { SharedNoteView } from '../../workspace/crypto/SharedNoteView';
import { useSharedNote } from '../../workspace/crypto/useSharedNote';

type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEth(): EthProvider | undefined { return (window as unknown as { ethereum?: EthProvider }).ethereum; }

const CONTRACT_ADDRESS = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_NOTE_SHARING_CONTRACT ?? '';
const IPFS_STORE = new IpfsCiphertextStore('/api/ipfs');

const SharedNotePage: React.FC = () => {
  const { noteId } = useParams<{ noteId: string }>();
  const [secretKeyB64, setSecretKeyB64] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const source = CONTRACT_ADDRESS
    ? (() => {
        try {
          const eth = getEth();
          if (!eth) return null;
          const { ethers } = require('ethers') as typeof import('ethers');
          const provider = new ethers.providers.Web3Provider(eth as never);
          return new NoteSharingContract(CONTRACT_ADDRESS, provider);
        } catch { return null; }
      })()
    : null;

  const sharedNote = useSharedNote(noteId ?? null, secretKeyB64, source, IPFS_STORE);

  const handleConnect = async () => {
    const eth = getEth();
    if (!eth) { setWalletError('No wallet detected. Install MetaMask or a compatible wallet.'); return; }
    setDeriving(true);
    setWalletError(null);
    try {
      const sign = async (msg: string) => {
        const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[];
        return eth.request({ method: 'personal_sign', params: [msg, accounts[0]] }) as Promise<string>;
      };
      const kp = await deriveEncryptionKeyPairFromWallet(sign);
      setSecretKeyB64(kp.secretKey);
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setDeriving(false);
    }
  };

  if (!CONTRACT_ADDRESS) {
    return (
      <div style={pageStyle}>
        <p style={{ color: '#6b7280' }}>Encrypted sharing is not configured in this deployment.</p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>Shared Note</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          This note is end-to-end encrypted. Connect the wallet address that was granted access to read it.
        </p>
      </header>

      {!secretKeyB64 ? (
        <div>
          {walletError && <p style={{ color: '#ef4444', marginBottom: '12px', fontSize: '13px' }}>{walletError}</p>}
          <button
            onClick={handleConnect}
            disabled={deriving}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: deriving ? 'not-allowed' : 'pointer',
              opacity: deriving ? 0.6 : 1,
            }}
          >
            {deriving ? 'Signing with wallet…' : 'Connect wallet to decrypt'}
          </button>
        </div>
      ) : (
        <SharedNoteView state={sharedNote} />
      )}
    </div>
  );
};

const pageStyle: React.CSSProperties = {
  maxWidth: '720px',
  margin: '64px auto',
  padding: '0 16px',
  fontFamily: 'Georgia, serif',
  lineHeight: '1.7',
  color: '#111',
};

export default SharedNotePage;

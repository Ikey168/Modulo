import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Wallet } from 'lucide-react';
import { Button } from '@/ui';
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
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-[13px] text-muted-foreground">Encrypted sharing is not configured in this deployment.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto w-full max-w-[720px] animate-fade-up">
        <header className="mb-8">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock className="size-5" />
          </div>
          <h1 className="m-0 mb-2 text-2xl font-semibold tracking-tight text-foreground">Shared Note</h1>
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            This note is end-to-end encrypted. Connect the wallet address that was granted access to read it.
          </p>
        </header>

        {!secretKeyB64 ? (
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            {walletError && <p className="mb-3 text-[13px] text-destructive">{walletError}</p>}
            <Button onClick={handleConnect} disabled={deriving} loading={deriving} size="lg">
              {!deriving && <Wallet />}
              {deriving ? 'Signing with wallet…' : 'Connect wallet to decrypt'}
            </Button>
          </div>
        ) : (
          <SharedNoteView state={sharedNote} />
        )}
      </div>
    </div>
  );
};

export default SharedNotePage;

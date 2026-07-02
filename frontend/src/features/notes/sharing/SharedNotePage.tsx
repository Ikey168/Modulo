import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Lock, ShieldOff, Wallet } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Separator,
  Skeleton,
} from '@/ui';
import { deriveEncryptionKeyPairFromWallet } from '../../workspace/crypto/recipientKeys';
import { IpfsCiphertextStore } from '../../workspace/crypto/noteSharing';
import { NoteSharingContract } from '../../workspace/crypto/sharingContract';
import { useSharedNote, UseSharedNoteResult } from '../../workspace/crypto/useSharedNote';
import type { SharedNoteErrorCode } from '../../workspace/crypto/receiveSharedNote';
import { NoteMarkdown } from '../rendering/NoteMarkdown';

type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEth(): EthProvider | undefined { return (window as unknown as { ethereum?: EthProvider }).ethereum; }

const CONTRACT_ADDRESS = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_NOTE_SHARING_CONTRACT ?? '';
const IPFS_STORE = new IpfsCiphertextStore('/api/ipfs');

const ERROR_MESSAGES: Record<SharedNoteErrorCode, string> = {
  NO_ACCESS: 'You do not have access to this note, or it was revoked.',
  IPFS_UNAVAILABLE: 'The encrypted note is currently unavailable. Please try again later.',
  DECRYPT_FAILED: 'This note could not be decrypted on this account.',
};

/** Loading / error / content states for the decrypted note. */
const SharedNoteContent: React.FC<{ state: UseSharedNoteResult }> = ({ state }) => {
  const { status, plaintext, error, reload } = state;

  if (status === 'idle') {
    // Hook inputs (contract source / note id) aren't ready yet.
    return (
      <p className="m-0 text-[13px] text-muted-foreground">
        Waiting for the sharing contract — make sure your wallet is connected to the right network.
      </p>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Decrypting note">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (status === 'error') {
    const message = error ? ERROR_MESSAGES[error.code] ?? error.message : 'Something went wrong.';
    // Revocation / no-access isn't retryable; transient failures are.
    const retryable = error?.code !== 'NO_ACCESS';
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not open this note</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3 text-[13px]">
          {message}
          {retryable && (
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Decrypted plaintext renders through the sanitized markdown pipeline
  // (react-markdown never injects raw HTML — see rendering/NoteMarkdown).
  return (
    <article aria-label="Shared note content">
      <NoteMarkdown content={plaintext ?? ''} />
    </article>
  );
};

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
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <EmptyState
              icon={<ShieldOff />}
              title="Encrypted sharing unavailable"
              description="Encrypted sharing is not configured in this deployment."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto w-full max-w-[720px] animate-fade-up">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl tracking-tight">Shared Note</CardTitle>
            <CardDescription className="text-[13px] leading-relaxed">
              This note is end-to-end encrypted. Connect the wallet address that was granted
              access to read it.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            {!secretKeyB64 ? (
              <div className="flex flex-col items-start gap-4">
                {walletError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Wallet connection failed</AlertTitle>
                    <AlertDescription className="text-[13px]">{walletError}</AlertDescription>
                  </Alert>
                )}
                <Button onClick={handleConnect} disabled={deriving} loading={deriving} size="lg">
                  {!deriving && <Wallet />}
                  {deriving ? 'Signing with wallet…' : 'Connect wallet to decrypt'}
                </Button>
              </div>
            ) : (
              <SharedNoteContent state={sharedNote} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SharedNotePage;

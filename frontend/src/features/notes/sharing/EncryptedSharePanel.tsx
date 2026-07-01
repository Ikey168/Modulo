import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { Button, Input, cn } from '@/ui';
import { useEncryptedSharing, Recipient } from './useEncryptedSharing';

interface Props {
  noteId: number;
  content: string;
}

const CONTRACT_CONFIGURED = !!(import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_NOTE_SHARING_CONTRACT;

const EncryptedSharePanel: React.FC<Props> = ({ noteId, content }) => {
  const { status, error, keyPair, deriveKey, shareNote, revokeRecipient } = useEncryptedSharing();
  const [open, setOpen] = useState(false);
  const [recipientAddr, setRecipientAddr] = useState('');
  const [recipientPubKey, setRecipientPubKey] = useState('');
  const [sharedWith, setSharedWith] = useState<Recipient[]>([]);

  if (!CONTRACT_CONFIGURED) return null;

  const handleShare = async () => {
    if (!recipientAddr.trim() || !recipientPubKey.trim()) return;
    const r: Recipient = { address: recipientAddr.trim(), publicKey: recipientPubKey.trim() };
    await shareNote(noteId, content, [...sharedWith, r]);
    setSharedWith(prev => [...prev, r]);
    setRecipientAddr('');
    setRecipientPubKey('');
  };

  const handleRevoke = async (addr: string) => {
    const remaining = sharedWith.filter(r => r.address !== addr);
    await revokeRecipient(noteId, content, remaining, addr);
    setSharedWith(remaining);
  };

  const busy = ['encrypting', 'sharing', 'revoking', 'deriving-key'].includes(status);

  return (
    <div className="mt-2">
      <Button
        onClick={() => setOpen(v => !v)}
        variant={open ? 'outline' : 'secondary'}
        size="sm"
        className={cn(open && 'border-primary text-primary')}
      >
        <Lock />
        E2E encrypted share
      </Button>

      {open && (
        <div className="mt-2 animate-fade-in rounded-lg border border-border bg-surface p-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">End-to-end encrypted sharing</h4>
          <p className="mb-3 mt-0 text-xs text-muted-foreground">
            Encrypts the note locally. Only recipients with matching wallet keys can decrypt it.
            The server never sees the plaintext.
          </p>

          {!keyPair ? (
            <Button onClick={deriveKey} disabled={busy} loading={status === 'deriving-key'}>
              {status === 'deriving-key' ? 'Signing…' : 'Connect wallet & derive key'}
            </Button>
          ) : (
            <>
              <p className="mb-3 mt-0 flex items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5" />
                Encryption key ready (public key: {keyPair.publicKey.slice(0, 12)}…)
              </p>

              <div className="mb-3 flex flex-col gap-2">
                <Input
                  value={recipientAddr}
                  onChange={e => setRecipientAddr(e.target.value)}
                  placeholder="Recipient wallet address (0x…)"
                />
                <Input
                  value={recipientPubKey}
                  onChange={e => setRecipientPubKey(e.target.value)}
                  placeholder="Recipient X25519 public key (base64)"
                  className="font-mono text-[11px]"
                />
                <Button
                  onClick={handleShare}
                  disabled={busy || !recipientAddr.trim() || !recipientPubKey.trim()}
                  loading={status === 'encrypting' || status === 'sharing'}
                  className="self-start"
                >
                  {status === 'encrypting' ? 'Encrypting…' : status === 'sharing' ? 'Sharing on-chain…' : 'Encrypt & share'}
                </Button>
              </div>

              {sharedWith.length > 0 && (
                <div>
                  <p className="m-0 mb-1.5 text-xs font-semibold text-foreground">Shared with:</p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {sharedWith.map(r => (
                      <li key={r.address} className="flex items-center gap-2 font-mono text-xs text-subtle-foreground">
                        <span className="flex-1 overflow-hidden text-ellipsis">{r.address}</span>
                        <Button
                          onClick={() => handleRevoke(r.address)}
                          disabled={busy}
                          size="sm"
                          variant="outline"
                          className="h-6 border-destructive/40 px-2 font-sans text-[11px] text-destructive hover:bg-destructive/15"
                        >
                          {status === 'revoking' ? 'Revoking…' : 'Revoke'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <p className="m-0 mt-2 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default EncryptedSharePanel;

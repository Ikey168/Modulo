import React, { useState } from 'react';
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
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 12px',
          fontSize: '12px',
          background: open ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--color-surface-raised, #f3f4f6)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        🔐 E2E encrypted share
      </button>

      {open && (
        <div style={{ marginTop: '8px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '8px', padding: '16px', background: 'var(--color-surface, #fff)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>End-to-end encrypted sharing</h4>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)', margin: '0 0 12px' }}>
            Encrypts the note locally. Only recipients with matching wallet keys can decrypt it.
            The server never sees the plaintext.
          </p>

          {!keyPair ? (
            <button
              onClick={deriveKey}
              disabled={busy}
              style={{ padding: '7px 14px', fontSize: '13px', background: 'var(--color-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}
            >
              {status === 'deriving-key' ? 'Signing…' : 'Connect wallet & derive key'}
            </button>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: '#16a34a', margin: '0 0 12px' }}>
                ✓ Encryption key ready (public key: {keyPair.publicKey.slice(0, 12)}…)
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <input
                  value={recipientAddr}
                  onChange={e => setRecipientAddr(e.target.value)}
                  placeholder="Recipient wallet address (0x…)"
                  style={{ padding: '7px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '6px', fontSize: '13px' }}
                />
                <input
                  value={recipientPubKey}
                  onChange={e => setRecipientPubKey(e.target.value)}
                  placeholder="Recipient X25519 public key (base64)"
                  style={{ padding: '7px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleShare}
                  disabled={busy || !recipientAddr.trim() || !recipientPubKey.trim()}
                  style={{ padding: '7px 14px', fontSize: '13px', background: 'var(--color-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: busy ? 0.5 : 1, alignSelf: 'flex-start' }}
                >
                  {status === 'encrypting' ? 'Encrypting…' : status === 'sharing' ? 'Sharing on-chain…' : 'Encrypt & share'}
                </button>
              </div>

              {sharedWith.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 6px' }}>Shared with:</p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {sharedWith.map(r => (
                      <li key={r.address} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</span>
                        <button
                          onClick={() => handleRevoke(r.address)}
                          disabled={busy}
                          style={{ padding: '2px 8px', fontSize: '11px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontFamily: 'sans-serif' }}
                        >
                          {status === 'revoking' ? 'Revoking…' : 'Revoke'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '8px 0 0' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default EncryptedSharePanel;

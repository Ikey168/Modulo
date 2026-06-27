import React, { useState, useEffect, useCallback } from 'react';
import { shareApi, ShareTokenInfo, CreateShareRequest } from './shareApi';

interface Props {
  noteId: number;
  userId: string;
}

const ShareLinkManager: React.FC<Props> = ({ noteId, userId }) => {
  const [tokens, setTokens] = useState<ShareTokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateShareRequest>({ expiresInHours: undefined, password: '' });
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTokens(await shareApi.list(noteId, userId)); }
    catch { setError('Failed to load share links'); }
    finally { setLoading(false); }
  }, [noteId, userId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const req: CreateShareRequest = {};
      if (form.expiresInHours && form.expiresInHours > 0) req.expiresInHours = form.expiresInHours;
      if (form.password?.trim()) req.password = form.password.trim();
      const token = await shareApi.create(noteId, req, userId);
      setTokens(prev => [token, ...prev]);
      setForm({ expiresInHours: undefined, password: '' });
    } catch {
      setError('Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: number) => {
    await shareApi.revoke(tokenId, userId);
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, revoked: true, active: false } : t));
  };

  const copyLink = (token: ShareTokenInfo) => {
    navigator.clipboard.writeText(shareApi.publicUrl(token.token));
    setCopied(token.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ marginTop: '16px' }}>
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
        🔗 Share links {tokens.filter(t => t.active).length > 0 && `(${tokens.filter(t => t.active).length} active)`}
      </button>

      {open && (
        <div style={{
          marginTop: '8px',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '8px',
          padding: '16px',
          background: 'var(--color-surface, #fff)',
        }}>
          {/* Create form */}
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Create public share link</h4>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}>Expires in (hours)</label>
              <input
                type="number"
                min={1}
                placeholder="Never"
                value={form.expiresInHours ?? ''}
                onChange={e => setForm(p => ({ ...p, expiresInHours: e.target.value ? Number(e.target.value) : undefined }))}
                style={{ width: '100px', padding: '6px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}>Password (optional)</label>
              <input
                type="password"
                placeholder="No password"
                value={form.password ?? ''}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ width: '140px', padding: '6px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  background: 'var(--color-primary, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  opacity: creating ? 0.5 : 1,
                }}
              >
                {creating ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 8px' }}>{error}</p>}

          {/* Token list */}
          {loading ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>Loading…</p>
          ) : tokens.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>No share links yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tokens.map(t => (
                <li key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: t.active ? 'var(--color-surface-raised, #f9fafb)' : '#f3f4f6',
                  borderRadius: '6px',
                  opacity: t.active ? 1 : 0.5,
                  fontSize: '13px',
                }}>
                  <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shareApi.publicUrl(t.token)}
                  </span>
                  {t.hasPassword && <span title="Password protected" style={{ fontSize: '14px' }}>🔒</span>}
                  {t.expiresAt && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', whiteSpace: 'nowrap' }}>
                      exp. {new Date(t.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  {t.revoked && <span style={{ fontSize: '11px', color: '#ef4444' }}>Revoked</span>}
                  {!t.revoked && t.active && (
                    <>
                      <button
                        onClick={() => copyLink(t)}
                        style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px', cursor: 'pointer', background: 'var(--color-surface, #fff)', whiteSpace: 'nowrap' }}
                      >
                        {copied === t.id ? '✓ Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRevoke(t.id)}
                        style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', background: '#fef2f2', color: '#ef4444', whiteSpace: 'nowrap' }}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ShareLinkManager;

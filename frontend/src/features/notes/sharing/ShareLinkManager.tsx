import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Lock, Check } from 'lucide-react';
import { Button, Input, Label, Badge, cn, useToast } from '@/ui';
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
  const { toast } = useToast();

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
    try {
      await shareApi.revoke(tokenId, userId);
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, revoked: true, active: false } : t));
    } catch {
      toast({ variant: 'destructive', title: 'Failed to revoke share link', description: 'Please try again.' });
    }
  };

  const copyLink = async (token: ShareTokenInfo) => {
    try {
      await navigator.clipboard.writeText(shareApi.publicUrl(token.token));
      setCopied(token.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy link to clipboard' });
    }
  };

  const activeCount = tokens.filter(t => t.active).length;

  return (
    <div className="mt-4">
      <Button
        onClick={() => setOpen(v => !v)}
        variant={open ? 'outline' : 'secondary'}
        size="sm"
        className={cn(open && 'border-primary text-primary')}
      >
        <Link2 />
        Share links {activeCount > 0 && `(${activeCount} active)`}
      </Button>

      {open && (
        <div className="mt-2 animate-fade-in rounded-lg border border-border bg-surface p-4">
          {/* Create form */}
          <h4 className="m-0 mb-3 text-sm font-semibold text-foreground">Create public share link</h4>

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div>
              <Label className="mb-1 block text-[11px]">Expires in (hours)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Never"
                value={form.expiresInHours ?? ''}
                onChange={e => setForm(p => ({ ...p, expiresInHours: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-[100px]"
              />
            </div>
            <div>
              <Label className="mb-1 block text-[11px]">Password (optional)</Label>
              <Input
                type="password"
                placeholder="No password"
                value={form.password ?? ''}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-[140px]"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} loading={creating}>
              {creating ? 'Creating…' : 'Create link'}
            </Button>
          </div>

          {error && <p className="m-0 mb-2 text-xs text-destructive">{error}</p>}

          {/* Token list */}
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground">No share links yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tokens.map(t => (
                <li
                  key={t.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]',
                    t.active ? 'bg-surface-2' : 'bg-surface-3 opacity-50',
                  )}
                >
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-subtle-foreground">
                    {shareApi.publicUrl(t.token)}
                  </span>
                  {t.hasPassword && (
                    <span title="Password protected" className="text-muted-foreground">
                      <Lock className="size-3.5" />
                    </span>
                  )}
                  {t.expiresAt && (
                    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                      exp. {new Date(t.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  {t.revoked && <Badge variant="destructive">Revoked</Badge>}
                  {!t.revoked && t.active && (
                    <>
                      <Button
                        onClick={() => copyLink(t)}
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                      >
                        {copied === t.id ? (
                          <>
                            <Check className="size-3" />
                            Copied
                          </>
                        ) : 'Copy'}
                      </Button>
                      <Button
                        onClick={() => handleRevoke(t.id)}
                        size="sm"
                        variant="outline"
                        className="h-6 border-destructive/40 px-2 text-[11px] text-destructive hover:bg-destructive/15"
                      >
                        Revoke
                      </Button>
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

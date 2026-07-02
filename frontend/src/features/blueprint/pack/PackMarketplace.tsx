import { useEffect, useState } from 'react';
import { Button, Badge, cn } from '@/ui';
import { listPublishedPacks, installPackFromCid, type PackEntry } from './packService';
import { metaMaskService } from '../../../services/metamask';

/**
 * Marketplace panel that discovers IPFS-published packs and lets the user
 * install them with one click. Embedded in the workspace Marketplace view.
 */
export default function PackMarketplace() {
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    listPublishedPacks()
      .then(setPacks)
      .catch(() => setError('Failed to load published packs'))
      .finally(() => setLoading(false));
  }, []);

  async function handleInstall(pack: PackEntry) {
    if (!pack.ipfsCid) return;
    setInstalling(pack.packId);
    setInstallErrors(prev => { const n = { ...prev }; delete n[pack.packId]; return n; });
    try {
      // Premium packs need the buyer's wallet address so the backend can verify
      // an on-chain purchase entitlement before installing.
      let buyerAddress: string | undefined;
      if (pack.premium) {
        const account = await metaMaskService.getCurrentAccount();
        buyerAddress = account?.walletAddress;
        if (!buyerAddress) {
          setInstallErrors(prev => ({ ...prev, [pack.packId]: 'Connect your wallet to buy this pack' }));
          return;
        }
      }
      const result = await installPackFromCid(pack.ipfsCid, pack.contentHash ?? undefined, buyerAddress);
      if (result.ok) {
        setInstalled(prev => new Set([...prev, pack.packId]));
      } else {
        setInstallErrors(prev => ({ ...prev, [pack.packId]: result.reason ?? 'Install failed' }));
      }
    } catch {
      setInstallErrors(prev => ({ ...prev, [pack.packId]: 'Network error' }));
    } finally {
      setInstalling(null);
    }
  }

  if (loading) return <div className="py-3 text-[13px] text-muted-foreground">Loading packs…</div>;
  if (error) return <div className="py-3 text-[13px] text-destructive">{error}</div>;
  if (packs.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="mb-4">
        <h2 className="m-0 mb-1 text-[1.1rem] font-semibold text-foreground">Packs</h2>
        <p className="m-0 text-xs text-muted-foreground">Community-published blueprint packs distributed via IPFS</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {packs.map(pack => {
          const isInstalled = installed.has(pack.packId) || pack.source === 'IPFS';
          const isInstalling = installing === pack.packId;
          const err = installErrors[pack.packId];
          return (
            <div
              key={pack.packId}
              className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-2 text-sm font-semibold text-primary-hover">
                  {(pack.name ?? pack.packId).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground">{pack.name ?? pack.packId}</div>
                  <div className="text-[11px] text-muted-foreground">{pack.manifest?.author ?? 'Unknown author'}</div>
                </div>
                <Button
                  variant={isInstalled ? 'outline' : 'primary'}
                  size="sm"
                  className={cn('shrink-0', isInstalled && 'cursor-default text-muted-foreground')}
                  onClick={() => !isInstalled && handleInstall(pack)}
                  disabled={isInstalling || isInstalled}
                >
                  {isInstalling ? '…' : isInstalled ? 'Installed' : pack.premium ? 'Buy & Install' : 'Install'}
                </Button>
              </div>
              <div className="text-[12.5px] leading-relaxed text-subtle-foreground">{pack.description ?? 'No description provided.'}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="font-mono">v{pack.version}</Badge>
                {pack.premium ? (
                  <Badge variant="warning" className="font-mono" title={`${pack.accessPrice} MODO base units`}>
                    {pack.accessPrice} MODO
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-mono">Free</Badge>
                )}
                {pack.anchorTx && (
                  <Badge variant="success" className="font-mono" title={`tx: ${pack.anchorTx}\nauthor: ${pack.authorAddress ?? ''}`}>
                    ⛓ verified author
                  </Badge>
                )}
                {pack.ipfsCid && (
                  <Badge variant="info" className="font-mono" title={pack.ipfsCid}>
                    IPFS {pack.ipfsCid.slice(0, 8)}…
                  </Badge>
                )}
                {pack.contentHash && (
                  <Badge variant="success" className="font-mono" title={pack.contentHash}>
                    ✓ sha256
                  </Badge>
                )}
              </div>
              {err && (
                <div className="rounded-md border border-destructive/30 bg-destructive/15 px-2 py-1 text-[11px] text-destructive">{err}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

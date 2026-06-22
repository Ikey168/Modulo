import { useEffect, useState } from 'react';
import { listPublishedPacks, installPackFromCid, type PackEntry } from './packService';
import { metaMaskService } from '../../../services/metamask';
import './pack.css';

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

  if (loading) return <div className="pm-loading">Loading packs…</div>;
  if (error) return <div className="pm-error">{error}</div>;
  if (packs.length === 0) return null;

  return (
    <div className="pm-section">
      <div className="pm-section-header">
        <h2 className="pm-section-title">Packs</h2>
        <p className="pm-section-subtitle">Community-published blueprint packs distributed via IPFS</p>
      </div>
      <div className="pm-grid">
        {packs.map(pack => {
          const isInstalled = installed.has(pack.packId) || pack.source === 'IPFS';
          const isInstalling = installing === pack.packId;
          const err = installErrors[pack.packId];
          return (
            <div key={pack.packId} className="pm-card">
              <div className="pm-card-header">
                <div className="pm-card-icon">{(pack.name ?? pack.packId).charAt(0).toUpperCase()}</div>
                <div className="pm-card-meta">
                  <div className="pm-card-name">{pack.name ?? pack.packId}</div>
                  <div className="pm-card-author">{pack.manifest?.author ?? 'Unknown author'}</div>
                </div>
                <button
                  className={`pm-install-btn ${isInstalled ? 'pm-install-btn--installed' : ''}`}
                  onClick={() => !isInstalled && handleInstall(pack)}
                  disabled={isInstalling || isInstalled}
                >
                  {isInstalling ? '…' : isInstalled ? 'Installed' : pack.premium ? 'Buy & Install' : 'Install'}
                </button>
              </div>
              <div className="pm-card-desc">{pack.description ?? 'No description provided.'}</div>
              <div className="pm-card-footer">
                <span className="pm-badge">v{pack.version}</span>
                {pack.premium ? (
                  <span className="pm-badge pm-badge--price" title={`${pack.accessPrice} MODO base units`}>
                    {pack.accessPrice} MODO
                  </span>
                ) : (
                  <span className="pm-badge pm-badge--free">Free</span>
                )}
                {pack.anchorTx && (
                  <span className="pm-badge pm-badge--chain" title={`tx: ${pack.anchorTx}\nauthor: ${pack.authorAddress ?? ''}`}>
                    ⛓ verified author
                  </span>
                )}
                {pack.ipfsCid && (
                  <span className="pm-badge pm-badge--ipfs" title={pack.ipfsCid}>
                    IPFS {pack.ipfsCid.slice(0, 8)}…
                  </span>
                )}
                {pack.contentHash && (
                  <span className="pm-badge pm-badge--hash" title={pack.contentHash}>
                    ✓ sha256
                  </span>
                )}
              </div>
              {err && <div className="pm-card-error">{err}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

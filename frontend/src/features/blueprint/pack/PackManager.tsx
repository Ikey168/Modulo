import React, { useEffect, useState, useRef } from 'react';
import {
  listPacks, installPack, uninstallPack, publishPackToIpfs, installPackFromCid,
  type PackEntry,
} from './packService';
import type { PackManifest } from './packManifest';
import { validateManifest } from './packManifest';
import { NodeCatalog } from '../nodeCatalog';
import './pack.css';

type Tab = 'installed' | 'install';

export default function PackManager() {
  const [tab, setTab] = useState<Tab>('installed');
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Install-from-manifest
  const [installText, setInstallText] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // Install-from-CID
  const [cidInput, setCidInput] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [cidError, setCidError] = useState<string | null>(null);
  const [cidInstalling, setCidInstalling] = useState(false);

  // Per-row actions
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Record<string, { cid: string; hash: string; url: string }>>({});
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try {
      const data = await listPacks();
      setPacks(data);
      setError(null);
    } catch {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInstall() {
    setInstallError(null);
    let manifest: PackManifest;
    try {
      manifest = JSON.parse(installText);
    } catch {
      setInstallError('Invalid JSON');
      return;
    }
    const check = validateManifest(manifest, new NodeCatalog());
    if (!check.ok) {
      setInstallError(check.reason ?? 'Invalid manifest');
      return;
    }
    setInstalling(true);
    try {
      const result = await installPack(manifest);
      if (result.ok) {
        setInstallText('');
        setTab('installed');
        await load();
      } else {
        setInstallError(result.reason ?? 'Install failed');
      }
    } catch {
      setInstallError('Network error');
    } finally {
      setInstalling(false);
    }
  }

  async function handleInstallFromCid() {
    setCidError(null);
    if (!cidInput.trim()) { setCidError('CID is required'); return; }
    setCidInstalling(true);
    try {
      const result = await installPackFromCid(cidInput.trim(), hashInput.trim() || undefined);
      if (result.ok) {
        setCidInput('');
        setHashInput('');
        setTab('installed');
        await load();
      } else {
        setCidError(result.reason ?? 'Install failed');
      }
    } catch {
      setCidError('Network error');
    } finally {
      setCidInstalling(false);
    }
  }

  async function handlePublish(packId: string) {
    setPublishingId(packId);
    try {
      const result = await publishPackToIpfs(packId);
      if (result.ok && result.cid && result.contentHash && result.gatewayUrl) {
        setPublishResults(prev => ({
          ...prev,
          [packId]: { cid: result.cid!, hash: result.contentHash!, url: result.gatewayUrl! },
        }));
        await load();
      } else {
        setError(result.reason ?? 'Publish failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setPublishingId(null);
    }
  }

  async function handleUninstall(packId: string) {
    setUninstallingId(packId);
    try {
      const result = await uninstallPack(packId);
      if (result.ok) {
        await load();
      } else {
        setError(result.reason ?? 'Uninstall failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setUninstallingId(null);
    }
  }

  return (
    <div className="pack-manager">
      <h2>Packs</h2>

      <div className="pack-tabs">
        <button className={`pack-tab ${tab === 'installed' ? 'pack-tab--active' : ''}`} onClick={() => setTab('installed')}>
          Installed ({packs.length})
        </button>
        <button className={`pack-tab ${tab === 'install' ? 'pack-tab--active' : ''}`} onClick={() => setTab('install')}>
          Install
        </button>
      </div>

      {error && <div className="pack-error">{error}</div>}

      {tab === 'installed' && (
        loading ? (
          <div className="pack-loading">Loading…</div>
        ) : packs.length === 0 ? (
          <div className="pack-empty">No packs installed.</div>
        ) : (
          <table className="pack-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Version</th>
                <th>Source</th>
                <th>IPFS</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packs.map(p => {
                const pub = publishResults[p.packId];
                const cid = pub?.cid ?? p.ipfsCid;
                const hash = pub?.hash ?? p.contentHash;
                const url = pub?.url ?? p.gatewayUrl;
                return (
                  <tr key={p.packId}>
                    <td className="pack-id">{p.packId}</td>
                    <td>{p.version}</td>
                    <td>
                      <span className={`pack-source pack-source--${(p.source ?? 'LOCAL').toLowerCase()}`}>
                        {p.source ?? 'LOCAL'}
                      </span>
                    </td>
                    <td className="pack-ipfs-cell">
                      {cid ? (
                        <div className="pack-cid-info">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="pack-cid-link" title={cid}>
                            {cid.slice(0, 14)}…
                          </a>
                          {hash && <span className="pack-hash" title={hash}>sha256: {hash.slice(0, 8)}…</span>}
                        </div>
                      ) : (
                        <button
                          className="pack-publish-btn"
                          onClick={() => handlePublish(p.packId)}
                          disabled={publishingId === p.packId}
                        >
                          {publishingId === p.packId ? 'Publishing…' : 'Publish to IPFS'}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`pack-status pack-status--${p.status.toLowerCase()}`}>{p.status}</span>
                    </td>
                    <td>
                      <button
                        className="pack-uninstall-btn"
                        onClick={() => handleUninstall(p.packId)}
                        disabled={uninstallingId === p.packId}
                      >
                        {uninstallingId === p.packId ? 'Removing…' : 'Uninstall'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}

      {tab === 'install' && (
        <div className="pack-install-panel">
          <div className="pack-install-section">
            <h3>Install from IPFS CID</h3>
            <p className="pack-install-hint">Paste the CID of a published pack. Provide the integrity hash for verification.</p>
            <input
              className="pack-cid-input"
              value={cidInput}
              onChange={e => setCidInput(e.target.value)}
              placeholder="QmXxx… or bafy…"
              spellCheck={false}
            />
            <input
              className="pack-cid-input"
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              placeholder="SHA-256 hash (optional)"
              spellCheck={false}
              style={{ marginTop: 6 }}
            />
            {cidError && <div className="pack-error">{cidError}</div>}
            <button
              className="pack-install-btn"
              onClick={handleInstallFromCid}
              disabled={cidInstalling || !cidInput.trim()}
            >
              {cidInstalling ? 'Installing…' : 'Install from CID'}
            </button>
          </div>

          <div className="pack-install-section" style={{ borderTop: '1px solid #333', paddingTop: 24 }}>
            <h3>Install from Manifest JSON</h3>
            <p className="pack-install-hint">Paste a pack manifest JSON directly:</p>
            <textarea
              ref={textareaRef}
              className="pack-manifest-input"
              value={installText}
              onChange={e => setInstallText(e.target.value)}
              rows={10}
              placeholder='{"id": "my-pack", "version": "1.0.0", "name": "My Pack", ...}'
              spellCheck={false}
            />
            {installError && <div className="pack-error">{installError}</div>}
            <button
              className="pack-install-btn"
              onClick={handleInstall}
              disabled={installing || !installText.trim()}
            >
              {installing ? 'Installing…' : 'Install from JSON'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

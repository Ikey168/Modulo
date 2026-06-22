import React, { useEffect, useState, useRef } from 'react';
import { listPacks, installPack, uninstallPack, type PackEntry } from './packService';
import type { PackManifest } from './packManifest';
import { validateManifest } from './packManifest';
import { NodeCatalog } from '../nodeCatalog';
import './pack.css';

export default function PackManager() {
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installText, setInstallText] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
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
      <h2>Installed Packs</h2>
      {error && <div className="pack-error">{error}</div>}
      {loading ? (
        <div className="pack-loading">Loading…</div>
      ) : packs.length === 0 ? (
        <div className="pack-empty">No packs installed.</div>
      ) : (
        <table className="pack-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Version</th>
              <th>Description</th>
              <th>Status</th>
              <th>Installed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {packs.map(p => (
              <tr key={p.packId}>
                <td className="pack-id">{p.packId}</td>
                <td>{p.version}</td>
                <td>{p.description ?? '—'}</td>
                <td>
                  <span className={`pack-status pack-status--${p.status.toLowerCase()}`}>
                    {p.status}
                  </span>
                </td>
                <td>{new Date(p.installedAt).toLocaleDateString()}</td>
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
            ))}
          </tbody>
        </table>
      )}

      <div className="pack-install-panel">
        <h3>Install Pack</h3>
        <p className="pack-install-hint">Paste a pack manifest JSON below:</p>
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
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>
    </div>
  );
}

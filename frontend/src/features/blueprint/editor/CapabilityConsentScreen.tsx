// Consent screen shown when a blueprint requires capabilities (#275).
// Displays the required permissions, whether each is granted, and allows the
// user to grant/revoke them individually. Rendered inside the editor as a modal
// overlay when permissions need review.

import { useEffect, useState } from 'react';
import { capabilityDescription, capabilityLabel } from '../capabilities';
import {
  BlueprintPermission,
  getBlueprintPermissions,
  setBlueprintPermission,
} from '../blueprintService';

interface CapabilityConsentScreenProps {
  blueprintName: string;
  /** Called when the user dismisses the screen (after granting or without changes). */
  onClose: () => void;
}

export function CapabilityConsentScreen({ blueprintName, onClose }: CapabilityConsentScreenProps) {
  const [permissions, setPermissions] = useState<BlueprintPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBlueprintPermissions(blueprintName)
      .then((perms) => { if (!cancelled) setPermissions(perms); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [blueprintName]);

  const toggle = async (cap: string, current: boolean) => {
    setSaving(cap);
    setError(null);
    try {
      await setBlueprintPermission(blueprintName, cap, !current);
      setPermissions((prev) =>
        prev.map((p) => (p.capability === cap ? { ...p, granted: !current } : p)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const allGranted = permissions.length > 0 && permissions.every((p) => p.granted);

  return (
    <div className="bp-consent-overlay" role="dialog" aria-modal="true" aria-label="Blueprint permissions">
      <div className="bp-consent-panel">
        <header className="bp-consent-header">
          <h2>Blueprint Permissions</h2>
          <p className="bp-consent-sub">
            <strong>{blueprintName}</strong> requires the following capabilities. Grant each one to
            allow the blueprint to run actions that use it.
          </p>
        </header>

        {loading && <div className="bp-consent-loading">Loading permissions…</div>}

        {!loading && permissions.length === 0 && (
          <div className="bp-consent-empty">This blueprint requires no special capabilities.</div>
        )}

        {!loading && permissions.length > 0 && (
          <ul className="bp-consent-list">
            {permissions.map((p) => (
              <li key={p.capability} className={`bp-consent-item ${p.granted ? 'bp-consent-item--granted' : ''}`}>
                <div className="bp-consent-item__info">
                  <span className="bp-consent-item__label">{capabilityLabel(p.capability)}</span>
                  <span className="bp-consent-item__desc">{capabilityDescription(p.capability)}</span>
                  <code className="bp-consent-item__code">{p.capability}</code>
                </div>
                <button
                  type="button"
                  className={`bp-consent-toggle ${p.granted ? 'bp-consent-toggle--revoke' : 'bp-consent-toggle--grant'}`}
                  disabled={saving === p.capability}
                  onClick={() => toggle(p.capability, p.granted)}
                  aria-label={p.granted ? `Revoke ${p.capability}` : `Grant ${p.capability}`}
                >
                  {saving === p.capability ? '…' : p.granted ? 'Revoke' : 'Grant'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <div className="bp-consent-error">{error}</div>}

        <footer className="bp-consent-footer">
          {allGranted && (
            <span className="bp-consent-all-granted">All capabilities granted — blueprint will execute fully.</span>
          )}
          {!allGranted && permissions.length > 0 && (
            <span className="bp-consent-warn">Ungranted capabilities will be skipped at runtime.</span>
          )}
          <button type="button" className="bp-btn-primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

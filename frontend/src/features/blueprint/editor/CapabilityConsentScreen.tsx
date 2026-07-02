// Consent screen shown when a blueprint requires capabilities (#275).
// Displays the required permissions, whether each is granted, and allows the
// user to grant/revoke them individually. Rendered inside the editor as a
// modal @/ui Dialog when permissions need review.

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui';
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[80vh] w-[90vw] max-w-[520px] gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold tracking-tight">Blueprint Permissions</DialogTitle>
          <DialogDescription className="text-[13px] text-subtle-foreground">
            <strong className="font-semibold text-foreground">{blueprintName}</strong> requires the following capabilities. Grant each one to
            allow the blueprint to run actions that use it.
          </DialogDescription>
        </DialogHeader>

        {loading && <div className="py-1 text-[13px] text-muted-foreground">Loading permissions…</div>}

        {!loading && permissions.length === 0 && (
          <div className="py-1 text-[13px] text-muted-foreground">This blueprint requires no special capabilities.</div>
        )}

        {!loading && permissions.length > 0 && (
          <ul className="flex list-none flex-col gap-2.5 p-0">
            {permissions.map((p) => (
              <li
                key={p.capability}
                className={
                  'flex items-start justify-between gap-3.5 rounded-lg border px-3.5 py-3 ' +
                  (p.granted
                    ? 'border-success/40 bg-success/[0.06]'
                    : 'border-border-strong bg-surface-2')
                }
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{capabilityLabel(p.capability)}</span>
                  <span className="text-xs text-subtle-foreground">{capabilityDescription(p.capability)}</span>
                  <code className="font-mono text-[11px] text-muted-foreground">{p.capability}</code>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={p.granted ? 'destructive' : 'secondary'}
                  disabled={saving === p.capability}
                  onClick={() => toggle(p.capability, p.granted)}
                  aria-label={p.granted ? `Revoke ${p.capability}` : `Grant ${p.capability}`}
                >
                  {saving === p.capability ? '…' : p.granted ? 'Revoke' : 'Grant'}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <Alert variant="destructive" className="px-3 py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
          {allGranted && (
            <span className="text-[12.5px] text-success">All capabilities granted — blueprint will execute fully.</span>
          )}
          {!allGranted && permissions.length > 0 && (
            <span className="text-[12.5px] text-warning">Ungranted capabilities will be skipped at runtime.</span>
          )}
          <Button type="button" variant="primary" size="sm" className="sm:ml-auto" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

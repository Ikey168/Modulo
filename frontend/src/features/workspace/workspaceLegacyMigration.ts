export interface WorkspaceLegacySource {
  id: string;
  label: string;
  importLegacy: () => Promise<void>;
  exportRecovery: () => void;
}

interface Entry extends WorkspaceLegacySource { refs: number; }

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let revision = 0;

function emit(): void {
  revision += 1;
  for (const listener of listeners) {
    try { listener(); } catch { /* observer isolation */ }
  }
}

export function registerWorkspaceLegacySource(source: WorkspaceLegacySource): () => void {
  const current = entries.get(source.id);
  if (current) {
    current.refs += 1;
    current.label = source.label;
    current.importLegacy = source.importLegacy;
    current.exportRecovery = source.exportRecovery;
  } else {
    entries.set(source.id, { ...source, refs: 1 });
  }
  emit();
  return () => {
    const active = entries.get(source.id);
    if (!active) return;
    active.refs -= 1;
    if (active.refs <= 0) entries.delete(source.id);
    emit();
  };
}

export function workspaceLegacyRevision(): number { return revision; }
export function workspaceLegacySources(): WorkspaceLegacySource[] {
  return [...entries.values()].map(({ refs: _refs, ...source }) => source);
}
export function subscribeWorkspaceLegacy(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

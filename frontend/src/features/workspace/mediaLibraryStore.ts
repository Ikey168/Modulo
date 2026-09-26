import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PluginStateClient, StateJson, StateView } from '../../services/pluginStateClient';
import { browserLegacyValue, decodeLegacyJson, preserveLegacySource, retireLegacySource } from '../../services/legacy/legacyStateImport';
import { legacyBrowserStorage } from '../../services/legacy/browserLegacyStorage';
import { usePlugins } from './plugins/PluginProvider';
import { registerWorkspaceLegacySource } from './workspaceLegacyMigration';
import {
  LEGACY_MEDIA_LIBRARY_STORE_KEY,
  MEDIA_LIBRARY_STORE_KEY,
  emptyMediaLibrary,
  parseMediaLibrary,
  type MediaItem,
  type MediaLibraryData,
} from './mediaLibrary';
import type { WorkspaceStore, StoreUpdate } from './useWorkspaceStore';

/**
 * The media library is stored one server record per item (key = item id) so a
 * large library never approaches the 1 MiB per-record limit and an edit only
 * sends the item that changed. `position` preserves the user's ordering.
 */
export const MEDIA_LIBRARY_NAMESPACE = 'media-library';
export const MEDIA_ITEM_SCHEMA = 'modulo.workspace.media-item';
const LEGACY_KEYS = [MEDIA_LIBRARY_STORE_KEY, LEGACY_MEDIA_LIBRARY_STORE_KEY];
const KEY = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/;

export interface MediaItemRecord { position: number; item: MediaItem; }
export interface MediaWrite { key: string; value: MediaItemRecord; }
export interface MediaWritePlan { set: MediaWrite[]; remove: string[]; }

const asJson = (value: unknown): StateJson => JSON.parse(JSON.stringify(value)) as StateJson;

export function isMediaItemRecord(record: Pick<StateView, 'key' | 'deleted' | 'schemaId'>): boolean {
  return !record.deleted && record.schemaId === MEDIA_ITEM_SCHEMA && !record.key.startsWith('migration.');
}

/** Server records → ordered library. Invalid records are skipped rather than failing the view. */
export function mediaLibraryFromRecords(records: Array<Pick<StateView, 'key' | 'deleted' | 'schemaId' | 'value'>>): {
  data: MediaLibraryData;
  positions: Map<string, number>;
  items: Map<string, MediaItem>;
} {
  const rows: Array<{ position: number; item: MediaItem }> = [];
  for (const record of records) {
    if (!isMediaItemRecord(record)) continue;
    const raw = record.value as Partial<MediaItemRecord> | null;
    const parsed = parseMediaLibrary({ items: [raw?.item] }).items[0];
    if (!parsed || parsed.id !== record.key) continue;
    rows.push({ position: typeof raw?.position === 'number' && Number.isFinite(raw.position) ? raw.position : 0, item: parsed });
  }
  rows.sort((a, b) => a.position - b.position || a.item.id.localeCompare(b.item.id));
  return {
    data: { version: 2, items: rows.map(row => row.item) },
    positions: new Map(rows.map(row => [row.item.id, row.position])),
    items: new Map(rows.map(row => [row.item.id, row.item])),
  };
}

/**
 * Minimal writes turning the stored library into `next`: changed or moved items are
 * rewritten, untouched items keep their record, and removed items are deleted.
 */
export function planMediaWrites(
  current: { positions: Map<string, number>; items: Map<string, MediaItem> },
  next: MediaItem[],
): MediaWritePlan {
  const set: MediaWrite[] = [];
  const seen = new Set<string>();
  const assigned: number[] = [];
  for (let index = 0; index < next.length; index++) {
    const item = next[index];
    if (!KEY.test(item.id) || seen.has(item.id)) throw new Error(`Invalid or duplicate media id: ${item.id}`);
    seen.add(item.id);
    const previous = index > 0 ? assigned[index - 1] : -Infinity;
    let following = Infinity;
    for (let ahead = index + 1; ahead < next.length; ahead++) {
      const candidate = current.positions.get(next[ahead].id);
      if (candidate !== undefined && candidate > previous) { following = candidate; break; }
    }
    const stored = current.positions.get(item.id);
    let position = stored;
    if (position === undefined || position <= previous || position >= following) {
      position = previous === -Infinity
        ? (following === Infinity ? 0 : following - 1)
        : following === Infinity ? previous + 1 : (previous + following) / 2;
    }
    assigned.push(position);
    const unchanged = stored === position && JSON.stringify(current.items.get(item.id)) === JSON.stringify(item);
    if (!unchanged) set.push({ key: item.id, value: { position, item } });
  }
  const remove = [...current.items.keys()].filter(id => !seen.has(id));
  return { set, remove };
}

async function applyPlan(client: PluginStateClient, plan: MediaWritePlan): Promise<void> {
  for (const write of plan.set) await client.set(write.key, asJson(write.value), MEDIA_ITEM_SCHEMA, 1);
  for (const key of plan.remove) await client.delete(key);
}

function legacyLibrary(): MediaLibraryData | null {
  for (const key of LEGACY_KEYS) {
    const raw = browserLegacyValue(key);
    if (raw !== null) return parseMediaLibrary(JSON.parse(raw));
  }
  return null;
}

/** Claim browser-only media into the server without replacing items that already exist there. */
export async function importLegacyMediaLibrary(client: PluginStateClient, storage: Storage | null = legacyBrowserStorage()): Promise<number> {
  if (!storage) return 0;
  const raw = Object.fromEntries(LEGACY_KEYS.map(key => [key, storage.getItem(key)]));
  const sourceKey = raw[MEDIA_LIBRARY_STORE_KEY] != null ? MEDIA_LIBRARY_STORE_KEY : LEGACY_MEDIA_LIBRARY_STORE_KEY;
  const source = raw[sourceKey];
  if (source == null) return 0;
  const legacy = decodeLegacyJson(sourceKey, source, value => parseMediaLibrary(value).items);
  await preserveLegacySource(client, raw);
  await client.refreshAll();
  const current = mediaLibraryFromRecords(client.list());
  const missing = legacy.filter(item => !current.items.has(item.id));
  const merged = [...current.data.items, ...missing];
  const plan = planMediaWrites(current, merged);
  await applyPlan(client, { set: plan.set.filter(write => missing.some(item => item.id === write.key)), remove: [] });
  await client.synchronize();
  if (client.list().some(record => record.pending || record.conflict)) {
    throw new Error('Import has not synchronized; browser data is preserved.');
  }
  await client.set('migration.media-items', { sources: LEGACY_KEYS, imported: missing.length }, 'modulo.migration', 1);
  await client.synchronize();
  retireLegacySource(storage, raw);
  return missing.length;
}

/** Server-authoritative media library shared by the media plugins, dashboards and tools. */
export function useMediaLibraryStore(enabled = true): WorkspaceStore<MediaLibraryData> {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [records, setRecords] = useState<StateView[]>([]);
  const [legacy, setLegacy] = useState(() => legacyLibrary() !== null);
  const latest = useRef(mediaLibraryFromRecords([]));

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    setClient(undefined);
    setRecords([]);
    if (!enabled || !plugins.stateSessionKey) return;
    void plugins.workspaceState(MEDIA_LIBRARY_NAMESPACE).then(state => {
      if (disposed || state.status === 'closed') return;
      const refresh = () => { if (!disposed && state.status !== 'closed') setRecords(state.list()); };
      setClient(state);
      stop = state.watch(refresh);
      refresh();
    }).catch(() => { if (!disposed) setRecords([]); });
    return () => { disposed = true; stop?.(); };
    // Account identity, not provider re-renders, determines the subscription lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, plugins.stateSessionKey]);

  const view = useMemo(() => mediaLibraryFromRecords(records), [records]);
  latest.current = view;

  useEffect(() => {
    if (!legacy || !client) return;
    return registerWorkspaceLegacySource({
      id: `${MEDIA_LIBRARY_NAMESPACE}:items`,
      label: 'Media library',
      importLegacy: async () => {
        await importLegacyMediaLibrary(client);
        setLegacy(legacyLibrary() !== null);
      },
      exportRecovery: () => {
        const blob = new Blob([JSON.stringify({
          legacy: Object.fromEntries(LEGACY_KEYS.map(key => [key, browserLegacyValue(key)])),
          server: latest.current.data,
        }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'media-library-recovery.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    });
  }, [legacy, client]);

  const persist = useCallback((next: StoreUpdate<MediaLibraryData>): boolean => {
    if (!client || client.status === 'closed') return false;
    const base = latest.current;
    const resolved = parseMediaLibrary(typeof next === 'function' ? next(base.data) : next);
    let plan: MediaWritePlan;
    try { plan = planMediaWrites(base, resolved.items); } catch { return false; }
    // Optimistic: reflect the edit immediately; the client cache/outbox delivers it to the server.
    const positions = new Map(base.positions);
    const items = new Map(base.items);
    for (const key of plan.remove) { positions.delete(key); items.delete(key); }
    for (const write of plan.set) { positions.set(write.key, write.value.position); items.set(write.key, write.value.item); }
    latest.current = { data: resolved, positions, items };
    void applyPlan(client, plan).catch(() => setRecords(client.list()));
    return true;
  }, [client]);

  return [client ? view.data : emptyMediaLibrary(), persist];
}

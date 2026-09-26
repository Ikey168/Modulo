import { useEffect, useMemo, useState } from 'react';
import type { PluginStateClient, StateJson, StateView } from '../../services/pluginStateClient';
import { usePlugins } from './plugins/PluginProvider';
import { readCollection, validateCollection, type OperationalCollection } from './operationalState';
import {
  EXPENSE_COLLECTION, TIME_COLLECTION, TODO_COLLECTION,
  validateRetentionClass, validateSeller, validateStrings,
} from './operationalSchemas';

/**
 * Backup/restore for the business and productivity records that live in
 * plugin namespaces (#422): one record per todo, time entry and expense, plus
 * per-plugin settings documents. Portable keys match the historical browser
 * keys so older Life OS backups restore into the same place.
 */
interface SettingsDestination { namespace: string; key: string; schemaId: string; validate: (value: unknown) => unknown }

const COLLECTIONS: Record<string, OperationalCollection<{ id: string }>> = {
  'modulo-todos': TODO_COLLECTION as OperationalCollection<{ id: string }>,
  'modulo-time-entries': TIME_COLLECTION as OperationalCollection<{ id: string }>,
  'modulo-euer-expenses': EXPENSE_COLLECTION as OperationalCollection<{ id: string }>,
};
const retention = (value: unknown) => {
  if (!Array.isArray(value)) throw new Error('Invalid retention classes');
  return value.map(validateRetentionClass);
};
const SETTINGS: Record<string, SettingsDestination> = {
  'modulo-euer-categories': { namespace: 'euer-datev', key: 'categories', schemaId: 'modulo.expense.categories', validate: validateStrings },
  'modulo-euer-exported': { namespace: 'euer-datev', key: 'exported-periods', schemaId: 'modulo.expense.exported-periods', validate: validateStrings },
  'modulo-invoice-seller': { namespace: 'rechnung', key: 'seller', schemaId: 'modulo.invoice.seller', validate: validateSeller },
  'modulo-gobd-classes': { namespace: 'gobd-vault', key: 'classes', schemaId: 'modulo.retention.classes', validate: retention },
  'modulo-pipeline-stages': { namespace: 'kanban', key: 'stages', schemaId: 'modulo.pipeline.stages', validate: validateStrings },
};

export const OPERATIONAL_PORTABLE_KEYS: readonly string[] = [...Object.keys(COLLECTIONS), ...Object.keys(SETTINGS)];
export const isOperationalPortableKey = (key: string): boolean => key in COLLECTIONS || key in SETTINGS;
const NAMESPACES = [...new Set([...Object.values(COLLECTIONS).map(item => item.namespace), ...Object.values(SETTINGS).map(item => item.namespace)])];
const json = (value: unknown): StateJson => JSON.parse(JSON.stringify(value)) as StateJson;

/** Current records of installed business/productivity plugins, keyed by portable key. */
export function portableOperationalStores(records: Record<string, StateView[]>): Record<string, unknown> {
  const stores: Record<string, unknown> = {};
  for (const [portableKey, definition] of Object.entries(COLLECTIONS)) {
    const views = records[definition.namespace];
    if (!views) continue;
    const client = { list: () => views } as unknown as PluginStateClient;
    stores[portableKey] = readCollection(client, definition);
  }
  for (const [portableKey, destination] of Object.entries(SETTINGS)) {
    const view = records[destination.namespace]?.find(record => record.key === destination.key);
    if (view && !view.deleted && view.value !== undefined) stores[portableKey] = view.value;
  }
  return stores;
}

export function useOperationalPortableSnapshot(): Record<string, unknown> {
  const plugins = usePlugins();
  const installed = NAMESPACES.filter(namespace => plugins.isEnabled(namespace)).join('|');
  const [records, setRecords] = useState<Record<string, StateView[]>>({});
  useEffect(() => {
    let active = true;
    const stops: (() => void)[] = [];
    const current: Record<string, StateView[]> = {};
    setRecords({});
    for (const namespace of installed ? installed.split('|') : []) {
      void plugins.state(namespace).then(client => {
        if (!active || client.status === 'closed') return;
        const update = () => { if (active && client.status !== 'closed') { current[namespace] = client.list(); setRecords({ ...current }); } };
        stops.push(client.watch(update)); update();
      }).catch(() => { /* A plugin that cannot open contributes nothing to the backup. */ });
    }
    return () => { active = false; stops.forEach(stop => stop()); };
    // The plugin API identity changes on every runtime notification; the session key and installed set decide the lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed, plugins.stateSessionKey]);
  return useMemo(() => {
    try { return portableOperationalStores(records); } catch { return {}; }
  }, [records]);
}

/**
 * Restore planned business/productivity stores into their plugin namespaces.
 * A collection restore replaces the collection: records absent from the
 * backup are deleted, matching the media library restore semantics.
 */
export async function restoreOperationalStores(planned: Record<string, unknown>,
  open: (namespace: string) => Promise<PluginStateClient>): Promise<string[]> {
  const restored: string[] = [];
  const clients = new Map<string, PluginStateClient>();
  const clientFor = async (namespace: string) => {
    const existing = clients.get(namespace);
    if (existing) return existing;
    const client = await open(namespace);
    await client.refreshAll();
    clients.set(namespace, client);
    return client;
  };
  const touched: Array<{ client: PluginStateClient; key: string }> = [];
  for (const [portableKey, definition] of Object.entries(COLLECTIONS)) {
    if (!Object.prototype.hasOwnProperty.call(planned, portableKey)) continue;
    const records = validateCollection(definition, planned[portableKey]);
    const client = await clientFor(definition.namespace);
    const keep = new Set(records.map(record => `record.${record.id}`));
    for (const record of records) {
      await client.set(`record.${record.id}`, json(record), definition.schemaId, 1);
      touched.push({ client, key: `record.${record.id}` });
    }
    for (const view of client.list()) if (view.key.startsWith('record.') && !keep.has(view.key)) await client.delete(view.key);
    restored.push(portableKey);
  }
  for (const [portableKey, destination] of Object.entries(SETTINGS)) {
    if (!Object.prototype.hasOwnProperty.call(planned, portableKey)) continue;
    const value = destination.validate(planned[portableKey]);
    const client = await clientFor(destination.namespace);
    await client.set(destination.key, json(value), destination.schemaId, 1);
    touched.push({ client, key: destination.key });
    restored.push(portableKey);
  }
  await Promise.all([...clients.values()].map(client => client.synchronize()));
  for (const { client, key } of touched) {
    const record = client.get(key);
    if (!record || record.pending || record.conflict) throw new Error('Business records did not finish synchronizing. Retry after connectivity recovers.');
  }
  return restored;
}

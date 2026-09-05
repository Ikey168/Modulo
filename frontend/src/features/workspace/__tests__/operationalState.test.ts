import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport, type StateSnapshot } from '../../../services/pluginStateClient';
import { importCollection, readCollection, saveCollection, validateCollection, type OperationalCollection } from '../operationalState';
import { TODO_COLLECTION, TIME_COLLECTION, EXPENSE_COLLECTION } from '../operationalSchemas';
import { datevCsv } from '../euer';
import { importLegacyState } from '../../../services/legacyStateImport';
import { validateSeller, validateStrings, validateRetentionClass } from '../operationalSchemas';
import { toInvoiceLines } from '../timeTracking';
const scope = { origin: 'https://app.example', issuer: 'https://id.example', subject: 'alice', workspace: 'personal', namespace: 'operational', replica: 'a' };
function server() {
  const records = new Map<string, StateRecord>();
  const transport: StateTransport = {
    list: vi.fn(async () => ({ records: [...records.values()].filter(record => !record.deleted) })),
    get: vi.fn(async key => records.get(key)),
    put: vi.fn(async (key, request) => {
      const current = records.get(key);
      if ((current?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'conflict', current);
      const saved: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion,
        version: request.expectedVersion + 1, value: request.value, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, saved); return saved;
    }),
    delete: vi.fn(async (key, version) => {
      const current = records.get(key)!;
      if (current.version !== version) throw new StateRequestError(409, 'conflict', current);
      const saved = { ...current, value: null, deleted: true, version: version + 1 };
      records.set(key, saved); return saved;
    }),
  };
  return { records, transport };
}
async function client(transport: StateTransport, replica = 'device-a', autoRetry = false) {
  const snapshots = new Map<string, StateSnapshot>();
  return PluginStateClient.open({ ...scope, replica }, {
    load: async key => snapshots.get(key) ?? null, save: async (key, value) => { snapshots.set(key, value); },
  }, transport, { autoRetry });
}

afterEach(() => localStorage.clear());
const cases = [
  [TODO_COLLECTION, { id: 'td-one', title: 'Review', priority: 'HIGH', done: false, list: 'Inbox', noteId: 1 }],
  [TIME_COLLECTION, { id: 'te-one', date: '2026-09-05', engagement: 'Audit', description: 'Review', minutes: 90, rateEur: 150, billable: true, billed: false }],
  [EXPENSE_COLLECTION, { id: 'ex-one', date: '2026-09-05', vendor: 'Vendor', description: 'Tools', netEur: 100, vatRate: 19, category: 'IT & Software' }],
] as const;
for (const [typedDefinition, sample] of cases) {
  const definition = typedDefinition as OperationalCollection<any>;
  describe(definition.namespace, () => {
    it('claims stable IDs once and refreshes another device', async () => {
      const { transport, records } = server(); const a = await client(transport); const b = await client(transport, 'b');
      localStorage.setItem(definition.legacyKey, JSON.stringify([sample]));
      await importCollection(a, definition, localStorage); await b.refreshAll();
      expect(readCollection(b, definition)).toEqual([sample]); expect(localStorage.getItem(definition.legacyKey)).toBeNull();
      localStorage.setItem(definition.legacyKey, JSON.stringify([sample])); await importCollection(a, definition, localStorage);
      expect(records.get(`record.${sample.id}`)?.version).toBe(1); a.close(); b.close();
    });
    it('preserves malformed and conflicting legacy data without replacing server records', async () => {
      const { transport } = server(); const state = await client(transport);
      localStorage.setItem(definition.legacyKey, JSON.stringify([sample, sample]));
      await expect(importCollection(state, definition, localStorage)).rejects.toThrow('Duplicate');
      await state.set(`record.${sample.id}`, { ...sample, id: sample.id, extra: 'server' } as never, definition.schemaId, 1); await state.synchronize();
      const raw = JSON.stringify([sample]); localStorage.setItem(definition.legacyKey, raw);
      await expect(importCollection(state, definition, localStorage)).rejects.toThrow('differs');
      expect(localStorage.getItem(definition.legacyKey)).toBe(raw); state.close();
    });
    it('keeps an offline import recoverable and resumes it after reconnect', async () => {
      const { transport } = server(); const state = await client(transport);
      vi.mocked(transport.put).mockRejectedValueOnce(new TypeError('offline'));
      const raw = JSON.stringify([sample]); localStorage.setItem(definition.legacyKey, raw);
      await expect(importCollection(state, definition, localStorage)).rejects.toThrow('not synchronized');
      expect(localStorage.getItem(definition.legacyKey)).toBe(raw);
      await importCollection(state, definition, localStorage);
      expect(readCollection(state, definition)).toEqual([sample]); expect(localStorage.getItem(definition.legacyKey)).toBeNull(); state.close();
    });
    it('diffs independent keys without deleting a remote record and rejects future versions', async () => {
      const { transport } = server(); const state = await client(transport);
      const other = { ...sample, id: 'remote' };
      await saveCollection(state, definition, [], [other]); await state.synchronize();
      await saveCollection(state, definition, [], [sample]); await state.synchronize();
      expect(readCollection(state, definition)).toHaveLength(2);
      await state.set(`record.${sample.id}`, sample as never, definition.schemaId, 2);
      expect(() => readCollection(state, definition)).toThrow('Unsupported'); state.close();
    });
  });
}
it('keeps DATEV and invoice line exports stable across serialization', () => {
  const expense = cases[2][1]; const entry = cases[1][1];
  expect(datevCsv([], [expense], '2026-09')).toBe(datevCsv([], JSON.parse(JSON.stringify([expense])), '2026-09'));
  expect(toInvoiceLines([entry])).toBe(toInvoiceLines(JSON.parse(JSON.stringify([entry]))));
});
it('rejects invalid dates, numbers and missing fields for every operational model', () => {
  for (const [definition, sample] of cases) expect(() => validateCollection(definition as OperationalCollection<any>, [{ ...sample, id: '../escape' }])).toThrow();
  expect(() => TIME_COLLECTION.validate({ ...cases[1][1], date: '2026-02-30' })).toThrow();
  expect(() => EXPENSE_COLLECTION.validate({ ...cases[2][1], netEur: -1 })).toThrow();
  expect(() => TODO_COLLECTION.validate({ ...cases[0][1], done: 'yes' })).toThrow();
});

it('preserves a displayed stale edit when a shared cache refreshed before its queued write', async () => {
  const { transport } = server(); const state = await client(transport);
  const original = cases[0][1];
  await saveCollection(state, TODO_COLLECTION, [], [original]); await state.synchronize();
  const remote = { ...original, title: 'Remote edit' };
  await state.set(`record.${original.id}`, remote, TODO_COLLECTION.schemaId, 1); await state.synchronize();
  await saveCollection(state, TODO_COLLECTION, [original], [{ ...original, title: 'Local edit' }]); await state.synchronize();
  expect(state.conflicts()).toHaveLength(1);
  expect(state.get(`record.${original.id}`)?.conflict?.displayed).toEqual(original);
  expect(state.get(`record.${original.id}`)?.value).toMatchObject({ title: 'Local edit' });
  await state.resolve(`record.${original.id}`, 'remote');
  expect(readCollection(state, TODO_COLLECTION)[0].title).toBe('Remote edit'); state.close();
});

const settingsCases = [
  ['modulo-euer-categories', 'categories', 'modulo.expense.categories', ['IT'], validateStrings],
  ['modulo-euer-exported', 'exported-periods', 'modulo.expense.exported-periods', ['2026-09'], validateStrings],
  ['modulo-invoice-seller', 'seller', 'modulo.invoice.seller', { name: 'Seller', address: 'Berlin' }, validateSeller],
  ['modulo-gobd-classes', 'classes', 'modulo.retention.classes', [{ id: 'belege', label: 'Receipts', years: 8 }],
    (value: unknown) => { if (!Array.isArray(value)) throw new Error('Invalid classes'); return value.map(validateRetentionClass); }],
  ['modulo-pipeline-stages', 'stages', 'modulo.pipeline.stages', ['inquiry', 'audit'], validateStrings],
] as const;
for (const [legacy, key, schema, sample, validate] of settingsCases) {
  it(`migrates ${legacy} once, refreshes another client, and preserves conflicts`, async () => {
    const { transport } = server(); const a = await client(transport); const b = await client(transport, 'b');
    const parse = (value: unknown) => JSON.parse(JSON.stringify(validate(value)));
    localStorage.setItem(legacy, JSON.stringify(sample));
    await importLegacyState(a, localStorage, legacy, key, schema, parse); await b.refreshAll();
    expect(b.get(key)?.value).toEqual(sample); expect(localStorage.getItem(legacy)).toBeNull();
    await a.delete(key); await a.synchronize();
    const raw = JSON.stringify(sample); localStorage.setItem(legacy, raw);
    await expect(importLegacyState(a, localStorage, legacy, key, schema, parse)).rejects.toThrow('differ');
    expect(localStorage.getItem(legacy)).toBe(raw); a.close(); b.close();
  });
}

it('exports identical bytes regardless of device discovery order', () => {
  const expenses = [cases[2][1], { ...cases[2][1], id: 'ex-two', description: 'Second expense' }];
  const entries = [cases[1][1], { ...cases[1][1], id: 'te-two', description: 'Second session' }];
  expect(datevCsv([], expenses, '2026-09')).toBe(datevCsv([], [...expenses].reverse(), '2026-09'));
  expect(toInvoiceLines(entries)).toBe(toInvoiceLines([...entries].reverse()));
});

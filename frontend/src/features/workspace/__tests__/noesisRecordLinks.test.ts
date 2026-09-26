import { describe, expect, it, vi } from 'vitest';
import type { StateJson, StateView } from '../../../services/pluginStateClient';
import { LINK_SCHEMA, linkKey, modesForPlugin, readLink, refreshLink, startModeFromRecord, type ModuloRecordRef } from '../noesisRecordLinks';

const store = () => {
  const values = new Map<string, StateView>();
  return {
    values,
    get: (key: string) => values.get(key),
    set: vi.fn(async (key: string, value: StateJson, schemaId: string) => {
      values.set(key, { key, value, schemaId, schemaVersion: 1, deleted: false, pending: false });
    }),
    synchronize: vi.fn(async () => {}),
  };
};
const ref: ModuloRecordRef = { issuer: 'https://id', subject: 'alice', workspace: 'personal', pluginId: 'decision-journal',
  collection: 'records', recordId: 'd-1' };

describe('Noesis record links (#474)', () => {
  it('offers the modes the issue assigns to each dedicated plugin', () => {
    expect(modesForPlugin('decision-journal')).toEqual(['Decision Support', 'Iteration']);
    expect(modesForPlugin('reading-annotations')).toEqual(['Exploration', 'Deep Research']);
    expect(modesForPlugin('recipes')).toEqual([]);
  });

  it('keeps Modulo and Noesis identities apart and is idempotent across a failed start', async () => {
    const links = store();
    const call = vi.fn()
      .mockRejectedValueOnce(new Error('Noesis unavailable'))
      .mockResolvedValueOnce({ session_id: 's-9', status: 'active', revision: 1 });
    const deps = { links, call, newKey: () => 'k1', now: () => new Date('2026-09-26T00:00:00Z') };
    await expect(startModeFromRecord(ref, 'Decision Support', 'Choose a vendor', deps)).rejects.toThrow('Noesis unavailable');
    const key = linkKey(ref, 'Decision Support');
    expect(readLink(links, key)).toMatchObject({ status: 'failed', requestKey: 'modulo-record-k1' });

    const link = await startModeFromRecord(ref, 'Decision Support', 'Choose a vendor', deps);
    expect(call).toHaveBeenLastCalledWith('start_intake_mode', expect.objectContaining({
      mode: 'Decision Support', request_key: 'modulo-record-k1', intent: 'Choose a vendor',
    }));
    expect(link).toMatchObject({ modulo: ref, noesis: { kind: 'intake-session', id: 's-9', revision: 1 }, status: 'active' });
    expect(links.set).toHaveBeenLastCalledWith(key, expect.anything(), LINK_SCHEMA, 1);

    // A started link is returned as is; Noesis is not asked again.
    await startModeFromRecord(ref, 'Decision Support', 'Choose a vendor', deps);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('refuses modes the plugin does not offer and refreshes status from Noesis', async () => {
    const links = store();
    const call = vi.fn().mockResolvedValueOnce({ session_id: 's-1', status: 'active', revision: 1 })
      .mockResolvedValueOnce({ session_id: 's-1', status: 'completed', revision: 3 });
    await expect(startModeFromRecord(ref, 'Creation', 'x', { links, call })).rejects.toThrow('not offered');
    await startModeFromRecord(ref, 'Iteration', 'Review outcome', { links, call });
    const refreshed = await refreshLink(linkKey(ref, 'Iteration'), { links, call });
    expect(refreshed).toMatchObject({ status: 'completed', noesis: { revision: 3 } });
  });
});

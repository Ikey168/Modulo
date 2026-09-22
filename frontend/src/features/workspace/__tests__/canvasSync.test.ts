import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport, type StateSnapshot } from '../../../services/pluginStateClient';
import { CANVAS_SCHEMA, emptySyncedCanvas, importLegacyCanvas, LEGACY_CANVAS_KEY, parseCanvasBoard, readSyncedCanvas, saveCanvasDiff } from '../canvasSync';
import { addCard, moveCard, updateBoard, type CanvasBoard } from '../canvasStore';

const scope = { origin: 'https://app.example', issuer: 'https://id.example', subject: 'alice',
  workspace: 'personal', namespace: 'canvas-board', replica: 'device-a' };
const board = (): CanvasBoard => ({ id: 'legacy', name: 'My board', cards: [{ noteId: 1, x: 10, y: 20 },
  { noteId: 2, x: 50, y: 60 }], connections: [{ id: 'edge', from: 1, to: 2 }] });
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
afterEach(() => { localStorage.clear(); vi.useRealTimers(); });

describe('synchronized Canvas', () => {
  it('migrates named boards and edges, marks success, then removes only unchanged legacy data', async () => {
    const { transport, records } = server(); const state = await client(transport);
    localStorage.setItem(LEGACY_CANVAS_KEY, JSON.stringify({ boards: [board()], activeId: 'legacy' }));
    await importLegacyCanvas(state, localStorage);
    expect(localStorage.getItem(LEGACY_CANVAS_KEY)).toBeNull();
    expect(readSyncedCanvas(state).boards).toEqual([board()]);
    expect(records.get('migration-browser-v1')?.value).toEqual({ boardIds: ['legacy'] }); state.close();
  });
  it('never overwrites newer server data during migration', async () => {
    const { transport } = server(); const state = await client(transport);
    await state.set('board.legacy', { ...board(), name: 'Server edit' } as never, CANVAS_SCHEMA, 1); await state.synchronize();
    const raw = JSON.stringify({ boards: [board()], activeId: 'legacy' }); localStorage.setItem(LEGACY_CANVAS_KEY, raw);
    await expect(importLegacyCanvas(state, localStorage)).rejects.toThrow('differs on the server');
    expect(localStorage.getItem(LEGACY_CANVAS_KEY)).toBe(raw); expect(readSyncedCanvas(state).boards[0].name).toBe('Server edit'); state.close();
  });
  it('retries a partially completed migration without duplicate records or lost edges', async () => {
    const { transport, records } = server(); const state = await client(transport);
    await state.set('board.legacy', board() as never, CANVAS_SCHEMA, 1); await state.synchronize();
    localStorage.setItem(LEGACY_CANVAS_KEY, JSON.stringify({ boards: [board()], activeId: 'legacy' }));
    await importLegacyCanvas(state, localStorage);
    expect(records.get('board.legacy')?.version).toBe(1); expect(records.size).toBe(3);
    expect(records.get('active-board')?.value).toBe('legacy'); state.close();
  });
  it('keeps the raw legacy bytes when validation or synchronization fails', async () => {
    const { transport } = server(); const state = await client(transport);
    localStorage.setItem(LEGACY_CANVAS_KEY, '{malformed');
    await expect(importLegacyCanvas(state, localStorage)).rejects.toThrow();
    expect(localStorage.getItem(LEGACY_CANVAS_KEY)).toBe('{malformed');
    const raw = JSON.stringify({ boards: [board()], activeId: 'legacy' }); localStorage.setItem(LEGACY_CANVAS_KEY, raw);
    vi.mocked(transport.put).mockRejectedValue(new TypeError('offline'));
    await expect(importLegacyCanvas(state, localStorage)).rejects.toThrow('not synchronized');
    expect(localStorage.getItem(LEGACY_CANVAS_KEY)).toBe(raw); state.close();
  });
  it('a board edited on one client appears on another, including connections', async () => {
    const { transport } = server(); const a = await client(transport); const b = await client(transport, 'device-b');
    await a.set('board.legacy', board() as never, CANVAS_SCHEMA, 1); await a.synchronize(); await b.refreshAll();
    expect(readSyncedCanvas(b).boards).toEqual([board()]); a.close(); b.close();
  });
  it('many pointer movements produce one debounced network write', async () => {
    vi.useFakeTimers(); const { transport } = server(); const state = await client(transport, 'device-a', true);
    let previous = emptySyncedCanvas();
    for (let index = 0; index < 100; index++) {
      const next = updateBoard(previous, 'default', value => moveCard(addCard(value, 1, 0, 0), 1, index, index));
      await saveCanvasDiff(state, previous, next); previous = next;
    }
    expect(transport.put).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(300);
    expect(transport.put).toHaveBeenCalledTimes(1);
    expect(readSyncedCanvas(state).boards[0].cards[0].x).toBe(99); state.close();
  });
  it('does not delete a board that another client added after the local view was read', async () => {
    const { transport } = server(); const state = await client(transport);
    await state.set('board.remote', { ...board(), id: 'remote' } as never, CANVAS_SCHEMA, 1); await state.synchronize();
    const previous = emptySyncedCanvas(); const next = updateBoard(previous, 'default', value => addCard(value, 1, 0, 0));
    await saveCanvasDiff(state, previous, next); await state.synchronize();
    expect(readSyncedCanvas(state).boards.map(value => value.id)).toContain('remote'); state.close();
  });
  it('rejects malformed cards/edges and unknown schema versions while retaining recoverable data', async () => {
    expect(() => parseCanvasBoard({ ...board(), cards: [{ noteId: 1, x: NaN, y: 0 }] })).toThrow();
    expect(() => parseCanvasBoard({ ...board(), connections: [{ id: 'bad', from: 1, to: 99 }] })).toThrow();
    const { transport } = server(); const state = await client(transport);
    await state.set('board.legacy', board() as never, CANVAS_SCHEMA, 2);
    expect(() => readSyncedCanvas(state)).toThrow('Unsupported canvas version');
    expect(state.recoverySnapshot().entries[0].pending?.schemaVersion).toBe(2); state.close();
  });
});

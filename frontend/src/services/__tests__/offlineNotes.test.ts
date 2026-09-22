import { describe, expect, it, vi } from 'vitest';
import { OfflineNotes, NoteHttpError, type OfflineNoteSnapshot } from '../offlineNotes';
import type { CoreNote } from '@modulo/core';
type WorkspaceNote = Omit<CoreNote, 'tags'> & { tags?: CoreNote['tags'] };

const original: WorkspaceNote = { id: 1, title: 'Original', content: 'Before', version: 1, tags: [{ id: 'tag', name: 'Keep' }] };
function setup() {
  let remote = structuredClone(original), online = true, valid = true;
  const snapshots = new Map<string, OfflineNoteSnapshot>();
  const cache = { load: vi.fn(async (key: string) => structuredClone(snapshots.get(key) ?? null)),
    save: vi.fn(async (key: string, value: OfflineNoteSnapshot) => { snapshots.set(key, structuredClone(value)); }) };
  const transport = {
    list: vi.fn(async () => { if (!online) throw new TypeError('Offline'); return [remote]; }),
    get: vi.fn(async () => { if (!online) throw new TypeError('Offline'); return structuredClone(remote); }),
    put: vi.fn(async (_id: number, body: { title: string; content: string; version?: number }) => {
      if (!online) throw new TypeError('Offline');
      if (body.version !== remote.version) throw new NoteHttpError(409);
      remote = { ...remote, ...body, version: remote.version! + 1 }; return remote;
    }),
  };
  const open = (key = 'alice') => new OfflineNotes(key, cache, transport, () => valid, work => work());
  return { transport, cache, open, offline: () => { online = false; }, online: () => { online = true; }, revoke: () => { valid = false; }, change: () => { remote = { ...remote, content: 'Changed elsewhere', version: 2 }; }, remote: () => remote };
}
describe('durable workspace note edits', () => {
  it('reads cached notes after restart and replays the reviewed edit with tags', async () => {
    const env = setup(); const client = env.open(); await client.list(); env.offline();
    await client.update(1, { title: 'Offline edit', content: 'After', version: 1 });
    const resumed = env.open(); expect((await resumed.list())[0].title).toBe('Offline edit');
    expect(resumed.snapshot().pending['1'].baseVersion).toBe(1);
    env.online(); await resumed.synchronize();
    expect(env.transport.put).toHaveBeenCalledWith(1, expect.objectContaining({ version: 1, tagNames: ['Keep'] }));
    expect(resumed.snapshot().pending).toEqual({});
  });
  it('reloads the durable queue under the lock so another tab cannot erase a pending edit', async () => {
    const env = setup(); const first = env.open(); const second = env.open();
    await first.list(); await second.list(); env.offline();
    await first.update(1, { title: 'First tab', content: 'Pending', version: 1 });
    await second.synchronize();
    expect(second.snapshot().pending['1'].body.content).toBe('Pending');
    env.online(); await second.synchronize(); await first.synchronize();
    expect(env.transport.put).toHaveBeenCalledTimes(1);
    expect(first.snapshot().pending).toEqual({});
  });
  it('refuses to replace another tab’s pending edit until its text has been reviewed', async () => {
    const env = setup(); const first = env.open(); const stale = env.open();
    await first.list(); await stale.list(); env.offline();
    await first.update(1, { title: 'First tab', content: 'Pending', version: 1 });
    await expect(stale.update(1, { title: 'Second tab', content: 'Unreviewed', version: 1,
      expectedLocal: { title: 'Original', content: 'Before' } })).rejects.toThrow('Another editor changed');
    expect(stale.snapshot().pending['1'].body.content).toBe('Pending');
    const reviewed = (await stale.list())[0];
    await stale.update(1, { title: 'Second tab', content: 'Reviewed replacement', version: reviewed.version,
      expectedLocal: { title: reviewed.title, content: reviewed.content, markdownContent: reviewed.markdownContent } });
    expect(stale.snapshot().pending['1'].body.content).toBe('Reviewed replacement');
    expect(stale.snapshot().pending['1'].body).not.toHaveProperty('expectedLocal');
  });
  it('does not overwrite a concurrent edit and supports reviewed local resolution', async () => {
    const env = setup(); const client = env.open(); await client.list(); env.offline();
    await client.update(1, { title: 'Local', content: 'Local body', version: 1 });
    env.change(); env.online(); await client.synchronize();
    expect(env.transport.put).not.toHaveBeenCalled(); expect(client.snapshot().pending['1'].conflict?.content).toBe('Changed elsewhere');
    await client.resolve(1, 'local'); expect(env.remote().content).toBe('Local body'); expect(env.remote().version).toBe(3);
  });
  it('accepts the remote version only after an explicit choice', async () => {
    const env = setup(); const client = env.open(); await client.list(); env.offline();
    await client.update(1, { title: 'Local', content: 'Local', version: 1 }); env.change(); env.online(); await client.synchronize();
    await client.resolve(1, 'remote'); expect(client.snapshot().pending).toEqual({}); expect((await client.get(1)).content).toBe('Changed elsewhere');
  });
  it('acknowledges a lost PUT response without writing twice', async () => {
    const env = setup(); const client = env.open(); await client.list();
    const put = env.transport.put.getMockImplementation()!;
    env.transport.put.mockImplementationOnce(async (id, body) => { await put(id, body); throw new TypeError('Response lost'); });
    await client.update(1, { title: 'Updated', content: 'After', version: 1 });
    const resumed = env.open(); await resumed.synchronize();
    expect(env.transport.put).toHaveBeenCalledTimes(1); expect(resumed.snapshot().pending).toEqual({});
  });
  it('rejects storage failure before sending a mutation', async () => {
    const env = setup(); const client = env.open(); await client.list();
    env.cache.save.mockImplementation(() => Promise.reject(new Error('Quota')));
    await expect(client.update(1, { title: 'Changed', content: 'Body', version: 1 })).rejects.toThrow('Quota');
    expect(env.transport.put).not.toHaveBeenCalled();
  });
  it('keeps online notes readable when cache storage is full', async () => {
    const env = setup(); const client = env.open();
    env.cache.save.mockImplementation(() => Promise.reject(new Error('Quota')));
    expect(await client.list()).toEqual([original]); expect(client.cacheError).toBe('Quota');
  });
  it('isolates accounts and refuses an in-flight account change', async () => {
    const env = setup(); const client = env.open(); await client.list();
    expect(env.open('bob').snapshot().notes).toEqual([]); env.revoke();
    await expect(client.update(1, { title: 'No', content: 'No', version: 1 })).rejects.toThrow('Account changed');
  });
  it('does not treat permission failures as an offline cache hit', async () => {
    const env = setup(); const client = env.open(); await client.list(); env.transport.list.mockRejectedValueOnce(new NoteHttpError(403));
    await expect(client.list()).rejects.toThrow('403');
  });
});

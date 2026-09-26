import { describe, expect, it, vi } from 'vitest';
import { importShare, shareMarker, sharedNote, type SharedItem } from '../androidShare';
import type { DeviceDocuments } from '../deviceDocuments';

const memory = (): DeviceDocuments & { values: Map<string, unknown> } => {
  const values = new Map<string, unknown>();
  return { values, get: async <T,>(key: string) => structuredClone(values.get(key)) as T | undefined,
    set: async (key, value) => { values.set(key, structuredClone(value)); }, remove: async key => { values.delete(key); },
    removeIfEqual: async () => false };
};
const share = (patch: Partial<SharedItem> = {}): SharedItem => ({ id: '11111111-2222-4333-8444-555555555555', receivedAt: 1,
  files: [], skipped: [], ...patch });

describe('shared note text', () => {
  it('turns a bare link into a titled, linked note with the retry marker', () => {
    expect(sharedNote(share({ text: 'https://example.org/article?id=1' }))).toEqual({
      title: 'example.org', content: `<https://example.org/article?id=1>\n\n${shareMarker(share().id)}`,
    });
  });
  it('lists what could not be kept', () => {
    const note = sharedNote(share({ subject: 'Scans', files: [{ name: 'big.pdf', mime: 'application/pdf', size: 11 * 1024 * 1024 }],
      skipped: ['permission revoked for a.jpg'] }));
    expect(note.title).toBe('Scans');
    expect(note.content).toContain('- permission revoked for a.jpg');
    expect(note.content).toContain('- big.pdf is larger than 10 MB and was not attached.');
  });
});

describe('share import', () => {
  const files = [{ name: 'a.png', mime: 'image/png', size: 3 }, { name: 'b.pdf', mime: 'application/pdf', size: 3 }];
  const deps = (documents = memory()) => ({
    documents,
    bridge: { readFile: vi.fn(async () => ({ data: btoa('abc') })), complete: vi.fn(async () => {}) },
    findNote: vi.fn(async () => undefined as number | undefined),
    createNote: vi.fn(async () => 42),
    upload: vi.fn(async (...args: [number, File]) => { void args; }),
  });

  it('creates one note, uploads every file and completes the share', async () => {
    const d = deps();
    expect(await importShare(share({ files }), d)).toEqual({ noteId: 42, failed: [] });
    expect(d.upload).toHaveBeenCalledTimes(2);
    expect(vi.mocked(d.upload).mock.calls[1][1].name).toBe('b.pdf');
    expect(d.bridge.complete).toHaveBeenCalledWith({ id: share().id });
    expect(d.documents.values.size).toBe(0);
  });

  it('keeps the share pending after a failed upload and resumes without duplicates', async () => {
    const documents = memory();
    const first = deps(documents);
    first.upload.mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error('offline'));
    expect(await importShare(share({ files }), first)).toEqual({ noteId: 42, failed: ['b.pdf: offline'] });
    expect(first.bridge.complete).not.toHaveBeenCalled();

    const retry = deps(documents);
    expect(await importShare(share({ files }), retry)).toEqual({ noteId: 42, failed: [] });
    expect(retry.createNote).not.toHaveBeenCalled();
    expect(retry.upload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(retry.upload).mock.calls[0][1].name).toBe('b.pdf');
    expect(retry.bridge.complete).toHaveBeenCalled();
  });

  it('finds the note a killed import already created instead of creating another', async () => {
    const d = deps();
    d.findNote.mockResolvedValue(7);
    expect((await importShare(share({ text: 'hello' }), d)).noteId).toBe(7);
    expect(d.findNote).toHaveBeenCalledWith(shareMarker(share().id));
    expect(d.createNote).not.toHaveBeenCalled();
  });
});

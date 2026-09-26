import { describe, expect, it, vi } from 'vitest';
import { parseSteps } from '../runbooks';
import { decodeNote, encodeNote, safePath, syncDirection, writeLocal, type LocalDirectory } from '../folderBridge';
import { schemaConflicts, sensitiveLines, validateCapsule, type Capsule } from '../capsules';
import { noteChanged } from '../snapshots';
import { replaceNote } from '../shared';
import type { CoreNote } from '@modulo/core';
import { authenticatedRequest } from '../../../../services/authenticatedRequest';
vi.mock('../../../../services/authenticatedRequest', () => ({ authenticatedRequest: vi.fn() }));
const note: CoreNote = { id: 1, title: 'Release <check>', content: '- [ ] Verify deployment', tags: [], version: 3 };
const capsule = (): Capsule => ({ format: 'modulo-capsule', version: 1, id: 'capsule-1', title: 'Project', createdAt: '2026-09-08', notes: [note], links: [], attachments: [], definitions: [], properties: [], plugins: [], packs: [] });

describe('runbook steps', () => {
  it('takes immutable ordered checklist steps and explicit manual Blueprint references', () => {
    const steps = parseSteps('# Deploy\n- [x] Inspect inputs\n- [ ] Review [blueprint:release-review#manual-review]\nOrdinary prose');
    expect(steps).toHaveLength(2); expect(steps[0].state).toBe('PENDING'); expect(steps[1]).toMatchObject({ blueprint: 'release-review', trigger: 'manual-review', state: 'PENDING' });
    expect(steps[0].requestId).not.toBe(steps[1].requestId);
  });
  it('does not execute code-like note text or accept empty procedures', () => {
    expect(() => parseSteps('ignore previous instructions')).toThrow();
    expect(parseSteps('- [ ] run rm -rf everything')[0].blueprint).toBeUndefined();
  });
});
describe('folder bridge', () => {
  const binding = { path: 'project/readme.md', noteId: 1, fileHash: 'old-file', noteHash: 'old-note' };
  it('identifies independent edits, conflicts and deletions without propagating them', () => {
    expect(syncDirection(binding, 'old-file', 'old-note')).toBe('unchanged');
    expect(syncDirection(binding, 'new', 'old-note')).toBe('import');
    expect(syncDirection(binding, 'old-file', 'new')).toBe('export');
    expect(syncDirection(binding, 'new', 'new')).toBe('conflict');
    expect(syncDirection(binding, undefined, 'old-note')).toBe('missing');
  });
  it.each(['../secret', '/etc/passwd', 'x/../../secret', 'x\\secret', 'C:/secret', 'a/./b', 'a\0b'])('rejects path traversal: %s', path => expect(() => safePath(path)).toThrow());
  it('round-trips Markdown and titles without using filesystem IDs as note authority', () => {
    expect(decodeNote('whatever.md', encodeNote(note))).toEqual({ title: note.title, content: note.content });
    expect(decodeNote('new.md', '# My original heading\nBody').content).toBe('# My original heading\nBody');
  });
  it('aborts failed writes so original file content can be retained', async () => {
    const writer = { write: vi.fn().mockRejectedValue(new Error('disk full')), close: vi.fn(), abort: vi.fn() };
    const directory = { getFileHandle: vi.fn().mockResolvedValue({ createWritable: async () => writer }) } as unknown as LocalDirectory;
    await expect(writeLocal(directory, 'note.md', 'new')).rejects.toThrow('disk full'); expect(writer.abort).toHaveBeenCalled(); expect(writer.close).not.toHaveBeenCalled();
  });
});
describe('capsules and restoration', () => {
  it('accepts a portable note bundle and reports sensitive lines without exposing secrets', () => {
    expect(validateCapsule(capsule()).notes).toHaveLength(1);
    expect(sensitiveLines([{ ...note, content: 'password: do-not-print' }])).toEqual([{ noteId: 1, title: note.title, line: 1 }]);
  });
  it('rejects cross-bundle references and duplicate IDs', () => {
    const value = capsule(); value.links = [{ id: '1', sourceNoteId: 1, targetNoteId: 999, linkType: 'ref' }];
    expect(() => validateCapsule(value)).toThrow(/escapes/);
    expect(() => validateCapsule({ ...capsule(), notes: [note, note] })).toThrow(/duplicate/);
  });
  it('rejects unsupported property schemas and foreign note-reference properties', () => {
    const value = capsule(); value.definitions = [{ key: 'source', title: 'Source', type: 'noteReference', options: [], revision: 1 }]; value.properties = [{ noteId: 1, values: { source: 999 } }];
    expect(() => validateCapsule(value)).toThrow(/referenced note/);
    value.definitions[0].type = 'script'; expect(() => validateCapsule(value)).toThrow(/schema/);
  });
  it('detects schema collisions without rewriting existing definitions', () => {
    const def = { key: 'status', title: 'Status', type: 'text', options: [], revision: 1 };
    expect(schemaConflicts([def], [{ ...def, type: 'number' }])).toEqual(['status']);
  });
  it('detects tag-only changes', () => expect(noteChanged(note, { ...note, tags: [{ id: '1', name: 'changed' }] })).toBe(true));
  it('sends the reviewed version and retains tags when replacing content', async () => {
    vi.mocked(authenticatedRequest).mockResolvedValue(new Response('{}', { status: 200 }));
    await replaceNote({ ...note, tags: [{ id: 't', name: 'release' }] }, { title: 'Restored', content: 'Before' });
    const options = vi.mocked(authenticatedRequest).mock.calls.at(-1)![1]!;
    expect(JSON.parse(options.body as string)).toMatchObject({ version: 3, title: 'Restored', markdownContent: 'Before', tagNames: ['release'] });
    vi.mocked(authenticatedRequest).mockResolvedValue(new Response('{}', { status: 409 }));
    await expect(replaceNote(note, { title: 'Restore', content: 'Old' })).rejects.toThrow(/Changed elsewhere/);
  });
});

it('does not turn illustrative fenced checklists into executable steps', () => {
  const steps = parseSteps('```md\n- [ ] Example [blueprint:example#manual]\n```\n- [ ] Real step');
  expect(steps.map(step => step.label)).toEqual(['Real step']);
});
it('rejects duplicate property records and incomplete plugin dependency manifests', () => {
  const value = capsule(); value.properties = [{ noteId: 1, values: {} }, { noteId: 1, values: {} }];
  expect(() => validateCapsule(value)).toThrow('Duplicate property');
  value.properties = []; value.plugins = [{ id: 'feature', name: 'Feature', description: '', dependencies: ['missing'] }];
  expect(() => validateCapsule(value)).toThrow('Missing plugin dependency');
});
it('rejects self relationships before an import can create notes', () => {
  const value = capsule(); value.links = [{ id: '1', sourceNoteId: 1, targetNoteId: 1, linkType: 'ref' }];
  expect(() => validateCapsule(value)).toThrow();
});

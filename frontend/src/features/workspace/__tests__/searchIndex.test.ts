import { describe, expect, it, vi } from 'vitest';
import { referencedNotes, searchableText, searchEntities, stateEntities } from '../searchIndex';
import { entityPath } from '../entityNavigation';
import { captureDocument, documentNote } from '../documentCapture';
import { emptyLifeCollection, parseLifeCollection } from '../lifeStore';

describe('workspace search and references', () => {
  it('indexes nested OCR, reviews and checklist content without credential fields', () => {
    const text = searchableText({ title: 'Report', values: { ocrText: 'Mitochondria', accessToken: 'PRIVATE' }, log: [{ title: 'Reviewed evidence' }] });
    expect(text).toContain('Mitochondria'); expect(text).toContain('Reviewed evidence'); expect(text).not.toContain('PRIVATE');
  });
  it('finds explicit references including serialized evidence without treating arbitrary numbers as links', () => {
    expect(referencedNotes({ noteIds: [2, 3], values: { sourceNoteId: '4', evidence: '[{"noteId":5}]', amount: '6', source: 'note:7' } }).sort()).toEqual([2, 3, 4, 5, 7]);
  });
  it('opens projects and receipts at their exact records and searches nested evidence', () => {
    const projects = stateEntities('project-workspaces', 'Projects', { version: 1, data: { projects: [{ id: 'a b', title: 'Release', noteIds: [3], description: 'Acceptance complete' }] } });
    expect(entityPath(projects[0])).toBe('project-workspaces?project=a%20b'); expect(searchEntities(projects, 'acceptance release')).toHaveLength(1);
    const runs = stateEntities('executable-runbooks', 'Runbooks', { data: { runs: [{ id: 'run', title: 'Deploy', noteId: 3, steps: [{ evidence: 'checksum verified' }] }] } });
    expect(entityPath(runs[0])).toBe('executable-runbooks?run=run'); expect(searchEntities(runs, 'checksum')).toHaveLength(1);
  });
  it('retains provenance and reuses a previously created document note on retry', async () => {
    const document = parseLifeCollection({ ...emptyLifeCollection(), records: [{ id: 'doc', title: 'Evidence', values: { ocrText: 'Extracted', checksum: 'abc', location: '/original.pdf' } }] }).records[0];
    const payload = documentNote(document); expect(payload.content).toContain('/original.pdf'); expect(payload.content).toContain('abc');
    const createNote = vi.fn(); const existing = { id: 4, title: payload.title, content: payload.content, tags: [] };
    expect(await captureDocument(document, { notes: async () => [existing], createNote })).toEqual(existing); expect(createNote).not.toHaveBeenCalled();
  });
});

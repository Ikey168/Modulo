import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { newLearningRecord } from '../../learningTools';
import { CATALOG } from '../../plugins/catalog';
import { PACKS } from '../../plugins/packs';
import { attachProjectNote, bundleNoteIds, detachProjectNote, newProject, projectBundle, projectTasks, remapProjectBundle, toggleProjectTask, validateProjectBundle, validateProjects } from '../projects';
import { parseSteps } from '../runbooks';
import { validateCapsule, type Capsule } from '../capsules';
const note: CoreNote = { id: 1, title: 'Project', content: '- [ ] Verify release due:: 2026-10-01\r\n- [x] Verify release\r\n', tags: [], version: 1 };
const project = () => attachProjectNote(newProject('Release'), 1, 'procedure');
const decision = () => ({ ...newLearningRecord('Pending review', 'Project'), title: 'Release cadence', values: { choice: 'Weekly', expectedOutcome: 'Predictability', sourceNoteId: '2' } });
const bundle = () => { const d = decision(); return projectBundle({ ...project(), decisionIds: [d.id] }, [d], [{ id: 'run-1', noteId: 1, title: note.title, source: note.content, startedAt: '2026-09-08', steps: parseSteps(note.content) }]); };
describe('project workspaces', () => {
  it('registers a runnable plugin with the required integrations in Workspace Tools', () => {
    const manifest = CATALOG.find(plugin => plugin.id === 'project-workspaces');
    expect(manifest?.load).toBeTypeOf('function'); expect(manifest?.dependencies).toEqual(expect.arrayContaining(['notes-editor', 'decision-journal', 'executable-runbooks', 'workspace-capsules']));
    expect(PACKS.find(pack => pack.id === 'pack-workspace-tools')?.pluginIds).toContain('project-workspaces');
  });
  it('adds roles without duplicate membership and detaches every role without mutating the original', () => {
    const p = project(); const next = attachProjectNote(p, 1, 'evidence');
    expect(validateProjects({ projects: [next] }).projects[0].noteIds).toEqual([1]);
    const removed = detachProjectNote(next, 1); expect([removed.noteIds, removed.evidenceIds, removed.procedureIds]).toEqual([[], [], []]);
    expect(p.noteIds).toEqual([1]);
  });
  it('rejects malformed references, duplicate project IDs, invalid deadlines and roles outside membership', () => {
    const p = project();
    expect(() => validateProjects({ projects: [p, p] })).toThrow('Duplicate');
    expect(() => validateProjects({ projects: [{ ...p, evidenceIds: [2] }] })).toThrow('member notes');
    expect(() => validateProjects({ projects: [{ ...p, deadline: '2026-02-30' }] })).toThrow('deadline');
    expect(() => validateProjects({ projects: [{ ...p, noteIds: [NaN] }] })).toThrow('references');
  });
  it('edits only the selected task and preserves line endings and identical task titles', () => {
    const tasks = projectTasks([note]); expect(tasks).toHaveLength(2); expect(tasks[0].due).toBe('2026-10-01');
    expect(toggleProjectTask(tasks[1], note.content)).toBe('- [ ] Verify release due:: 2026-10-01\r\n- [ ] Verify release\r\n');
    expect(() => toggleProjectTask(tasks[0], 'changed\n' + note.content)).toThrow('changed');
  });
  it('ignores checklist examples inside code fences and supports numbered tasks', () => {
    const tasks = projectTasks([{ ...note, content: '```md\n- [ ] Example\n```\n1. [ ] Actual\n~~~\n- [ ] Example\n~~~\n+ [x] Done' }]);
    expect(tasks.map(task => task.title)).toEqual(['Actual', 'Done']);
  });
  it('exports evidence-note dependencies and only linked decisions/procedure runs', () => {
    const b = bundle(); expect(bundleNoteIds(b).sort()).toEqual([1, 2]); expect(validateProjectBundle(b, new Set([1, 2]))).toEqual(b);
    expect(() => validateProjectBundle(b, new Set([1]))).toThrow('outside');
    expect(() => projectBundle(b.workspace, [], b.runs)).toThrow('unavailable decisions');
  });
  it('remaps all IDs and imports runbook receipts without live execution authority', () => {
    const b = bundle(); b.runs[0].steps[0].runId = 'foreign-execution';
    const restored = remapProjectBundle(b, { 1: 51, 2: 52 }, 'imported-project');
    expect(restored.workspace.noteIds).toEqual([51]); expect(restored.workspace.procedureIds).toEqual([51]);
    expect(restored.workspace.decisionIds).toEqual([restored.decisions[0].id]); expect(restored.decisions[0].values.sourceNoteId).toBe('52');
    expect(restored.runs[0].noteId).toBe(51); expect(restored.runs[0].imported).toBe(true); expect(restored.runs[0].steps[0].runId).toBeUndefined();
    expect(remapProjectBundle(b, { 1: 51, 2: 52 }, 'imported-project').runs[0].id).toBe(restored.runs[0].id);
    expect(() => remapProjectBundle(b, { 1: 51 }, 'imported-project')).toThrow('incomplete');
  });
  it('validates project extensions while accepting legacy capsules', () => {
    const capsule: Capsule = { format: 'modulo-capsule', version: 1, id: 'bundle', title: 'Release', createdAt: '', notes: [note, { ...note, id: 2 }], links: [], attachments: [], properties: [], definitions: [], plugins: [], packs: [] };
    expect(validateCapsule(capsule)).toBe(capsule);
    capsule.project = bundle(); expect(validateCapsule(capsule).project).toBeDefined();
    capsule.project.workspace.decisionIds = []; expect(() => validateCapsule(capsule)).toThrow('decision references');
  });
});

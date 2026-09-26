import type { CoreNote } from '@modulo/core';
import type { LifeRecord } from '../lifeStore';
import { bodyOf, now, object, text, uid } from './shared';
import { validateDecisions } from './decisions';
import { validateRunbooks, type RunbookRun } from './runbooks';
import { parseTaskTags, serializeTaskTags } from '../../taskTags';

export const PROJECTS_ID = 'project-workspaces';
export const PROJECT_STATUSES = ['Active', 'On hold', 'Completed', 'Archived'] as const;
export interface ProjectWorkspace {
  id: string;
  title: string;
  description: string;
  status: typeof PROJECT_STATUSES[number];
  deadline: string;
  noteIds: number[];
  evidenceIds: number[];
  procedureIds: number[];
  decisionIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface ProjectsState { projects: ProjectWorkspace[] }
export interface ProjectBundle { workspace: ProjectWorkspace; decisions: LifeRecord[]; runs: RunbookRun[] }
export const emptyProjects: ProjectsState = { projects: [] };
export function newProject(title: string): ProjectWorkspace {
  return { id: uid(), title: title.trim(), description: '', status: 'Active', deadline: '', noteIds: [], evidenceIds: [], procedureIds: [], decisionIds: [], createdAt: now(), updatedAt: now() };
}
function unique<T>(values: T[], label: string) { if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}.`); }
export function validateProjects(value: unknown): ProjectsState {
  const root = object(value);
  if (!Array.isArray(root.projects) || root.projects.length > 500) throw new Error('At most 500 projects can be stored.');
  const ids: string[] = [];
  for (const raw of root.projects) {
    const project = object(raw); const id = text(project.id, 128); ids.push(id);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !text(project.title, 180).trim()) throw new Error('A project needs an ID and title.');
    text(project.description, 20000); text(project.createdAt, 100); text(project.updatedAt, 100);
    if (!PROJECT_STATUSES.includes(project.status as ProjectWorkspace['status'])) throw new Error('Invalid project status.');
    const deadline = text(project.deadline, 10);
    if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)) throw new Error('Invalid project deadline.');
    for (const key of ['noteIds', 'evidenceIds', 'procedureIds']) {
      const values = project[key];
      if (!Array.isArray(values) || values.length > 5000 || values.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid project note references.');
      unique(values, 'note reference');
    }
    if ([...project.evidenceIds as number[], ...project.procedureIds as number[]].some(id => !(project.noteIds as number[]).includes(id))) throw new Error('Project evidence and procedures must be member notes.');
    if (!Array.isArray(project.decisionIds) || project.decisionIds.length > 2000) throw new Error('Invalid project decisions.');
    project.decisionIds.forEach(id => { if (!text(id, 128)) throw new Error('Invalid decision reference.'); }); unique(project.decisionIds, 'decision reference');
  }
  unique(ids, 'project ID');
  return value as ProjectsState;
}
export function attachProjectNote(project: ProjectWorkspace, noteId: number, role: 'note' | 'evidence' | 'procedure'): ProjectWorkspace {
  return { ...project, updatedAt: now(), noteIds: [...new Set([...project.noteIds, noteId])],
    evidenceIds: role === 'evidence' ? [...new Set([...project.evidenceIds, noteId])] : project.evidenceIds,
    procedureIds: role === 'procedure' ? [...new Set([...project.procedureIds, noteId])] : project.procedureIds };
}
export function detachProjectNote(project: ProjectWorkspace, noteId: number): ProjectWorkspace {
  return { ...project, updatedAt: now(), noteIds: project.noteIds.filter(id => id !== noteId), evidenceIds: project.evidenceIds.filter(id => id !== noteId), procedureIds: project.procedureIds.filter(id => id !== noteId) };
}
export interface ProjectTask { note: CoreNote; line: number; original: string; title: string; done: boolean; due?: string; tags: string[] }

const taskTagsSuffix = /\s+tags::\s*(.+?)\s*$/i;

export function projectTasks(notes: CoreNote[]): ProjectTask[] {
  return notes.flatMap(note => {
    let fence = '';
    return bodyOf(note).split('\n').flatMap((original, line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(original)?.[1];
      if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; return []; }
      if (fence) return [];
      const match = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\r?$/.exec(original);
      if (!match) return [];
      const rawTitle = match[2].trim();
      const tagsMatch = taskTagsSuffix.exec(rawTitle);
      const tags = parseTaskTags(tagsMatch?.[1]);
      const title = tagsMatch ? rawTitle.slice(0, tagsMatch.index).trim() : rawTitle;
      return [{ note, line, original, title, done: match[1] !== ' ', due: /(?:due::\s*|📅\s*)(\d{4}-\d{2}-\d{2})/.exec(title)?.[1], tags }];
    });
  });
}
export function toggleProjectTask(task: ProjectTask, markdown: string): string {
  const lines = markdown.split('\n');
  if (lines[task.line] !== task.original) throw new Error('This task changed. Refresh the project before editing it.');
  lines[task.line] = lines[task.line].replace(/\[([ xX])\]/, task.done ? '[ ]' : '[x]');
  return lines.join('\n');
}

export function updateProjectTaskTags(task: ProjectTask, markdown: string, tags: string[]): string {
  const lines = markdown.split('\n');
  if (lines[task.line] !== task.original) throw new Error('This task changed. Refresh the project before editing it.');
  const withoutTags = lines[task.line].replace(taskTagsSuffix, '').trimEnd();
  const serialized = serializeTaskTags(tags);
  lines[task.line] = serialized ? `${withoutTags} tags:: ${serialized}` : withoutTags;
  return lines.join('\n');
}
export function projectBundle(workspace: ProjectWorkspace, decisions: LifeRecord[], runs: RunbookRun[]): ProjectBundle {
  const members = decisions.filter(decision => workspace.decisionIds.includes(decision.id));
  if (members.length !== workspace.decisionIds.length) throw new Error('Detach unavailable decisions before exporting this project.');
  return { workspace, decisions: members, runs: runs.filter(run => workspace.procedureIds.includes(run.noteId) && (!run.projectId || run.projectId === workspace.id)) };
}
export function bundleNoteIds(bundle: ProjectBundle): number[] {
  return [...new Set([...bundle.workspace.noteIds, ...bundle.decisions.flatMap(decision => decision.values.sourceNoteId ? [Number(decision.values.sourceNoteId)] : []), ...bundle.runs.map(run => run.noteId)])];
}
export function validateProjectBundle(value: unknown, noteIds: Set<number>): ProjectBundle {
  const raw = object(value); validateProjects({ projects: [raw.workspace] });
  validateDecisions({ version: 1, records: raw.decisions, occurrenceCompletions: [] }); validateRunbooks({ runs: raw.runs });
  const bundle = value as ProjectBundle;
  if (bundleNoteIds(bundle).some(id => !noteIds.has(id))) throw new Error('Project references a note outside the capsule.');
  if (bundle.workspace.decisionIds.length !== bundle.decisions.length || bundle.decisions.some(d => !bundle.workspace.decisionIds.includes(d.id))) throw new Error('Project decision references do not match its records.');
  if (bundle.runs.some(run => !bundle.workspace.procedureIds.includes(run.noteId) || (run.projectId && run.projectId !== bundle.workspace.id)) || new Set(bundle.runs.map(run => run.id)).size !== bundle.runs.length) throw new Error('Invalid project runbook receipts.');
  return bundle;
}
export function remapProjectBundle(bundle: ProjectBundle, mapping: Record<string, number>, id: string): ProjectBundle {
  const noteId = (source: number) => { const target = mapping[source]; if (!Number.isSafeInteger(target) || target < 1) throw new Error('Project note mapping is incomplete.'); return target; };
  const decisions = bundle.decisions.map((decision, index) => ({ ...decision, id: `${id}-d${index}`, projectId: undefined, values: { ...decision.values, ...(decision.values.sourceNoteId ? { sourceNoteId: String(noteId(Number(decision.values.sourceNoteId))) } : {}) } }));
  const runs = bundle.runs.map((run, index) => ({ ...run, id: `${id}-r${index}`, noteId: noteId(run.noteId), projectId: id, imported: true, steps: run.steps.map((step, index) => ({ ...step, requestId: `${id}-s${index}`, runId: undefined })) }));
  return { workspace: { ...bundle.workspace, id, noteIds: bundle.workspace.noteIds.map(noteId), evidenceIds: bundle.workspace.evidenceIds.map(noteId), procedureIds: bundle.workspace.procedureIds.map(noteId), decisionIds: decisions.map(d => d.id), createdAt: now(), updatedAt: now() }, decisions, runs };
}

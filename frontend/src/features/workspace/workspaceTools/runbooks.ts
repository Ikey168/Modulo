import { object, text } from './shared';
export interface RunStep { label: string; blueprint?: string; trigger?: string; requestId: string; state: string; runId?: string; evidence?: string; completedAt?: string }
export interface RunbookRun { id: string; noteId: number; title: string; source: string; startedAt: string; steps: RunStep[]; imported?: boolean; projectId?: string }
export interface Runbooks { runs: RunbookRun[] }
export const emptyRunbooks: Runbooks = { runs: [] };
export function parseSteps(markdown: string): RunStep[] {
  let fence: string | undefined;
  const steps = markdown.split('\n').flatMap(rawLine => {
    const line = rawLine.replace(/\r$/, '');
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined; return []; }
    if (fence) return [];
    const match = /^\s*[-*] \[[ xX]\]\s+(.+)$/.exec(line);
    if (!match) return [];
    const automation = /\s*\[blueprint:([^\]#]+)#([^\]]+)\]\s*$/.exec(match[1]);
    if (automation && (!automation[1].trim() || !automation[2].trim())) throw new Error('Blueprint steps need a name and manual trigger ID.');
    return [{ label: automation ? match[1].slice(0, automation.index).trim() : match[1],
      ...(automation ? { blueprint: automation[1].trim(), trigger: automation[2].trim() } : {}),
      requestId: crypto.randomUUID(), state: 'PENDING' }];
  });
  if (!steps.length || steps.length > 100) throw new Error('Use between 1 and 100 Markdown checklist steps.');
  return steps;
}
export function validateRunbooks(value: unknown): Runbooks {
  const root = object(value);
  if (!Array.isArray(root.runs) || root.runs.length > 500) throw new Error('Invalid run history.');
  for (const item of root.runs) {
    const run = object(item); text(run.id, 128); text(run.title); text(run.source); text(run.startedAt, 100); if (run.projectId !== undefined) text(run.projectId, 128); if (run.imported !== undefined && typeof run.imported !== 'boolean') throw new Error('Invalid imported receipt.');
    if (!Number.isSafeInteger(run.noteId) || Number(run.noteId) < 1 || !Array.isArray(run.steps) || !run.steps.length || run.steps.length > 100) throw new Error('Invalid run.');
    for (const item of run.steps) { const step = object(item); text(step.label); text(step.requestId, 128); text(step.state, 30); if (!['PENDING', 'REQUESTED', 'QUEUED', 'RUNNING', 'WAITING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTER'].includes(String(step.state))) throw new Error('Invalid step state.'); for (const key of ['blueprint', 'trigger', 'runId', 'evidence', 'completedAt']) if (step[key] !== undefined) text(step[key]); if (Boolean(step.blueprint) !== Boolean(step.trigger)) throw new Error('Invalid Blueprint step.'); }
  }
  return value as Runbooks;
}

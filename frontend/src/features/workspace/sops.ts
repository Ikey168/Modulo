
export const SOPS_STORE_KEY = 'modulo-personal-sops-v1';
export interface SopProcedure {
  id: string;
  title: string;
  description: string;
  steps: string[];
  noteIds: number[];
  archived: boolean;
  updatedAt: string;
}
export interface SopRun {
  id: string;
  procedureId: string;
  title: string;
  description: string;
  steps: Array<{ title: string; done: boolean }>;
  noteIds: number[];
  notes: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  createdAt: string;
  finishedAt?: string;
}
export interface SopData { version: 1; procedures: SopProcedure[]; runs: SopRun[]; storageError?: string }
export const emptySops = (): SopData => ({ version: 1, procedures: [], runs: [] });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
const noteIds = (value: unknown) => Array.isArray(value) && value.every((id) => Number.isSafeInteger(id) && id > 0);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function parseSops(value: unknown): SopData {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.procedures) || !Array.isArray(value.runs)) throw new Error('Invalid SOP backup.');
  for (const collection of [value.procedures, value.runs]) {
    const ids = new Set<string>();
    for (const item of collection) {
      if (!record(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || typeof item.description !== 'string' || !noteIds(item.noteIds)) throw new Error('Invalid SOP record.');
      ids.add(item.id);
    }
  }
  for (const p of value.procedures) {
    if (!strings(p.steps) || !p.steps.length || typeof p.archived !== 'boolean' || !date(p.updatedAt)) throw new Error('Invalid procedure.');
  }
  for (const r of value.runs) {
    if (typeof r.procedureId !== 'string' || typeof r.notes !== 'string' || !['Active', 'Completed', 'Cancelled'].includes(r.status) || !date(r.createdAt) || (r.status !== 'Active' && !date(r.finishedAt)) || !Array.isArray(r.steps) || !r.steps.length || !r.steps.every((s: unknown) => record(s) && typeof s.title === 'string' && s.title.trim() && typeof s.done === 'boolean') || (r.status === 'Completed' && r.steps.some((s: { done: boolean }) => !s.done))) throw new Error('Invalid procedure run.');
  }
  return { version: 1, procedures: value.procedures, runs: value.runs };
}export function startSopRun(procedure: SopProcedure): SopRun {
  if (procedure.archived) throw new Error('Restore the procedure before starting a run.');
  return {
    id: crypto.randomUUID(), procedureId: procedure.id, title: procedure.title,
    description: procedure.description, steps: procedure.steps.map((title) => ({ title, done: false })),
    noteIds: [...procedure.noteIds], notes: '', status: 'Active', createdAt: new Date().toISOString(),
  };
}
export function finishSopRun(run: SopRun, status: 'Completed' | 'Cancelled'): SopRun {
  if (run.status !== 'Active') return run;
  if (status === 'Completed' && !run.steps.every((step) => step.done)) throw new Error('Complete every step first.');
  return { ...run, status, finishedAt: new Date().toISOString() };
}

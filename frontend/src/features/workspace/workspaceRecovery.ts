/** Device-local recovery journal. Written before a mutation; deleted data never ages out. */
export const RECOVERY_KEY = 'modulo-workspace-recovery-v1';
export const NOTE_TRASH_KEY = 'modulo-note-trash-v1';
export const NOTE_REVISIONS_KEY = 'modulo-note-revisions-v1';
export const RECOVERY_EVENT = 'modulo:recovery';
export interface Change {
  key: string;
  before: string | null;
  after: string;
}
export interface RecoveryEntry {
  id: string;
  date: string;
  deleted: boolean;
  changes: Change[];
}
export interface NoteRevision {
  id: string;
  noteId: number;
  title: string;
  content: string;
  date: string;
}
export function readRecovery(): RecoveryEntry[] {
  return readJson(RECOVERY_KEY, []);
}
export function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identified = (
  value: unknown[],
): value is Array<Record<string, unknown> & { id: string | number }> =>
  value.every(
    (item) =>
      object(item) &&
      (typeof item.id === 'string' || typeof item.id === 'number'),
  );
function hasDeletion(before: unknown, after: unknown): boolean {
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    identified(before) &&
    identified(after)
  )
    return before.some((item) => !after.some((next) => next.id === item.id));
  if (object(before) && object(after))
    return Object.keys(before).some((key) =>
      hasDeletion(before[key], after[key]),
    );
  return false;
}
let group: string | undefined;
/** Called inside the storage write's try block, so journal failure blocks the edit. */
export function journalWrite(
  key: string,
  before: string | null,
  after: string,
) {
  if (
    before === after ||
    key === RECOVERY_KEY ||
    key === NOTE_REVISIONS_KEY ||
    key === NOTE_TRASH_KEY ||
    key === 'modulo-quick-capture-v1' ||
    key.startsWith('modulo-note-draft-') ||
    key.startsWith('modulo-life-security-')
  )
    return;
  if (!group) {
    group = crypto.randomUUID();
    queueMicrotask(() => {
      group = undefined;
    });
  }
  const entries = readRecovery();
  let entry = entries.find((item) => item.id === group);
  if (!entry) {
    entry = {
      id: group,
      date: new Date().toISOString(),
      deleted: false,
      changes: [],
    };
    entries.unshift(entry);
  }
  const existing = entry.changes.find((change) => change.key === key);
  if (existing) existing.after = after;
  else entry.changes.push({ key, before, after });
  entry.deleted ||= hasDeletion(
    JSON.parse(before || 'null'),
    JSON.parse(after),
  );
  let edits = 0;
  localStorage.setItem(
    RECOVERY_KEY,
    JSON.stringify(entries.filter((item) => item.deleted || edits++ < 40)),
  );
}
/** Reverse only this change, preserving unrelated later work and refusing conflicts. */
export function reverseChange(
  before: unknown,
  after: unknown,
  current: unknown,
): unknown {
  if (equal(before, after)) return current;
  if (equal(current, after)) return before;
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    Array.isArray(current) &&
    identified(before) &&
    identified(after) &&
    identified(current)
  ) {
    const result = [...current];
    for (const id of new Set([...before, ...after].map((item) => item.id))) {
      const old = before.find((item) => item.id === id),
        next = after.find((item) => item.id === id);
      if (equal(old, next)) continue;
      const index = result.findIndex((item) => item.id === id);
      const restored = reverseChange(old, next, result[index]);
      if (restored === undefined) {
        if (index >= 0) result.splice(index, 1);
      } else if (index < 0) result.push(restored as (typeof result)[number]);
      else result[index] = restored as (typeof result)[number];
    }
    return result;
  }
  if (object(before) && object(after) && object(current)) {
    const result = { ...current };
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const restored = reverseChange(before[key], after[key], current[key]);
      if (restored === undefined) delete result[key];
      else result[key] = restored;
    }
    return result;
  }
  throw new Error(
    'This item changed again. Restore the newer change first to avoid overwriting your work.',
  );
}
export function recoverEntry(id: string) {
  const entries = readRecovery(),
    entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error('This recovery entry is no longer available.');
  const planned = entry.changes.map((change) => {
    const current = localStorage.getItem(change.key);
    return {
      key: change.key,
      current,
      restored: reverseChange(
        JSON.parse(change.before || 'null'),
        JSON.parse(change.after),
        JSON.parse(current || 'null'),
      ),
    };
  });
  try {
    planned.forEach(({ key, restored }) => {
      if (restored === null || restored === undefined)
        localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(restored));
    });
    localStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify(entries.filter((item) => item.id !== id)),
    );
  } catch (error) {
    planned.forEach(({ key, current }) => {
      if (current === null) localStorage.removeItem(key);
      else localStorage.setItem(key, current);
    });
    throw error;
  } finally {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(RECOVERY_EVENT));
  }
}

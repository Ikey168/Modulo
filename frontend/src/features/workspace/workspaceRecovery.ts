import { readLegacyValue } from '../../services/legacy/browserLegacyStorage';
/** Keys of the retired device-local recovery journal and the stores it covered. */
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
/**
 * The old device-local change journal. Every store is server-backed now, so
 * nothing writes it and its entries cannot be applied; it stays readable
 * through the legacy accessor for export only.
 */
export function readRecovery(): RecoveryEntry[] {
  const raw = readLegacyValue(RECOVERY_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RecoveryEntry[] : [];
  } catch {
    return [];
  }
}

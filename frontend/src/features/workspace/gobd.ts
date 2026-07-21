// GoBD document vault (#368) — retention tracking and anchoring status for
// business records. Convention: tagging a note `retain/<class>` puts it in the
// vault; its retention runs from the document date to the end of the calendar
// year plus the class period (German retention ends with the calendar year,
// §147 Abs. 3 AO style). Periods are configuration with German defaults, not
// hardcoded law. Anchoring provides tamper-evidence; a documented process
// (Verfahrensdokumentation) is still required for GoBD — this plugin supplies
// mechanics and the template, not compliance by itself.

import type { CoreNote } from '@modulo/core';

export const RETAIN_TAG_PREFIX = 'retain/';

export interface RetentionClass {
  id: string;
  label: string;
  years: number;
}

/** German defaults as of 2025+ (Buchungsbelege 10→8 via BEG IV). Editable. */
export const DEFAULT_RETENTION_CLASSES: RetentionClass[] = [
  { id: 'belege', label: 'Buchungsbelege (Rechnungen, Quittungen)', years: 8 },
  { id: 'buecher', label: 'Bücher & Abschlüsse', years: 10 },
  { id: 'briefe', label: 'Handels- & Geschäftsbriefe', years: 6 },
];

const CLASSES_KEY = 'modulo-gobd-classes';

export function readRetentionClasses(): RetentionClass[] {
  try {
    const raw = localStorage.getItem(CLASSES_KEY);
    if (!raw) return DEFAULT_RETENTION_CLASSES;
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (c) =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as RetentionClass).id === 'string' &&
          typeof (c as RetentionClass).years === 'number',
      )
    ) {
      return parsed as RetentionClass[];
    }
    return DEFAULT_RETENTION_CLASSES;
  } catch {
    return DEFAULT_RETENTION_CLASSES;
  }
}

export function writeRetentionClasses(classes: RetentionClass[]): void {
  try {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  } catch {
    // Storage unavailable — defaults apply next load.
  }
}

/** Retention ends with the calendar year: doc date + years → 31 Dec. */
export function retentionEnd(docDate: string, years: number): string {
  const year = Number(docDate.slice(0, 4));
  return `${year + years}-12-31`;
}

export interface VaultEntry {
  noteId: number;
  noteTitle: string;
  classId: string;
  classLabel: string;
  years: number;
  /** YYYY-MM-DD — from note creation (fallback: last update). */
  docDate: string;
  /** YYYY-MM-DD retention end. */
  retainUntil: string;
  anchored: boolean;
  /** Retention period has passed (reported, never auto-deleted). */
  expired: boolean;
}

export function vaultEntries(notes: CoreNote[], classes: RetentionClass[], today: string): VaultEntry[] {
  const byId = new Map(classes.map((c) => [c.id, c]));
  const out: VaultEntry[] = [];
  for (const note of notes) {
    for (const tag of note.tags) {
      if (!tag.name.startsWith(RETAIN_TAG_PREFIX)) continue;
      const classId = tag.name.slice(RETAIN_TAG_PREFIX.length);
      const cls = byId.get(classId);
      const docDate = (note.createdAt ?? note.updatedAt ?? today).slice(0, 10);
      const years = cls?.years ?? 10;
      const retainUntil = retentionEnd(docDate, years);
      out.push({
        noteId: note.id,
        noteTitle: note.title,
        classId,
        classLabel: cls?.label ?? classId,
        years,
        docDate,
        retainUntil,
        anchored: Boolean(note.isOnBlockchain),
        expired: retainUntil < today,
      });
    }
  }
  return out.sort((a, b) => a.retainUntil.localeCompare(b.retainUntil));
}

export const VERFAHRENSDOKUMENTATION_TEMPLATE = `# Verfahrensdokumentation

Documented process for how business records are created, stored, protected,
and exported in this vault. Review annually and after process changes.

## 1. Scope & systems
- Records covered (invoices, audit reports, receipts, contracts) and their retain/… classes
- Systems involved: Modulo vault, on-chain anchoring (NoteRegistry), backup targets

## 2. Capture (Erfassung)
- How each record type enters the vault (created as note / attached / exported file)
- Naming and tagging conventions (retain/<class>, engagement/…)

## 3. Integrity & immutability (Unveränderbarkeit)
- Records are anchored on-chain after finalisation; the anchor timestamp and tx
  reference evidence the record's state at that time
- Corrections happen as new records referencing the original, never as silent edits

## 4. Retention & deletion (Aufbewahrung)
- Retention classes and periods (see vault configuration)
- Expired records are reviewed by a human before any deletion; nothing is auto-deleted

## 5. Export & handover
- DATEV export cadence and recipient (Steuerberater)
- Format and completeness checks before handover

## 6. Access & backup
- Who can read/modify the vault
- Backup schedule and restore test cadence

## 7. Responsibilities
- Process owner:
- Last review:
`;

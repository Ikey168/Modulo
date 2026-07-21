// Vulnerability knowledge base (#360) — pure helpers over the findings scan.
// Conventions: a finding's `class:` header carries `vuln/<class>`; a note
// *tagged* `vuln/<class>` is that class's writeup (SWC/CWE references, house
// recommendation). The KB is mostly conventions + filtered views — no new
// storage.

import type { CoreNote } from '@modulo/core';
import {
  extractFindings,
  severityRank,
  type FindingSeverity,
  type FindingStatus,
  type NoteFinding,
} from './findings';

export const VULN_TAG_PREFIX = 'vuln/';

/** `vuln/reentrancy` → `reentrancy`; already-bare names pass through. */
export function bareClass(cls: string): string {
  return cls.startsWith(VULN_TAG_PREFIX) ? cls.slice(VULN_TAG_PREFIX.length) : cls;
}

export interface ClassStats {
  /** Bare class name, e.g. `reentrancy`. */
  cls: string;
  findings: NoteFinding[];
  bySeverity: Partial<Record<FindingSeverity, number>>;
  byStatus: Partial<Record<FindingStatus, number>>;
  /** The class's writeup note (tagged `vuln/<class>`), if one exists. */
  writeupNoteId?: number;
  writeupNoteTitle?: string;
}

/** Notes tagged `vuln/…`, keyed by bare class name. */
export function classWriteups(notes: CoreNote[]): Map<string, CoreNote> {
  const map = new Map<string, CoreNote>();
  for (const note of notes) {
    for (const tag of note.tags) {
      if (tag.name.startsWith(VULN_TAG_PREFIX)) {
        const cls = bareClass(tag.name);
        if (!map.has(cls)) map.set(cls, note);
      }
    }
  }
  return map;
}

/** Aggregate every classified finding into per-class stats, most findings
 *  first. Findings without a `class:` header are grouped under `unclassified`. */
export function classStats(notes: CoreNote[]): ClassStats[] {
  const findings = extractFindings(notes);
  const writeups = classWriteups(notes);
  const byClass = new Map<string, NoteFinding[]>();

  for (const f of findings) {
    const cls = f.finding.vulnClass ? bareClass(f.finding.vulnClass) : 'unclassified';
    const list = byClass.get(cls) ?? [];
    list.push(f);
    byClass.set(cls, list);
  }

  const stats: ClassStats[] = [...byClass.entries()].map(([cls, list]) => {
    const bySeverity: Partial<Record<FindingSeverity, number>> = {};
    const byStatus: Partial<Record<FindingStatus, number>> = {};
    for (const f of list) {
      bySeverity[f.finding.severity] = (bySeverity[f.finding.severity] ?? 0) + 1;
      byStatus[f.finding.status] = (byStatus[f.finding.status] ?? 0) + 1;
    }
    const writeup = writeups.get(cls);
    return {
      cls,
      findings: [...list].sort((a, b) => severityRank(a.finding.severity) - severityRank(b.finding.severity)),
      bySeverity,
      byStatus,
      writeupNoteId: writeup?.id,
      writeupNoteTitle: writeup?.title,
    };
  });

  return stats.sort((a, b) => b.findings.length - a.findings.length || a.cls.localeCompare(b.cls));
}

/** Findings elsewhere in the vault that share a class with the given note.
 *  A note's classes = classes of its own findings ∪ its `vuln/…` tags. */
export function relatedFindings(notes: CoreNote[], note: CoreNote): NoteFinding[] {
  const own = extractFindings([note]);
  const classes = new Set<string>();
  for (const f of own) if (f.finding.vulnClass) classes.add(bareClass(f.finding.vulnClass));
  for (const tag of note.tags) if (tag.name.startsWith(VULN_TAG_PREFIX)) classes.add(bareClass(tag.name));
  if (classes.size === 0) return [];

  return extractFindings(notes.filter((n) => n.id !== note.id))
    .filter((f) => f.finding.vulnClass && classes.has(bareClass(f.finding.vulnClass)))
    .sort((a, b) => severityRank(a.finding.severity) - severityRank(b.finding.severity));
}

/** Markdown template for a class writeup note body. */
export function classNoteTemplate(cls = 'reentrancy'): string {
  return `# Vulnerability class: ${cls}

Tag this note \`vuln/${cls}\` so findings link to it.

## References
- SWC:
- CWE:

## Description
What the vulnerability is and when it appears.

## Detection
What to look for during review.

## Recommendation
The house-standard fix wording used in reports.
`;
}

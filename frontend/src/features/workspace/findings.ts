// Findings Tracker (#358) — parsing and aggregation for ```finding fences.
// A finding is authored inside a note as a fenced block: `key: value` header
// lines, then a blank line, then a free markdown body (description /
// recommendation). Pure module so the parser and the dashboard derivation are
// unit-testable without React.

import type { CoreNote } from '@modulo/core';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'] as const;
export type FindingSeverity = (typeof SEVERITIES)[number];

export const STATUSES = ['open', 'acknowledged', 'fixed', 'verified'] as const;
export type FindingStatus = (typeof STATUSES)[number];

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  /** Affected contract, e.g. `Vault.sol`. */
  contract?: string;
  /** Location within the contract, e.g. `withdraw() L42-57`. */
  location?: string;
  /** Vulnerability class tag, e.g. `vuln/reentrancy` (#360 conventions). */
  vulnClass?: string;
  /** Client response, once acknowledged. */
  response?: string;
  /** Markdown body after the header block: description, recommendation. */
  body: string;
}

export interface FindingParseError {
  error: string;
}

export function isParseError(f: Finding | FindingParseError): f is FindingParseError {
  return 'error' in f;
}

const KNOWN_KEYS = new Set(['id', 'title', 'severity', 'status', 'contract', 'location', 'class', 'response']);

/** Parse one fence body. Malformed input returns a helpful error, never throws. */
export function parseFinding(source: string): Finding | FindingParseError {
  const lines = source.split('\n');
  const header: Record<string, string> = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') break;
    const m = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(line);
    if (!m) break; // first non key:value line starts the body
    const key = m[1].toLowerCase();
    if (KNOWN_KEYS.has(key)) header[key] = m[2].trim();
  }

  const title = header['title'];
  if (!title) {
    return { error: 'A finding needs a `title:` header line.' };
  }

  const severityRaw = (header['severity'] ?? 'informational').toLowerCase();
  if (!(SEVERITIES as readonly string[]).includes(severityRaw)) {
    return { error: `Unknown severity "${header['severity']}". Use one of: ${SEVERITIES.join(', ')}.` };
  }
  const statusRaw = (header['status'] ?? 'open').toLowerCase();
  if (!(STATUSES as readonly string[]).includes(statusRaw)) {
    return { error: `Unknown status "${header['status']}". Use one of: ${STATUSES.join(', ')}.` };
  }

  return {
    id: header['id'] ?? '',
    title,
    severity: severityRaw as FindingSeverity,
    status: statusRaw as FindingStatus,
    contract: header['contract'] || undefined,
    location: header['location'] || undefined,
    vulnClass: header['class'] || undefined,
    response: header['response'] || undefined,
    body: lines.slice(i).join('\n').trim(),
  };
}

/** A valid finding located in a note, for the cross-vault dashboard. */
export interface NoteFinding {
  finding: Finding;
  noteId: number;
  noteTitle: string;
  /** `engagement/...` tags on the containing note. */
  engagements: string[];
}

const FENCE_RE = /```finding[^\S\n]*\n([\s\S]*?)```/g;

/** All parseable findings across the vault. Malformed fences are skipped here —
 *  they surface as error cards inside their note instead. */
export function extractFindings(notes: CoreNote[]): NoteFinding[] {
  const out: NoteFinding[] = [];
  for (const note of notes) {
    const body = note.markdownContent ?? note.content ?? '';
    const engagements = note.tags.filter((t) => t.name.startsWith('engagement/')).map((t) => t.name);
    for (const m of body.matchAll(FENCE_RE)) {
      const parsed = parseFinding(m[1]);
      if (!isParseError(parsed)) {
        out.push({ finding: parsed, noteId: note.id, noteTitle: note.title, engagements });
      }
    }
  }
  return out;
}

/** Most severe first, stable within a severity. */
export function severityRank(s: FindingSeverity): number {
  return SEVERITIES.indexOf(s);
}

export function sortBySeverity(findings: NoteFinding[]): NoteFinding[] {
  return [...findings].sort((a, b) => severityRank(a.finding.severity) - severityRank(b.finding.severity));
}

export function countBySeverity(findings: NoteFinding[]): Record<FindingSeverity, number> {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<FindingSeverity, number>;
  for (const f of findings) counts[f.finding.severity]++;
  return counts;
}

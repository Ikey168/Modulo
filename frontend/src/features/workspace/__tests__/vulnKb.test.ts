import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { bareClass, classStats, classWriteups, relatedFindings } from '../vulnKb';

const note = (id: number, title: string, content: string, tags: string[] = []): CoreNote => ({
  id,
  title,
  content,
  tags: tags.map((name) => ({ id: `t-${name}`, name })),
});

const finding = (title: string, cls?: string, severity = 'high', status = 'open') =>
  '```finding\ntitle: ' +
  title +
  '\nseverity: ' +
  severity +
  '\nstatus: ' +
  status +
  (cls ? '\nclass: ' + cls : '') +
  '\n```';

describe('bareClass', () => {
  it('strips the vuln/ prefix and passes bare names through', () => {
    expect(bareClass('vuln/reentrancy')).toBe('reentrancy');
    expect(bareClass('reentrancy')).toBe('reentrancy');
  });
});

describe('classStats', () => {
  const notes = [
    note(1, 'Audit A', finding('R1', 'vuln/reentrancy') + '\n' + finding('O1', 'vuln/oracle', 'critical'), ['engagement/a']),
    note(2, 'Audit B', finding('R2', 'vuln/reentrancy', 'medium', 'fixed'), ['engagement/b']),
    note(3, 'Loose', finding('No class')),
    note(4, 'Reentrancy writeup', 'SWC-107 …', ['vuln/reentrancy']),
  ];

  it('clusters findings by class, most findings first, with writeup links', () => {
    const stats = classStats(notes);
    expect(stats[0].cls).toBe('reentrancy');
    expect(stats[0].findings.map((f) => f.finding.title)).toEqual(['R1', 'R2']);
    expect(stats[0].bySeverity).toEqual({ high: 1, medium: 1 });
    expect(stats[0].byStatus).toEqual({ open: 1, fixed: 1 });
    expect(stats[0].writeupNoteId).toBe(4);
    expect(stats.map((s) => s.cls)).toContain('unclassified');
    const oracle = stats.find((s) => s.cls === 'oracle');
    expect(oracle?.writeupNoteId).toBeUndefined();
  });

  it('classWriteups maps vuln tags to their notes', () => {
    expect(classWriteups(notes).get('reentrancy')?.id).toBe(4);
  });
});

describe('relatedFindings', () => {
  const notes = [
    note(1, 'Audit A', finding('R1', 'vuln/reentrancy')),
    note(2, 'Audit B', finding('R2', 'vuln/reentrancy', 'critical')),
    note(3, 'Other', finding('X', 'vuln/oracle')),
    note(4, 'Writeup', 'prose', ['vuln/reentrancy']),
  ];

  it('finds findings sharing a class with the note, excluding the note itself', () => {
    const related = relatedFindings(notes, notes[0]);
    expect(related.map((f) => f.finding.title)).toEqual(['R2']);
  });

  it('uses vuln/ tags for writeup notes and sorts by severity', () => {
    const related = relatedFindings(notes, notes[3]);
    expect(related.map((f) => f.finding.title)).toEqual(['R2', 'R1']);
  });

  it('returns nothing for unclassified notes', () => {
    expect(relatedFindings(notes, note(9, 'Plain', 'no findings'))).toEqual([]);
  });
});

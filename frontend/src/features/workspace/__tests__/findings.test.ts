import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  countBySeverity,
  extractFindings,
  isParseError,
  parseFinding,
  sortBySeverity,
} from '../findings';

const VALID = `id: F-01
title: Reentrancy in withdraw()
severity: high
status: acknowledged
contract: Vault.sol
location: withdraw() L42-57
class: vuln/reentrancy
response: Fix scheduled for v2

External call before state update allows re-entrancy.

Recommendation: use checks-effects-interactions.`;

const note = (id: number, title: string, content: string, tags: string[] = []): CoreNote => ({
  id,
  title,
  content,
  tags: tags.map((name) => ({ id: name, name })),
});

describe('parseFinding', () => {
  it('parses a full finding', () => {
    const f = parseFinding(VALID);
    if (isParseError(f)) throw new Error(f.error);
    expect(f.id).toBe('F-01');
    expect(f.title).toBe('Reentrancy in withdraw()');
    expect(f.severity).toBe('high');
    expect(f.status).toBe('acknowledged');
    expect(f.contract).toBe('Vault.sol');
    expect(f.location).toBe('withdraw() L42-57');
    expect(f.vulnClass).toBe('vuln/reentrancy');
    expect(f.response).toBe('Fix scheduled for v2');
    expect(f.body).toContain('checks-effects-interactions');
  });

  it('defaults severity to informational and status to open', () => {
    const f = parseFinding('title: Minor note');
    if (isParseError(f)) throw new Error(f.error);
    expect(f.severity).toBe('informational');
    expect(f.status).toBe('open');
    expect(f.id).toBe('');
    expect(f.body).toBe('');
  });

  it('requires a title', () => {
    const f = parseFinding('id: F-01\nseverity: high');
    expect(isParseError(f)).toBe(true);
  });

  it('rejects unknown severity and status with helpful errors', () => {
    const sev = parseFinding('title: X\nseverity: catastrophic');
    expect(isParseError(sev) && sev.error).toMatch(/severity/i);
    const st = parseFinding('title: X\nstatus: wontfix');
    expect(isParseError(st) && st.error).toMatch(/status/i);
  });

  it('is case-insensitive for enum values', () => {
    const f = parseFinding('title: X\nseverity: Critical\nstatus: Verified');
    if (isParseError(f)) throw new Error(f.error);
    expect(f.severity).toBe('critical');
    expect(f.status).toBe('verified');
  });
});

describe('extractFindings', () => {
  it('collects findings across notes with engagement tags', () => {
    const notes = [
      note(1, 'Audit A', 'intro\n\n```finding\n' + VALID + '\n```\n', ['engagement/acme-vault', 'other']),
      note(2, 'Audit B', '```finding\ntitle: Second\nseverity: low\n```', ['engagement/beta']),
      note(3, 'Plain', 'no fences here'),
    ];
    const found = extractFindings(notes);
    expect(found).toHaveLength(2);
    expect(found[0].noteId).toBe(1);
    expect(found[0].engagements).toEqual(['engagement/acme-vault']);
    expect(found[1].finding.title).toBe('Second');
  });

  it('skips malformed fences instead of failing the whole scan', () => {
    const notes = [note(1, 'A', '```finding\nseverity: high\n```\n\n```finding\ntitle: Valid one\n```')];
    const found = extractFindings(notes);
    expect(found).toHaveLength(1);
    expect(found[0].finding.title).toBe('Valid one');
  });

  it('prefers markdownContent over content', () => {
    const n = { ...note(1, 'A', 'nothing'), markdownContent: '```finding\ntitle: From markdown\n```' };
    expect(extractFindings([n])[0].finding.title).toBe('From markdown');
  });
});

describe('ordering and counts', () => {
  it('sorts most severe first and counts by severity', () => {
    const notes = [
      note(1, 'A', '```finding\ntitle: L\nseverity: low\n```\n```finding\ntitle: C\nseverity: critical\n```'),
    ];
    const found = sortBySeverity(extractFindings(notes));
    expect(found.map((f) => f.finding.title)).toEqual(['C', 'L']);
    const counts = countBySeverity(found);
    expect(counts.critical).toBe(1);
    expect(counts.low).toBe(1);
    expect(counts.high).toBe(0);
  });
});

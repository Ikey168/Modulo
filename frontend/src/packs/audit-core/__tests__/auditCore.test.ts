import { describe, expect, it } from 'vitest';
import { auditCoreFindings, auditCoreHealth, auditCorePhaseSummaries, parseAuditCoreEntries } from '../auditCore';

const entry = (path: string, value: unknown) => ({ path: `sample-output/${path}`, text: JSON.stringify(value) });

describe('audit-core output adapter', () => {
  it('normalises a selected directory and reads the phase-ledger schema', () => {
    const bundle = parseAuditCoreEntries([
      entry('phase-ledger.json', { version: 1, runs: { scope: { phase: 'p0', status: 'ran' }, fuzz: { phase: 'p5', status: 'degraded' } }, properties: { p1: {} }, waivers: {} }),
      entry('p0_scoping/scope.json', { inScope: ['A.sol'] }),
    ], '2026-09-04T00:00:00.000Z');
    expect(bundle.name).toBe('sample-output');
    expect(bundle.version).toBe(1);
    expect(bundle.artifacts['phase-ledger.json']).toBeTruthy();
    expect(auditCorePhaseSummaries(bundle)[0]).toMatchObject({ artifacts: 1, ran: 1 });
    expect(auditCoreHealth(bundle)).toContain('1 audit-core run reported degraded status.');
  });

  it('uses the most authoritative available findings and tolerates field variants', () => {
    const bundle = parseAuditCoreEntries([
      entry('phase-ledger.json', { version: 1, runs: {} }),
      entry('p4_manual_review/findings.json', { findings: [{ id: 'F-1', title: 'Manual title', severity: 'High', status: 'Open' }] }),
      entry('p8_reporting/report.json', { findings: [{ findingId: 'F-1', name: 'Final title', finalSeverity: 'Critical', classification: 'Confirmed' }] }),
    ]);
    expect(auditCoreFindings(bundle)).toEqual([expect.objectContaining({ id: 'F-1', title: 'Final title', severity: 'Critical', status: 'Confirmed', path: 'p8_reporting/report.json' })]);
    expect(auditCoreFindings(bundle, 'p4_manual_review/findings.json')[0]).toMatchObject({ title: 'Manual title', severity: 'High' });
  });

  it('isolates malformed JSON while retaining readable artifacts', () => {
    const bundle = parseAuditCoreEntries([
      entry('phase-ledger.json', { version: 2, runs: {} }),
      { path: 'sample-output/p2_threat_modeling/invariants.json', text: '{broken' },
    ]);
    expect(Object.keys(bundle.artifacts)).toEqual(['phase-ledger.json']);
    expect(bundle.errors).toHaveLength(1);
    expect(auditCoreHealth(bundle)).toEqual(expect.arrayContaining([
      expect.stringContaining('version 2'),
      expect.stringContaining('could not be parsed'),
    ]));
  });
});

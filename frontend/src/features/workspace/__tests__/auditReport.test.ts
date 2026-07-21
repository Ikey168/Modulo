import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { buildReport, engagementsIn, reportDocument, reportHtml } from '../auditReport';

const note = (id: number, title: string, content: string, tags: string[] = []): CoreNote => ({
  id,
  title,
  content,
  tags: tags.map((name) => ({ id: `t-${name}`, name })),
});

const DATE = new Date('2026-07-21T12:00:00Z');

const NOTES = [
  note(
    1,
    'Vault review',
    '```finding\nid: F-01\ntitle: Reentrancy\nseverity: critical\nstatus: verified\ncontract: Vault.sol\n\nDetails here.\n```',
    ['engagement/acme-vault'],
  ),
  note(2, 'Scope', 'scope prose', ['engagement/acme-vault']),
  note(3, 'Other client', '```finding\ntitle: Unrelated\nseverity: high\n```', ['engagement/beta']),
  note(4, 'Untagged', 'nothing'),
];

describe('engagementsIn', () => {
  it('lists distinct bare engagement names, sorted', () => {
    expect(engagementsIn(NOTES)).toEqual(['acme-vault', 'beta']);
  });
});

describe('buildReport', () => {
  it('compiles title, summary counts, findings, and scope', () => {
    const r = buildReport({ engagement: 'acme-vault', notes: NOTES, date: DATE });
    expect(r.title).toBe('Audit report — acme-vault (2026-07-21)');
    expect(r.countsLine).toBe('1 critical');
    expect(r.markdown).toContain('# Audit report — acme-vault (2026-07-21)');
    expect(r.markdown).toContain('### Critical');
    expect(r.markdown).toContain('#### F-01 — Reentrancy');
    expect(r.markdown).toContain('contract: Vault.sol');
    expect(r.markdown).toContain('1/1 verified fixed');
    expect(r.markdown).toContain('- Vault review');
    expect(r.markdown).toContain('- Scope');
    // Other engagements never bleed in.
    expect(r.markdown).not.toContain('Unrelated');
  });

  it('handles engagements without findings', () => {
    const r = buildReport({ engagement: 'empty', notes: NOTES, date: DATE });
    expect(r.countsLine).toBe('No findings.');
    expect(r.markdown).toContain('_No notes are tagged `engagement/empty`._');
  });
});

describe('report HTML export', () => {
  it('renders headings, lists, emphasis and escapes HTML', () => {
    const html = reportHtml('# T\n\n- item **bold** `code`\n\n_meta_ <script>');
    expect(html).toContain('<h1>T</h1>');
    expect(html).toContain('<li>item <strong>bold</strong> <code>code</code></li>');
    expect(html).toContain('<em>meta</em>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('produces a standalone printable document', () => {
    const doc = reportDocument('# Report', 'My <Report>');
    expect(doc).toContain('<!doctype html>');
    expect(doc).toContain('<title>My &lt;Report&gt;</title>');
    expect(doc).toContain('<h1>Report</h1>');
  });
});

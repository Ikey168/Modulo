import { describe, expect, it } from 'vitest';
import { filterPaperlessDocuments, isPaperlessHealthStale, paperlessDocumentUrl, paperlessReferences, parsePaperlessDocument, type PaperlessDocument } from './paperless';

const base = { paperlessId: 7, classification: 'Invoice', sensitivity: 'normal', restrictedStub: false, status: 'filed', deleted: false, retentionClass: '', retentionUntil: '', retentionReason: '', expiryDate: '', sourceVersion: 'v1', paraLinks: { projects: [], areas: [], tasks: [] }, review: { status: 'none', updatedAt: '' }, title: 'Hosting invoice', correspondent: 'Example GmbH', tags: ['tax'], year: 2026 };

describe('Paperless record privacy and discovery', () => {
  it('rejects a restricted stub containing descriptive metadata', () => {
    expect(parsePaperlessDocument({ ...base, sensitivity: 'restricted', restrictedStub: true })).toBeUndefined();
    const safe = { ...base, sensitivity: 'restricted', restrictedStub: true } as Record<string, unknown>;
    for (const key of ['title', 'correspondent', 'tags', 'year']) delete safe[key];
    expect(parsePaperlessDocument(safe)?.paperlessId).toBe(7);
  });

  it('filters metadata and creates a stable detail URL', () => {
    expect(filterPaperlessDocuments([base as PaperlessDocument], { query: 'gmbh', classification: '', correspondent: '', tag: 'tax', year: '2026', status: 'filed' })).toHaveLength(1);
    expect(paperlessDocumentUrl('https://paperless.zt', 7)).toBe('https://paperless.zt/documents/7/details');
  });

  it('detects stale health and unique note references', () => {
    expect(isPaperlessHealthStale(undefined, 15)).toBe(true);
    expect(paperlessReferences('See paperless:7 and paperless:7, then paperless:9')).toEqual([7, 9]);
  });
});

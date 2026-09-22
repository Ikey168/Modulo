import { describe, expect, it } from 'vitest';
import { citationDuplicate, cslToRecordValues, exportCitations, formatCslBibliography, parseCitationText, uniqueCitationKey } from '../citationEngine';
import type { LifeRecord } from '../lifeStore';

const record = (id: string, title: string, values: Record<string, string>): LifeRecord => ({ id, title, status: 'Verified', category: 'Journal article', recurrence: 'Once', favorite: false, tags: [], values, checklist: [], log: [] });

describe('CSL citation engine', () => {
  it('parses BibTeX and RIS into Zotero-compatible CSL JSON', () => {
    const bib = parseCitationText('@article{doe2025,title={A Study},author={Doe, Jane},year={2025},doi={10.1/test}}')[0];
    expect(bib).toEqual(expect.objectContaining({ title: 'A Study', DOI: '10.1/test', type: 'article-journal' }));
    expect(cslToRecordValues(bib).values.authors).toContain('Jane Doe');
    const ris = parseCitationText('TY  - JOUR\nTI  - Another Study\nAU  - Roe, John\nPY  - 2024\nER  -');
    expect(ris[0].title).toBe('Another Study');
  });

  it('formats through CSL and exports standard exchange formats', () => {
    const source = record('r1', 'A Study', { authors: 'Jane Doe', year: '2025', container: 'Journal', doi: '10.1/test', citationKey: 'doe2025', isbn: '', url: '' });
    expect(formatCslBibliography([source], 'APA')[0]).toContain('2025');
    expect(exportCitations([source], 'bibtex')).toContain('@article{doe2025');
    expect(exportCitations([source], 'ris')).toContain('TY  - JOUR');
    expect(JSON.parse(exportCitations([source], 'csl-json'))[0]).toEqual(expect.objectContaining({ DOI: '10.1/test' }));
  });

  it('detects duplicate DOI records and resolves citation-key conflicts', () => {
    const existing = record('r1', 'A Study', { authors: '', year: '2025', container: '', doi: '10.1/test', citationKey: 'doe2025', isbn: '', url: '' });
    expect(citationDuplicate({ id: 'new', type: 'article-journal', title: 'Elsewhere', DOI: '10.1/TEST' }, [existing])).toBe(existing);
    expect(uniqueCitationKey('Doe 2025', [existing])).toBe('doe2025-2');
  });
});

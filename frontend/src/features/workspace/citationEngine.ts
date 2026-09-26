import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';
import '@citation-js/plugin-ris';
import type { LifeRecord } from './lifeStore';

export const CSL_STYLES = ['APA', 'Harvard', 'Vancouver'] as const;
export type CslStyle = typeof CSL_STYLES[number];

export interface CslName { given?: string; family?: string; literal?: string; }
export interface CslItem {
  id: string;
  type: string;
  title?: string;
  author?: CslName[];
  issued?: { 'date-parts'?: number[][]; literal?: string | number };
  'container-title'?: string;
  DOI?: string;
  ISBN?: string;
  URL?: string;
  'citation-key'?: string;
  [key: string]: unknown;
}

const styleId: Record<CslStyle, string> = { APA: 'apa', Harvard: 'harvard1', Vancouver: 'vancouver' };
const plain = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export function parseCitationText(source: string): CslItem[] {
  const trimmed = source.trim();
  if (!trimmed) return [];
  const input = trimmed.startsWith('[') || trimmed.startsWith('{') ? JSON.parse(trimmed) : trimmed;
  const cite = new Cite(input);
  return (cite.data as unknown[]).map(normalizeCslItem).filter((item) => item.title || item.DOI);
}

export function normalizeCslItem(value: unknown): CslItem {
  const raw = plain(value);
  const author = Array.isArray(raw.author) ? raw.author.map((entry) => {
    const name = plain(entry); return { given: text(name.given) || undefined, family: text(name.family) || undefined, literal: text(name.literal) || undefined };
  }) : undefined;
  return {
    id: text(raw.id) || text(raw['citation-key']) || `source-${Math.random().toString(36).slice(2, 9)}`,
    type: text(raw.type) || 'article-journal', title: text(raw.title) || undefined, author,
    issued: typeof raw.issued === 'object' && raw.issued ? raw.issued as CslItem['issued'] : undefined,
    'container-title': text(raw['container-title']) || undefined, DOI: text(raw.DOI) || undefined,
    ISBN: text(raw.ISBN) || undefined, URL: text(raw.URL) || undefined,
    'citation-key': text(raw['citation-key']) || text(raw.id) || undefined,
  };
}

export function lifeRecordToCsl(record: LifeRecord): CslItem {
  const year = Number(record.values.year);
  return {
    id: record.id, type: categoryToType(record.category), title: record.title,
    author: record.values.authors.split(/\s*(?:;|\band\b)\s*/i).filter(Boolean).map(parseName),
    issued: Number.isFinite(year) && year > 0 ? { 'date-parts': [[year]] } : undefined,
    'container-title': record.values.container || undefined, DOI: record.values.doi || undefined,
    ISBN: record.values.isbn || undefined, URL: record.values.url || undefined,
    'citation-key': record.values.citationKey || record.id,
  };
}

export function cslToRecordValues(item: CslItem): { title: string; category: string; values: Record<string, string> } {
  const year = item.issued?.['date-parts']?.[0]?.[0] ?? item.issued?.literal ?? '';
  return {
    title: item.title || item.DOI || 'Untitled citation', category: typeToCategory(item.type),
    values: {
      authors: (item.author ?? []).map(formatName).filter(Boolean).join('; '), year: String(year),
      container: item['container-title'] || '', doi: item.DOI || '', isbn: item.ISBN || '', url: item.URL || '',
      citationKey: item['citation-key'] || item.id, cslJson: JSON.stringify(item), formatted: '', style: 'APA',
    },
  };
}

export function formatCslBibliography(records: LifeRecord[], style: CslStyle): string[] {
  if (!records.length) return [];
  const cite = new Cite(records.map(lifeRecordToCsl));
  const entries = cite.format('bibliography', { format: 'text', template: styleId[style], lang: 'en-US', asEntryArray: true }) as [string, string][];
  const byId = new Map(entries.map(([id, formatted]) => [id, formatted.trim()]));
  return records.map((record) => byId.get(record.id) ?? '');
}

export function exportCitations(records: LifeRecord[], format: 'bibtex' | 'ris' | 'csl-json'): string {
  const items = records.map(lifeRecordToCsl);
  if (format === 'csl-json') return JSON.stringify(items, null, 2);
  return String(new Cite(items).format(format));
}

export function citationDuplicate(item: CslItem, records: LifeRecord[]): LifeRecord | undefined {
  const doi = item.DOI?.trim().toLocaleLowerCase();
  const title = item.title?.trim().toLocaleLowerCase();
  const year = String(item.issued?.['date-parts']?.[0]?.[0] ?? item.issued?.literal ?? '');
  return records.find((record) => doi ? record.values.doi.trim().toLocaleLowerCase() === doi : Boolean(title && record.title.trim().toLocaleLowerCase() === title && record.values.year === year));
}

export function uniqueCitationKey(preferred: string, records: LifeRecord[]): string {
  const base = preferred.replace(/[^a-z0-9:_-]/gi, '').toLocaleLowerCase() || 'source';
  const keys = new Set(records.map((record) => record.values.citationKey.toLocaleLowerCase()));
  if (!keys.has(base)) return base;
  let suffix = 2; while (keys.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function parseName(value: string): CslName { const comma = value.indexOf(','); if (comma > 0) return { family: value.slice(0, comma).trim(), given: value.slice(comma + 1).trim() }; const parts = value.trim().split(/\s+/); return parts.length > 1 ? { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] } : { literal: value.trim() }; }
function formatName(name: CslName): string { return name.literal || [name.given, name.family].filter(Boolean).join(' '); }
function categoryToType(category: string): string { return ({ Book: 'book', Chapter: 'chapter', Web: 'webpage', Dataset: 'dataset', Report: 'report', Thesis: 'thesis' } as Record<string, string>)[category] || 'article-journal'; }
function typeToCategory(type: string): string { return ({ book: 'Book', chapter: 'Chapter', webpage: 'Web', dataset: 'Dataset', report: 'Report', thesis: 'Thesis' } as Record<string, string>)[type] || 'Journal article'; }

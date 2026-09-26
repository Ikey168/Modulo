import { randomId } from '../../lib/randomId';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const SECURITY_SECRET_REJECTED_EVENT = 'modulo:security-secret-rejected';
export const LIFE_RECURRENCES = ['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as const;
export type LifeRecurrence = typeof LIFE_RECURRENCES[number];

export interface LifeChecklistItem { id: string; title: string; done: boolean; }
export interface LifeLogEntry { id: string; date: string; title: string; }
export interface LifeOccurrenceCompletion { recordId: string; date: string; done: boolean; }

export interface LifeRecord {
  id: string;
  title: string;
  status: string;
  category: string;
  date?: string;
  endDate?: string;
  recurrence: LifeRecurrence;
  blockId?: DayBlockId;
  amount?: number;
  rating?: number;
  favorite: boolean;
  notes?: string;
  projectId?: string;
  areaId?: string;
  tags: string[];
  values: Record<string, string>;
  checklist: LifeChecklistItem[];
  log: LifeLogEntry[];
}

export interface LifeCollectionData { version: 1; records: LifeRecord[]; occurrenceCompletions: LifeOccurrenceCompletion[]; }

export const lifeStoreKey = (pluginId: string): string => `modulo-life-${pluginId}-v1`;
export const emptyLifeCollection = (): LifeCollectionData => ({ version: 1, records: [], occurrenceCompletions: [] });
export const newLifeId = (prefix: 'record' | 'check' | 'log'): string => `${prefix}-${randomId()}`;

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const recurrence = (value: unknown): LifeRecurrence => LIFE_RECURRENCES.includes(value as LifeRecurrence) ? value as LifeRecurrence : 'Once';
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseLifeCollection(value: unknown): LifeCollectionData {
  const raw = object(value);
  const records = Array.isArray(raw.records) ? raw.records : [];
  const occurrenceCompletions = Array.isArray(raw.occurrenceCompletions) ? raw.occurrenceCompletions : [];
  return {
    version: 1,
    records: records.map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), title: text(item.title), status: text(item.status) || 'Active', category: text(item.category) || 'Other',
      date: optionalText(item.date), endDate: optionalText(item.endDate), recurrence: recurrence(item.recurrence), blockId: blockId(item.blockId),
      amount: Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0 ? Number(item.amount) : undefined,
      rating: Number.isFinite(Number(item.rating)) ? Math.max(0, Math.min(5, Number(item.rating))) : undefined,
      favorite: item.favorite === true, notes: optionalText(item.notes), projectId: optionalText(item.projectId), areaId: optionalText(item.areaId),
      tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0) : [],
      values: Object.fromEntries(Object.entries(object(item.values)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      checklist: (Array.isArray(item.checklist) ? item.checklist : []).map(object).filter((entry) => text(entry.id) && text(entry.title)).map((entry) => ({ id: text(entry.id), title: text(entry.title), done: entry.done === true })),
      log: (Array.isArray(item.log) ? item.log : []).map(object).filter((entry) => text(entry.id) && text(entry.date) && text(entry.title)).map((entry) => ({ id: text(entry.id), date: text(entry.date), title: text(entry.title) })),
    })),
    occurrenceCompletions: occurrenceCompletions.map(object).filter((item) => text(item.recordId) && text(item.date) && item.done === true).map((item) => ({ recordId: text(item.recordId), date: text(item.date), done: true })),
  };
}

export function containsProhibitedSecuritySecret(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/i.test(serialized)
    || /(?:password|passphrase|private\s*key|seed\s*phrase|mnemonic|recovery\s*phrase)\s*(?:is|:|=)\s*(?:"[^"\\]{4,}"|'[^'\\]{4,}'|[^\s,;}]{4,})/i.test(serialized);
}

export function lifeRecordOccursOn(record: LifeRecord, date: string): boolean {
  if (!record.date || date < record.date || (record.endDate && date > record.endDate)) return false;
  if (record.recurrence === 'Once') return date === record.date;
  const start = new Date(`${record.date}T00:00:00Z`);
  const candidate = new Date(`${date}T00:00:00Z`);
  if (record.recurrence === 'Daily') return true;
  if (record.recurrence === 'Weekly') return Math.round((candidate.getTime() - start.getTime()) / 86_400_000) % 7 === 0;
  if (record.recurrence === 'Monthly') return candidate.getUTCDate() === start.getUTCDate();
  return candidate.getUTCMonth() === start.getUTCMonth() && candidate.getUTCDate() === start.getUTCDate();
}

export function lifeRecordsOn(data: LifeCollectionData, date: string): LifeRecord[] {
  return data.records.filter((record) => record.blockId && lifeRecordOccursOn(record, date));
}

export function lifeOccurrenceDone(data: LifeCollectionData, recordId: string, date: string): boolean {
  return data.occurrenceCompletions.some((item) => item.recordId === recordId && item.date === date && item.done);
}

export function setLifeOccurrenceDone(data: LifeCollectionData, recordId: string, date: string, done: boolean): LifeCollectionData {
  const others = data.occurrenceCompletions.filter((item) => item.recordId !== recordId || item.date !== date);
  return { ...data, occurrenceCompletions: done ? [...others, { recordId, date, done: true }] : others };
}

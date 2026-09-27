export const PAPERLESS_DOCUMENT_SCHEMA = 'paperless.document';
export const PAPERLESS_HEALTH_SCHEMA = 'paperless.health';
export const PAPERLESS_SETTINGS_SCHEMA = 'paperless.settings';
export const PAPERLESS_ACTION_SCHEMA = 'paperless.action';

const forbiddenRestrictedFields = [
  'title', 'correspondent', 'tags', 'tagIds', 'storagePath', 'checksum',
  'originalFilename', 'business', 'documentDate', 'year',
] as const;

export interface PaperlessDocument {
  paperlessId: number;
  classification: string;
  sensitivity: 'normal' | 'confidential' | 'restricted';
  restrictedStub: boolean;
  status: string;
  deleted: boolean;
  retentionClass: string;
  retentionUntil: string;
  retentionReason: string;
  expiryDate: string;
  sourceVersion: string;
  paraLinks: { projects: string[]; areas: string[]; tasks: string[] };
  review: { status: string; updatedAt: string };
  title?: string;
  correspondent?: string;
  tags?: string[];
  tagIds?: number[];
  documentDate?: string;
  year?: number;
  checksum?: string;
  storagePath?: string;
  business?: { invoiceDirection: string; eInvoiceStatus: string; evidenceType: string };
}

export interface PaperlessHealth {
  lastSuccess: string;
  lastIncremental: string;
  lastFull: string;
  lastFailure?: string;
  documentCount: number;
  changedCount: number;
  restrictedCount: number;
  tombstoneCount: number;
  queueDepth: number;
  failedActions: number;
  failures: number;
  schemaVersion: number;
  grantExpiresAt: string;
  workloadExpiresAt: string;
  paperlessReachable: boolean;
  mode: 'full' | 'incremental' | 'failed';
}

export interface PaperlessFilters {
  query: string;
  classification: string;
  correspondent: string;
  tag: string;
  year: string;
  status: string;
}

const object = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function parsePaperlessDocument(value: unknown): PaperlessDocument | undefined {
  const raw = object(value);
  if (!Number.isInteger(raw.paperlessId) || Number(raw.paperlessId) < 1) return undefined;
  const sensitivity = raw.sensitivity;
  if (!['normal', 'confidential', 'restricted'].includes(String(sensitivity))) return undefined;
  const restrictedStub = raw.restrictedStub === true;
  if (restrictedStub && forbiddenRestrictedFields.some((field) => Object.prototype.hasOwnProperty.call(raw, field))) return undefined;
  if (sensitivity === 'restricted' && !restrictedStub) return undefined;
  const links = object(raw.paraLinks);
  const review = object(raw.review);
  const result: PaperlessDocument = {
    paperlessId: Number(raw.paperlessId),
    classification: string(raw.classification) || 'Unclassified',
    sensitivity: sensitivity as PaperlessDocument['sensitivity'],
    restrictedStub,
    status: string(raw.status),
    deleted: raw.deleted === true,
    retentionClass: string(raw.retentionClass),
    retentionUntil: string(raw.retentionUntil),
    retentionReason: string(raw.retentionReason),
    expiryDate: string(raw.expiryDate),
    sourceVersion: string(raw.sourceVersion),
    paraLinks: { projects: strings(links.projects), areas: strings(links.areas), tasks: strings(links.tasks) },
    review: { status: string(review.status), updatedAt: string(review.updatedAt) },
  };
  if (restrictedStub) return result;
  const business = object(raw.business);
  return {
    ...result,
    title: string(raw.title), correspondent: string(raw.correspondent), tags: strings(raw.tags),
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((item): item is number => Number.isInteger(item)) : [],
    documentDate: string(raw.documentDate), year: Number.isInteger(raw.year) ? Number(raw.year) : 0,
    checksum: string(raw.checksum), storagePath: string(raw.storagePath),
    business: { invoiceDirection: string(business.invoiceDirection), eInvoiceStatus: string(business.eInvoiceStatus), evidenceType: string(business.evidenceType) },
  };
}

export function parsePaperlessHealth(value: unknown): PaperlessHealth | undefined {
  const raw = object(value);
  if (!string(raw.lastSuccess) && raw.mode !== 'failed') return undefined;
  return {
    lastSuccess: string(raw.lastSuccess), lastIncremental: string(raw.lastIncremental), lastFull: string(raw.lastFull),
    lastFailure: string(raw.lastFailure) || undefined, documentCount: Number(raw.documentCount ?? -1),
    changedCount: Number(raw.changedCount ?? 0), restrictedCount: Number(raw.restrictedCount ?? 0),
    tombstoneCount: Number(raw.tombstoneCount ?? 0), queueDepth: Number(raw.queueDepth ?? 0),
    failedActions: Number(raw.failedActions ?? 0), failures: Number(raw.failures ?? 0),
    schemaVersion: Number(raw.schemaVersion ?? 0), grantExpiresAt: string(raw.grantExpiresAt),
    workloadExpiresAt: string(raw.workloadExpiresAt), paperlessReachable: raw.paperlessReachable === true,
    mode: ['full', 'incremental', 'failed'].includes(String(raw.mode)) ? raw.mode as PaperlessHealth['mode'] : 'failed',
  };
}

export function filterPaperlessDocuments(documents: PaperlessDocument[], filters: PaperlessFilters): PaperlessDocument[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return documents.filter((document) => {
    if (filters.classification && document.classification !== filters.classification) return false;
    if (filters.correspondent && document.correspondent !== filters.correspondent) return false;
    if (filters.tag && !document.tags?.includes(filters.tag)) return false;
    if (filters.year && String(document.year || '') !== filters.year) return false;
    if (filters.status && document.status !== filters.status) return false;
    if (!query) return true;
    return [document.title, document.correspondent, document.classification, document.status, ...(document.tags ?? [])]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
}

export function paperlessDocumentUrl(baseUrl: string, paperlessId: number): string | undefined {
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.pathname = `/documents/${paperlessId}/details`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch { return undefined; }
}

export function isPaperlessHealthStale(health: PaperlessHealth | undefined, staleAfterMinutes: number, now = Date.now()): boolean {
  const last = health?.lastSuccess ? Date.parse(health.lastSuccess) : Number.NaN;
  return !Number.isFinite(last) || now - last > staleAfterMinutes * 60_000;
}

export function paperlessReferences(content: string): number[] {
  return [...content.matchAll(/(?:^|\s)paperless:(\d+)\b/g)]
    .map((match) => Number(match[1])).filter((value, index, all) => all.indexOf(value) === index);
}

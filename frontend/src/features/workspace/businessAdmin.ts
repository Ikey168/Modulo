import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const BUSINESS_ADMIN_STORE_KEY = 'modulo-business-admin-v1';

export const CLIENT_STATUSES = ['Lead', 'Active', 'Dormant', 'Archived'] as const;
export const ENGAGEMENT_STATUSES = ['Lead', 'Proposed', 'Active', 'Waiting', 'Complete', 'Archived'] as const;
export const AGREEMENT_TYPES = ['Proposal', 'Quote', 'Contract', 'SOW', 'NDA', 'DPA', 'Other'] as const;
export const AGREEMENT_STATUSES = ['Draft', 'Sent', 'Accepted', 'Signed', 'Rejected', 'Expired'] as const;
export const RECONCILIATION_STATUSES = ['Unmatched', 'Matched', 'Reviewed'] as const;
export const OBLIGATION_TYPES = ['Tax filing', 'Insurance', 'Registration', 'Renewal', 'Report', 'Other'] as const;
export const OBLIGATION_STATUSES = ['Open', 'Prepared', 'Submitted', 'Accepted', 'Not applicable'] as const;
export const VENDOR_STATUSES = ['Active', 'Review', 'Ending', 'Archived'] as const;
export const CORRESPONDENCE_STATUSES = ['Open', 'Waiting', 'Answered', 'Filed'] as const;

export interface BusinessClient { id: string; name: string; type: 'Company' | 'Individual'; status: typeof CLIENT_STATUSES[number]; email: string; phone: string; vatId: string; address: string; notes: string; }
export interface BusinessEngagement { id: string; clientId: string; title: string; status: typeof ENGAGEMENT_STATUSES[number]; startDate?: string; endDate?: string; valueEur?: number; nextAction: string; projectId?: string; notes: string; }
export interface BusinessAgreement { id: string; clientId?: string; engagementId?: string; type: typeof AGREEMENT_TYPES[number]; title: string; status: typeof AGREEMENT_STATUSES[number]; date: string; expiresOn?: string; valueEur?: number; noteId?: number; notes: string; }
export interface ReconciliationItem { id: string; sourceType: 'Expense' | 'Invoice' | 'Bank' | 'Other'; sourceRef: string; date: string; counterparty: string; amountEur: number; status: typeof RECONCILIATION_STATUSES[number]; evidence: string; notes: string; }
export interface BusinessObligation { id: string; type: typeof OBLIGATION_TYPES[number]; title: string; authority: string; dueDate: string; blockId?: DayBlockId; status: typeof OBLIGATION_STATUSES[number]; submittedOn?: string; reference: string; notes: string; }
export interface BusinessVendor { id: string; name: string; category: string; status: typeof VENDOR_STATUSES[number]; email: string; contractEnd?: string; renewalDate?: string; noticePeriod: string; notes: string; }
export interface BusinessCorrespondence { id: string; direction: 'Inbound' | 'Outbound'; counterpartyType: 'Client' | 'Vendor' | 'Authority' | 'Other'; counterpartyId?: string; subject: string; date: string; dueDate?: string; blockId?: DayBlockId; status: typeof CORRESPONDENCE_STATUSES[number]; notes: string; }
export interface BusinessAdminData { version: 1; clients: BusinessClient[]; engagements: BusinessEngagement[]; agreements: BusinessAgreement[]; reconciliation: ReconciliationItem[]; obligations: BusinessObligation[]; vendors: BusinessVendor[]; correspondence: BusinessCorrespondence[]; }

export const emptyBusinessAdmin = (): BusinessAdminData => ({ version: 1, clients: [], engagements: [], agreements: [], reconciliation: [], obligations: [], vendors: [], correspondence: [] });
export const newBusinessAdminId = (prefix: 'client' | 'engagement' | 'agreement' | 'reconciliation' | 'obligation' | 'vendor' | 'correspondence'): string => `business-${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const optionalNumber = (value: unknown): number | undefined => value !== '' && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : undefined;
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const block = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((item) => item.id === value) ? value as DayBlockId : undefined;

export function parseBusinessAdmin(value: unknown): BusinessAdminData {
  const raw = object(value);
  return {
    version: 1,
    clients: array(raw.clients).map(object).filter((item) => text(item.id) && text(item.name)).map((item) => ({ id: text(item.id), name: text(item.name), type: choice(item.type, ['Company', 'Individual'] as const, 'Company'), status: choice(item.status, CLIENT_STATUSES, 'Lead'), email: text(item.email), phone: text(item.phone), vatId: text(item.vatId), address: text(item.address), notes: text(item.notes) })),
    engagements: array(raw.engagements).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), clientId: text(item.clientId), title: text(item.title), status: choice(item.status, ENGAGEMENT_STATUSES, 'Lead'), startDate: optionalText(item.startDate), endDate: optionalText(item.endDate), valueEur: optionalNumber(item.valueEur), nextAction: text(item.nextAction), projectId: optionalText(item.projectId), notes: text(item.notes) })),
    agreements: array(raw.agreements).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), clientId: optionalText(item.clientId), engagementId: optionalText(item.engagementId), type: choice(item.type, AGREEMENT_TYPES, 'Contract'), title: text(item.title), status: choice(item.status, AGREEMENT_STATUSES, 'Draft'), date: text(item.date), expiresOn: optionalText(item.expiresOn), valueEur: optionalNumber(item.valueEur), noteId: optionalNumber(item.noteId), notes: text(item.notes) })),
    reconciliation: array(raw.reconciliation).map(object).filter((item) => text(item.id) && text(item.sourceRef)).map((item) => ({ id: text(item.id), sourceType: choice(item.sourceType, ['Expense', 'Invoice', 'Bank', 'Other'] as const, 'Other'), sourceRef: text(item.sourceRef), date: text(item.date), counterparty: text(item.counterparty), amountEur: Math.max(0, Number(item.amountEur) || 0), status: choice(item.status, RECONCILIATION_STATUSES, 'Unmatched'), evidence: text(item.evidence), notes: text(item.notes) })),
    obligations: array(raw.obligations).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), type: choice(item.type, OBLIGATION_TYPES, 'Other'), title: text(item.title), authority: text(item.authority), dueDate: text(item.dueDate), blockId: block(item.blockId), status: choice(item.status, OBLIGATION_STATUSES, 'Open'), submittedOn: optionalText(item.submittedOn), reference: text(item.reference), notes: text(item.notes) })),
    vendors: array(raw.vendors).map(object).filter((item) => text(item.id) && text(item.name)).map((item) => ({ id: text(item.id), name: text(item.name), category: text(item.category), status: choice(item.status, VENDOR_STATUSES, 'Active'), email: text(item.email), contractEnd: optionalText(item.contractEnd), renewalDate: optionalText(item.renewalDate), noticePeriod: text(item.noticePeriod), notes: text(item.notes) })),
    correspondence: array(raw.correspondence).map(object).filter((item) => text(item.id) && text(item.subject)).map((item) => ({ id: text(item.id), direction: choice(item.direction, ['Inbound', 'Outbound'] as const, 'Inbound'), counterpartyType: choice(item.counterpartyType, ['Client', 'Vendor', 'Authority', 'Other'] as const, 'Other'), counterpartyId: optionalText(item.counterpartyId), subject: text(item.subject), date: text(item.date), dueDate: optionalText(item.dueDate), blockId: block(item.blockId), status: choice(item.status, CORRESPONDENCE_STATUSES, 'Open'), notes: text(item.notes) })),
  };
}

export const obligationsOn = (data: BusinessAdminData, date: string): BusinessObligation[] => data.obligations.filter((item) => item.dueDate === date && item.blockId);
export const correspondenceOn = (data: BusinessAdminData, date: string): BusinessCorrespondence[] => data.correspondence.filter((item) => item.dueDate === date && item.blockId);
export const businessAdminHealth = (data: BusinessAdminData, date: string) => ({
  overdueObligations: data.obligations.filter((item) => ['Open', 'Prepared'].includes(item.status) && item.dueDate && item.dueDate < date),
  unmatched: data.reconciliation.filter((item) => item.status === 'Unmatched'),
  unanswered: data.correspondence.filter((item) => ['Open', 'Waiting'].includes(item.status) && item.dueDate && item.dueDate < date),
  expiringAgreements: data.agreements.filter((item) => item.expiresOn && item.expiresOn >= date && item.expiresOn <= new Date(new Date(`${date}T00:00:00Z`).getTime() + 30 * 86_400_000).toISOString().slice(0, 10)),
  missingNextActions: data.engagements.filter((item) => item.status === 'Active' && !item.nextAction.trim()),
});

import type { TodoItem } from './todos';
import type { TimeEntry } from './timeTracking';
import type { ExpenseRecord } from './euer';
import type { RetentionClass } from './gobd';
import type { SellerProfile } from './invoicing';
import type { OperationalCollection } from './operationalState';

type ObjectValue = Record<string, unknown>;
const invalid = (): never => { throw new Error('Invalid operational record. Export the source for recovery.'); };
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as ObjectValue;
}
function text(value: unknown, max = 10000): string {
  if (typeof value !== 'string' || value.length > max) return invalid();
  return value;
}
function id(value: unknown): string {
  const result = text(value, 120);
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(result)) return invalid();
  return result;
}
function date(value: unknown): string {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
    || new Date(result).toISOString().slice(0, 10) !== result) return invalid();
  return result;
}
function number(value: unknown, maximum = 1e12): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) return invalid();
  return value;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') return invalid(); return value; }
export function validateTodo(value: unknown): TodoItem {
  const item = object(value); id(item.id); text(item.title); text(item.list); boolean(item.done);
  if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(item.priority))) return invalid();
  if (item.dueDate !== undefined) date(item.dueDate);
  if (item.noteId !== undefined && (!Number.isSafeInteger(item.noteId) || Number(item.noteId) < 1)) return invalid();
  return { ...item } as unknown as TodoItem;
}
export function validateTimeEntry(value: unknown): TimeEntry {
  const item = object(value); id(item.id); date(item.date); text(item.engagement); text(item.description);
  number(item.minutes, 1e8); number(item.rateEur); boolean(item.billable); boolean(item.billed);
  return { ...item } as unknown as TimeEntry;
}
export function validateExpense(value: unknown): ExpenseRecord {
  const item = object(value); id(item.id); date(item.date); text(item.vendor); text(item.description);
  number(item.netEur); text(item.category);
  if (![0, 7, 19].includes(Number(item.vatRate)) || typeof item.vatRate !== 'number') return invalid();
  return { ...item } as unknown as ExpenseRecord;
}
export function validateRetentionClass(value: unknown): RetentionClass {
  const item = object(value); id(item.id); text(item.label);
  if (!Number.isSafeInteger(item.years)) return invalid(); number(item.years, 1000);
  return { ...item } as unknown as RetentionClass;
}
export function validateSeller(value: unknown): SellerProfile | null {
  if (value === null) return null;
  const item = object(value);
  for (const field of ['name', 'address']) text(item[field]);
  for (const field of ['taxNumber', 'vatId', 'iban', 'email']) if (item[field] !== undefined) text(item[field]);
  return { ...item } as unknown as SellerProfile;
}
export function validateStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return invalid();
  const strings = value.map(item => text(item, 500));
  if (strings.length > 10000 || new Set(strings).size !== strings.length) return invalid();
  return strings;
}
export const TODO_COLLECTION: OperationalCollection<TodoItem> = {
  namespace: 'todo-lists', schemaId: 'modulo.todo', legacyKey: 'modulo-todos', validate: validateTodo,
};
export const TIME_COLLECTION: OperationalCollection<TimeEntry> = {
  namespace: 'zeiterfassung', schemaId: 'modulo.time-entry', legacyKey: 'modulo-time-entries', validate: validateTimeEntry,
};
export const EXPENSE_COLLECTION: OperationalCollection<ExpenseRecord> = {
  namespace: 'euer-datev', schemaId: 'modulo.expense', legacyKey: 'modulo-euer-expenses', validate: validateExpense,
};

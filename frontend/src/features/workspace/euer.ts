// EÜR bookkeeping + DATEV export (#366). Income derives from paid invoices
// (Rechnung plugin); expenses are recorded here. The module produces the
// period summary behind a USt-Voranmeldung and a DATEV-Buchungsstapel-style
// CSV for the Steuerberater handoff. Explicitly NOT a tax-filing tool: the
// account mapping is an SKR03-style default meant to be adjusted with the
// Steuerberater, and this file encodes mechanics, not tax advice.

import { computeTotals, type NoteInvoice, type VatMode } from './invoicing';

// ── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseRecord {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  vendor: string;
  description: string;
  netEur: number;
  /** German input-VAT rate on the receipt: 0, 7 or 19. */
  vatRate: number;
  category: string;
}

export const DEFAULT_CATEGORIES = [
  'Fremdleistungen',
  'Raumkosten',
  'Versicherungen',
  'Reisekosten',
  'Fortbildung',
  'IT & Software',
  'Telekommunikation',
  'Sonstige',
];

const EXPENSES_KEY = 'modulo-euer-expenses';
const CATEGORIES_KEY = 'modulo-euer-categories';
const EXPORTED_KEY = 'modulo-euer-exported';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const expenseVat = (e: ExpenseRecord): number => round2((e.netEur * e.vatRate) / 100);
export const expenseGross = (e: ExpenseRecord): number => round2(e.netEur + expenseVat(e));

export function readExpenses(): ExpenseRecord[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ExpenseRecord =>
        typeof e === 'object' && e !== null && typeof (e as ExpenseRecord).id === 'string' && typeof (e as ExpenseRecord).netEur === 'number',
    );
  } catch {
    return [];
  }
}

export function writeExpenses(expenses: ExpenseRecord[]): void {
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch {
    // Storage unavailable — records live for the session only.
  }
}

export function readCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every((c) => typeof c === 'string')
      ? parsed
      : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function writeCategories(categories: string[]): void {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // Storage unavailable.
  }
}

// ── Periods ──────────────────────────────────────────────────────────────────

/** `2026-07-21` → `2026-07`. */
export const periodKey = (date: string): string => date.slice(0, 7);

export function inPeriod(date: string, period: string): boolean {
  return periodKey(date) === period;
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Period summary (the USt-VA numbers) ──────────────────────────────────────

export interface PeriodSummary {
  period: string;
  /** Net income by VAT mode (paid invoices only). */
  incomeByMode: Partial<Record<VatMode, number>>;
  incomeNet: number;
  /** Output VAT collected (domestic invoices). */
  outputVat: number;
  expensesByCategory: Record<string, number>;
  expenseNet: number;
  /** Input VAT paid on expenses (Vorsteuer). */
  inputVat: number;
  /** outputVat - inputVat; negative = refund position. */
  vatPayable: number;
}

/** Paid invoices and expenses of one period.
 *  Simplification (documented): income is bucketed by invoice date; strict EÜR
 *  uses the payment date (Zuflussprinzip) — adjust with the Steuerberater. */
export function summarizePeriod(invoices: NoteInvoice[], expenses: ExpenseRecord[], period: string): PeriodSummary {
  const incomeByMode: Partial<Record<VatMode, number>> = {};
  let incomeNet = 0;
  let outputVat = 0;
  for (const { invoice } of invoices) {
    if (invoice.status !== 'paid' || !inPeriod(invoice.date, period)) continue;
    const totals = computeTotals(invoice);
    incomeByMode[invoice.vatMode] = round2((incomeByMode[invoice.vatMode] ?? 0) + totals.net);
    incomeNet = round2(incomeNet + totals.net);
    outputVat = round2(outputVat + totals.vat);
  }

  const expensesByCategory: Record<string, number> = {};
  let expenseNet = 0;
  let inputVat = 0;
  for (const e of expenses) {
    if (!inPeriod(e.date, period)) continue;
    expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + e.netEur);
    expenseNet = round2(expenseNet + e.netEur);
    inputVat = round2(inputVat + expenseVat(e));
  }

  return {
    period,
    incomeByMode,
    incomeNet,
    outputVat,
    expensesByCategory,
    expenseNet,
    inputVat,
    vatPayable: round2(outputVat - inputVat),
  };
}

// ── DATEV export ─────────────────────────────────────────────────────────────
// A Buchungsstapel-style CSV (EXTF). SKR03-style default accounts; the mapping
// is intentionally centralised here so the Steuerberater can dictate changes.

export const INCOME_ACCOUNTS: Record<VatMode, string> = {
  domestic: '8400', // Erlöse 19% USt
  'eu-reverse-charge': '8336', // Erlöse §13b, Leistungsempfänger schuldet USt
  'non-eu': '8338', // Nicht steuerbare Umsätze Drittland
  kleinunternehmer: '8195', // Erlöse als Kleinunternehmer
};

export const DEFAULT_EXPENSE_ACCOUNT = '4900'; // Sonstige betriebliche Aufwendungen
export const EXPENSE_ACCOUNTS: Record<string, string> = {
  Fremdleistungen: '3100',
  Raumkosten: '4210',
  Versicherungen: '4360',
  Reisekosten: '4670',
  Fortbildung: '4945',
  'IT & Software': '4964',
  Telekommunikation: '4920',
};

const BANK_ACCOUNT = '1200';

const deAmount = (n: number): string => n.toFixed(2).replace('.', ',');
/** `2026-07-21` → `2107` (DATEV Belegdatum DDMM). */
const belegDatum = (date: string): string => `${date.slice(8, 10)}${date.slice(5, 7)}`;
const csvField = (s: string): string => `"${s.replace(/"/g, '""')}"`;

export function datevCsv(invoices: NoteInvoice[], expenses: ExpenseRecord[], period: string): string {
  const rows: string[] = [];
  // Simplified EXTF header: format name + version, then the column header row.
  rows.push('"EXTF";510;21;"Buchungsstapel";7;;;;;;;;;;');
  rows.push(
    ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'Belegdatum', 'Belegfeld 1', 'Buchungstext']
      .map(csvField)
      .join(';'),
  );

  for (const { invoice } of invoices) {
    if (invoice.status !== 'paid' || !inPeriod(invoice.date, period)) continue;
    const totals = computeTotals(invoice);
    rows.push(
      [
        csvField(deAmount(totals.gross)),
        csvField('H'),
        csvField(INCOME_ACCOUNTS[invoice.vatMode]),
        csvField(BANK_ACCOUNT),
        csvField(belegDatum(invoice.date)),
        csvField(invoice.number),
        csvField(`Rechnung ${invoice.number} ${invoice.clientName}`),
      ].join(';'),
    );
  }

  for (const e of expenses) {
    if (!inPeriod(e.date, period)) continue;
    rows.push(
      [
        csvField(deAmount(expenseGross(e))),
        csvField('S'),
        csvField(EXPENSE_ACCOUNTS[e.category] ?? DEFAULT_EXPENSE_ACCOUNT),
        csvField(BANK_ACCOUNT),
        csvField(belegDatum(e.date)),
        csvField(e.id),
        csvField(`${e.vendor} ${e.description}`.trim()),
      ].join(';'),
    );
  }

  return rows.join('\r\n');
}

// ── Export marks (double-export guard) ───────────────────────────────────────

export function readExportedPeriods(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPORTED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((p): p is string => typeof p === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function markExported(period: string): void {
  try {
    const set = readExportedPeriods();
    set.add(period);
    localStorage.setItem(EXPORTED_KEY, JSON.stringify([...set]));
  } catch {
    // Storage unavailable — the re-export warning simply won't trigger.
  }
}

export function newExpenseId(): string {
  return `ex-${Math.random().toString(36).slice(2, 10)}`;
}

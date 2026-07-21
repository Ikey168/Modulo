import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteInvoice } from '../invoicing';
import {
  datevCsv,
  expenseGross,
  markExported,
  periodKey,
  readCategories,
  readExpenses,
  readExportedPeriods,
  shiftPeriod,
  summarizePeriod,
  writeCategories,
  writeExpenses,
  type ExpenseRecord,
} from '../euer';

const invoice = (number: string, date: string, status: string, vatMode: string, net: number): NoteInvoice => ({
  noteId: 1,
  noteTitle: 'n',
  invoice: {
    number,
    date,
    status: status as never,
    clientName: 'Acme',
    vatMode: vatMode as never,
    lines: [{ description: 'Audit', quantity: 1, unitPrice: net }],
  },
});

const expense = (id: string, over: Partial<ExpenseRecord> = {}): ExpenseRecord => ({
  id,
  date: '2026-07-10',
  vendor: 'Hetzner',
  description: 'Server',
  netEur: 100,
  vatRate: 19,
  category: 'IT & Software',
  ...over,
});

beforeEach(() => localStorage.clear());

describe('periods', () => {
  it('derives and shifts month keys across year boundaries', () => {
    expect(periodKey('2026-07-21')).toBe('2026-07');
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
  });
});

describe('summarizePeriod', () => {
  const invoices = [
    invoice('2026-001', '2026-07-01', 'paid', 'domestic', 1000),
    invoice('2026-002', '2026-07-02', 'paid', 'eu-reverse-charge', 8000),
    invoice('2026-003', '2026-07-03', 'sent', 'domestic', 500), // unpaid → excluded
    invoice('2026-004', '2026-06-30', 'paid', 'domestic', 400), // other period
  ];
  const expenses = [expense('a'), expense('b', { date: '2026-06-01' })];

  it('computes the USt-VA numbers for the period', () => {
    const s = summarizePeriod(invoices, expenses, '2026-07');
    expect(s.incomeNet).toBe(9000);
    expect(s.incomeByMode).toEqual({ domestic: 1000, 'eu-reverse-charge': 8000 });
    expect(s.outputVat).toBe(190);
    expect(s.expenseNet).toBe(100);
    expect(s.inputVat).toBe(19);
    expect(s.vatPayable).toBe(171);
    expect(s.expensesByCategory).toEqual({ 'IT & Software': 100 });
  });

  it('expense gross includes the input VAT', () => {
    expect(expenseGross(expense('a'))).toBe(119);
    expect(expenseGross(expense('a', { vatRate: 0 }))).toBe(100);
  });
});

describe('datevCsv', () => {
  it('emits EXTF header, income (H) and expense (S) rows with German decimals', () => {
    const csv = datevCsv(
      [invoice('2026-001', '2026-07-01', 'paid', 'domestic', 1000)],
      [expense('a', { category: 'Fremdleistungen' })],
      '2026-07',
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('"EXTF"');
    expect(lines[0]).toContain('Buchungsstapel');
    // Income: gross 1190 to account 8400, H.
    expect(csv).toContain('"1190,00";"H";"8400";"1200";"0107";"2026-001"');
    // Expense: gross 119 to Fremdleistungen 3100, S.
    expect(csv).toContain('"119,00";"S";"3100";"1200";"1007";"a"');
  });

  it('excludes unpaid invoices and other periods', () => {
    const csv = datevCsv(
      [invoice('2026-001', '2026-07-01', 'sent', 'domestic', 1000), invoice('2026-002', '2026-06-01', 'paid', 'domestic', 500)],
      [],
      '2026-07',
    );
    expect(csv).not.toContain('2026-001');
    expect(csv).not.toContain('2026-002');
  });

  it('escapes quotes in text fields', () => {
    const csv = datevCsv([], [expense('a', { vendor: 'ACME "Pro"' })], '2026-07');
    expect(csv).toContain('""Pro""');
  });
});

describe('persistence', () => {
  it('round-trips expenses, categories, and export marks', () => {
    writeExpenses([expense('a')]);
    expect(readExpenses()).toHaveLength(1);
    writeCategories(['X', 'Y']);
    expect(readCategories()).toEqual(['X', 'Y']);
    expect(readExportedPeriods().has('2026-07')).toBe(false);
    markExported('2026-07');
    expect(readExportedPeriods().has('2026-07')).toBe(true);
    localStorage.setItem('modulo-euer-expenses', 'nope');
    expect(readExpenses()).toEqual([]);
  });
});

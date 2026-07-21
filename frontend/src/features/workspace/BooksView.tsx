// Books (EÜR) view (#366): per-month income from paid invoices, manually
// recorded expenses by category, the USt-VA summary numbers, and the DATEV
// Buchungsstapel CSV export with a double-export guard. Business hub tab.
import { useMemo, useState } from 'react';
import { BookText, ChevronLeft, ChevronRight, FileDown, Plus, Trash2 } from 'lucide-react';
import { Button, Input, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { extractInvoices, formatEur, VAT_MODES, computeTotals } from './invoicing';
import {
  datevCsv,
  expenseGross,
  inPeriod,
  markExported,
  newExpenseId,
  periodKey,
  readCategories,
  readExpenses,
  readExportedPeriods,
  shiftPeriod,
  summarizePeriod,
  writeCategories,
  writeExpenses,
  type ExpenseRecord,
} from './euer';

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = { date: '', vendor: '', description: '', net: '', vatRate: '19', category: '' };

export function BooksView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const [period, setPeriod] = useState(() => periodKey(new Date().toISOString().slice(0, 10)));
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => readExpenses());
  const [categories, setCategories] = useState<string[]>(() => readCategories());
  const [form, setForm] = useState({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10), category: '' });
  const [exportedVersion, bumpExported] = useState(0);

  const invoices = useMemo(() => extractInvoices(data.notes), [data.notes]);
  const summary = useMemo(() => summarizePeriod(invoices, expenses, period), [invoices, expenses, period]);
  const exported = useMemo(() => readExportedPeriods(), [exportedVersion]);

  const periodIncome = invoices.filter((i) => i.invoice.status === 'paid' && inPeriod(i.invoice.date, period));
  const periodExpenses = expenses.filter((e) => inPeriod(e.date, period));

  const persistExpenses = (next: ExpenseRecord[]) => {
    setExpenses(next);
    writeExpenses(next);
  };

  const addExpense = () => {
    const net = Number(form.net.replace(',', '.'));
    if (!form.date || !form.vendor || !Number.isFinite(net) || net <= 0) {
      toast({ variant: 'destructive', title: 'Expense incomplete', description: 'Date, vendor and a net amount are required.' });
      return;
    }
    const category = form.category || categories[categories.length - 1];
    if (!categories.includes(category)) {
      const next = [...categories, category];
      setCategories(next);
      writeCategories(next);
    }
    persistExpenses([
      { id: newExpenseId(), date: form.date, vendor: form.vendor, description: form.description, netEur: net, vatRate: Number(form.vatRate), category },
      ...expenses,
    ]);
    setForm({ ...EMPTY_FORM, date: form.date, category });
  };

  const doExport = () => {
    if (periodIncome.length === 0 && periodExpenses.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to export', description: `No paid invoices or expenses in ${period}.` });
      return;
    }
    if (exported.has(period)) {
      toast({ title: `${period} was already exported`, description: 'Exporting again — tell your Steuerberater to replace the earlier file.' });
    }
    download(`DATEV-Buchungsstapel-${period}.csv`, datevCsv(invoices, expenses, period), 'text/csv');
    markExported(period);
    bumpExported((v) => v + 1);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Books</h2>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-16 text-center font-mono text-sm">{period}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => setPeriod(shiftPeriod(period, 1))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={doExport}>
          <FileDown className="size-4" aria-hidden="true" />
          DATEV export{exported.has(period) ? ' (again)' : ''}
        </Button>
      </div>

      {/* USt-VA summary */}
      <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-4">
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">Income (net, paid)</div>
          <div className="text-sm font-semibold tabular-nums">{formatEur(summary.incomeNet)}</div>
          <div className="mt-0.5 space-y-px text-xxs text-muted-foreground">
            {Object.entries(summary.incomeByMode).map(([mode, net]) => (
              <div key={mode}>
                {VAT_MODES[mode as keyof typeof VAT_MODES].label}: {formatEur(net)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">USt collected</div>
          <div className="text-sm font-semibold tabular-nums">{formatEur(summary.outputVat)}</div>
        </div>
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">Expenses (net) / Vorsteuer</div>
          <div className="text-sm font-semibold tabular-nums">
            {formatEur(summary.expenseNet)} / {formatEur(summary.inputVat)}
          </div>
        </div>
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">USt-VA Zahllast</div>
          <div className={`text-sm font-semibold tabular-nums ${summary.vatPayable < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
            {formatEur(summary.vatPayable)}
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
        {/* Income */}
        <section className="rounded-md border border-border">
          <header className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-medium">
            Income — paid invoices in {period}
          </header>
          {periodIncome.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No paid invoices dated in this period.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {periodIncome.map((i) => (
                <li key={`${i.noteId}-${i.invoice.number}`}>
                  <button
                    type="button"
                    onClick={() => onOpenNote(i.noteId)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="font-mono text-xs">{i.invoice.number}</span>
                    <span className="min-w-0 flex-1 truncate">{i.invoice.clientName}</span>
                    <span className="tabular-nums">{formatEur(computeTotals(i.invoice).gross)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Expenses */}
        <section className="rounded-md border border-border">
          <header className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-medium">Expenses in {period}</header>
          <div className="flex flex-wrap items-end gap-1.5 border-b border-border/60 p-2">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date" className="h-8 w-36 text-sm" />
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor" className="h-8 w-32 text-sm" />
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="h-8 w-36 text-sm" />
            <Input value={form.net} onChange={(e) => setForm({ ...form, net: e.target.value })} placeholder="Net €" aria-label="Net amount" className="h-8 w-20 text-sm" />
            <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} aria-label="VAT rate" className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm">
              <option value="19">19%</option>
              <option value="7">7%</option>
              <option value="0">0%</option>
            </select>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm">
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={addExpense}>
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Button>
          </div>
          {periodExpenses.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              <BookText className="mr-1 inline size-3.5" aria-hidden="true" />
              No expenses recorded for this period.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {periodExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{e.date}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {e.vendor}
                    {e.description ? ` — ${e.description}` : ''}
                  </span>
                  <span className="rounded-full border border-border px-1.5 text-xxs text-muted-foreground">{e.category}</span>
                  <span className="tabular-nums text-xs">{formatEur(expenseGross(e))}</span>
                  <button
                    type="button"
                    aria-label="Delete expense"
                    onClick={() => persistExpenses(expenses.filter((x) => x.id !== e.id))}
                    className="text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="px-4 pb-3 text-xxs text-muted-foreground">
        Not a tax-filing tool. Income buckets by invoice date (strict EÜR uses the payment date) and account numbers are
        SKR03-style defaults — review both with your Steuerberater.
      </p>
    </div>
  );
}

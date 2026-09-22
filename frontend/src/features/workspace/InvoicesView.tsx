import { dayKey } from './noteDates';
// Invoices tab in the Business hub (#364): every ```invoice fence across the
// vault with status and totals, a seller-profile editor (the §14 issuer data),
// per-invoice ZUGFeRD (EN 16931 CII) XML export, and a "new invoice note"
// action that continues the sequential number series.
import { useMemo, useState } from 'react';
import { FileDown, FilePlus2, ReceiptText } from 'lucide-react';
import { Button, EmptyState, Input, Label, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { InvoiceStatusChip } from './InvoiceCard';
import {
  computeTotals,
  extractInvoices,
  formatEur,
  invoiceTemplate,
  INVOICE_STATUSES,
  nextInvoiceNumber,
  validateInvoice,
  zugferdXml,
  type InvoiceStatus,
  type SellerProfile,
} from './invoicing';
import { useSellerProfileStore } from './usePluginDataStores';
import { EntryPopover, EntryPopoverBody, PopoverEditor } from './EntryPopover';

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_PROFILE: SellerProfile = { name: '', address: '', taxNumber: '', vatId: '', iban: '', email: '' };

function SellerProfileForm({ value, onSaved }: { value: SellerProfile | null; onSaved: (profile: SellerProfile) => void }) {
  const [profile, setProfile] = useState<SellerProfile>(() => value ?? EMPTY_PROFILE);
  const set = (key: keyof SellerProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }));

  const FIELDS: Array<[keyof SellerProfile, string, string]> = [
    ['name', 'Name', 'Audit GmbH / your name'],
    ['address', 'Address', 'Street, PLZ City'],
    ['taxNumber', 'Steuernummer', '12/345/67890'],
    ['vatId', 'USt-IdNr', 'DE123456789'],
    ['iban', 'IBAN', 'DE00 …'],
    ['email', 'Email', 'billing@…'],
  ];

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-2">
      {FIELDS.map(([key, label, placeholder]) => (
        <div key={key} className="flex flex-col gap-1">
          <Label className="text-xxs uppercase tracking-wide text-muted-foreground">{label}</Label>
          <Input value={profile[key] ?? ''} placeholder={placeholder} onChange={set(key)} className="h-8 text-sm" />
        </div>
      ))}
      <div className="sm:col-span-2">
        <Button
          size="sm"
          onClick={() => { onSaved(profile); }}
        >
          Save seller profile
        </Button>
      </div>
    </div>
  );
}

export function InvoicesView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [showProfile, setShowProfile] = useState(false);
  const [seller, setSeller] = useSellerProfileStore();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const invoices = useMemo(() => extractInvoices(data.notes), [data.notes]);
  const filtered = invoices.filter((i) => status === 'all' || i.invoice.status === status);
  const selected = invoices.find((entry) => entry.noteId === selectedNoteId) ?? null;

  const outstanding = invoices
    .filter((i) => i.invoice.status === 'sent' || i.invoice.status === 'overdue')
    .reduce((sum, i) => sum + computeTotals(i.invoice).gross, 0);

  const newInvoice = async () => {
    const now = new Date();
    const number = nextInvoiceNumber(
      invoices.map((i) => i.invoice.number),
      now.getFullYear(),
    );
    const date = dayKey(now);
    const created = await data.createNote(`Rechnung ${number}`, `${invoiceTemplate(number, date)}\n`);
    if (created) {
      toast({ title: `Rechnung ${number} created`, description: 'It is ready in the invoice list.' });
    }
  };

  const exportXml = (idx: number) => {
    const { invoice } = filtered[idx];
    if (!seller) {
      setShowProfile(true);
      toast({ variant: 'destructive', title: 'Seller profile missing', description: 'Set your issuer data first.' });
      return;
    }
    const missing = validateInvoice(invoice, seller);
    if (missing.length > 0) {
      toast({
        variant: 'destructive',
        title: `Rechnung ${invoice.number} is incomplete`,
        description: missing.join('; '),
      });
      return;
    }
    download(`Rechnung-${invoice.number}.zugferd.xml`, zugferdXml(invoice, seller), 'application/xml');
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Invoices</h2>
          <Button size="sm" onClick={() => void newInvoice()}>
            <FilePlus2 className="size-4" aria-hidden="true" />
            New invoice
          </Button>
          <PopoverEditor title="Seller profile"><SellerProfileForm value={seller} onSaved={(profile) => { if (setSeller(profile)) { setShowProfile(false); toast({ title: 'Seller profile saved' }); } }} /></PopoverEditor>
          <span className="ml-auto text-xs text-muted-foreground">
            Outstanding: <span className="font-medium tabular-nums">{formatEur(outstanding)}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(['all', ...INVOICE_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s as InvoiceStatus | 'all')}
              className={
                status === s
                  ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs capitalize text-primary'
                  : 'rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground hover:text-foreground'
              }
            >
              {s}
            </button>
          ))}
        </div>
        {showProfile && (
          <div className="mt-3">
            <SellerProfileForm
              value={seller}
              onSaved={(profile) => {
                if (setSeller(profile)) {
                  setShowProfile(false);
                  toast({ title: 'Seller profile saved' });
                }
              }}
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<ReceiptText className="size-5" />}
            title={invoices.length === 0 ? 'No invoices yet' : 'No invoices match the filter'}
            description={
              invoices.length === 0
                ? 'Create one — it lands as a note with an ```invoice fence and the next sequential number.'
                : 'Relax the status filter to see more.'
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((entry, idx) => {
            const totals = computeTotals(entry.invoice);
            const missing = validateInvoice(entry.invoice, seller);
            return (
              <li key={`${entry.noteId}-${entry.invoice.number}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedNoteId(entry.noteId)}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono text-sm font-medium">{entry.invoice.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.invoice.clientName}</span>
                  <InvoiceStatusChip status={entry.invoice.status} />
                  {missing.length > 0 && (
                    <span className="text-xxs text-warning">§14: {missing.length} missing</span>
                  )}
                  <span className="tabular-nums text-sm">{formatEur(totals.gross)}</span>
                </button>
                <Button size="sm" variant="ghost" aria-label={`Export ${entry.invoice.number} as ZUGFeRD XML`} onClick={() => exportXml(idx)}>
                  <FileDown className="size-4" aria-hidden="true" />
                  XML
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <EntryPopover open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedNoteId(null); }} title={selected ? `Invoice ${selected.invoice.number}` : 'Invoice'} description={selected ? `${selected.invoice.clientName} · ${selected.invoice.status}` : undefined}>
        {selected && <EntryPopoverBody><div className="space-y-5 p-5"><div className="flex flex-wrap items-center gap-2"><InvoiceStatusChip status={selected.invoice.status}/><span className="text-sm text-muted-foreground">Issued {selected.invoice.date}{selected.invoice.dueDate ? ` · due ${selected.invoice.dueDate}` : ''}</span><Button className="ml-auto" size="sm" onClick={() => onOpenNote(selected.noteId)}>Edit invoice note</Button></div><div className="grid gap-3 sm:grid-cols-3"><InvoiceFact label="Client" value={selected.invoice.clientName}/><InvoiceFact label="VAT mode" value={selected.invoice.vatMode}/><InvoiceFact label="Total" value={formatEur(computeTotals(selected.invoice).gross)}/></div><section className="overflow-hidden rounded-lg border border-border"><header className="border-b border-border bg-muted/20 px-3 py-2 text-sm font-medium">Line items</header><div className="divide-y divide-border">{selected.invoice.lines.map((line, index) => <div key={`${line.description}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-sm"><span>{line.description}</span><span className="text-muted-foreground">{line.quantity} × {formatEur(line.unitPrice)}</span><strong>{formatEur(line.quantity * line.unitPrice)}</strong></div>)}</div></section></div></EntryPopoverBody>}
      </EntryPopover>
    </div>
  );
}

function InvoiceFact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xxs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value || 'Not set'}</p></div>; }

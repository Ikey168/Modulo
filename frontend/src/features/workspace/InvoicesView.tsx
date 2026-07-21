// Invoices tab in the Business hub (#364): every ```invoice fence across the
// vault with status and totals, a seller-profile editor (the §14 issuer data),
// per-invoice ZUGFeRD (EN 16931 CII) XML export, and a "new invoice note"
// action that continues the sequential number series.
import { useMemo, useState } from 'react';
import { FileDown, FilePlus2, ReceiptText, Settings2 } from 'lucide-react';
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
  readSellerProfile,
  validateInvoice,
  writeSellerProfile,
  zugferdXml,
  type InvoiceStatus,
  type SellerProfile,
} from './invoicing';

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_PROFILE: SellerProfile = { name: '', address: '', taxNumber: '', vatId: '', iban: '', email: '' };

function SellerProfileForm({ onSaved }: { onSaved: () => void }) {
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() ?? EMPTY_PROFILE);
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
          onClick={() => {
            writeSellerProfile(profile);
            onSaved();
          }}
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
  const [profileVersion, bumpProfile] = useState(0);

  const seller = useMemo(() => readSellerProfile(), [profileVersion]);
  const invoices = useMemo(() => extractInvoices(data.notes), [data.notes]);
  const filtered = invoices.filter((i) => status === 'all' || i.invoice.status === status);

  const outstanding = invoices
    .filter((i) => i.invoice.status === 'sent' || i.invoice.status === 'overdue')
    .reduce((sum, i) => sum + computeTotals(i.invoice).gross, 0);

  const newInvoice = async () => {
    const now = new Date();
    const number = nextInvoiceNumber(
      invoices.map((i) => i.invoice.number),
      now.getFullYear(),
    );
    const date = now.toISOString().slice(0, 10);
    const created = await data.createNote(`Rechnung ${number}`, `${invoiceTemplate(number, date)}\n`);
    if (created) {
      toast({ title: `Rechnung ${number} created`, description: 'Fill in the client and line items.' });
      onOpenNote(created.id);
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
          <Button size="sm" variant="outline" onClick={() => setShowProfile((v) => !v)}>
            <Settings2 className="size-4" aria-hidden="true" />
            Seller profile
          </Button>
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
              onSaved={() => {
                bumpProfile((v) => v + 1);
                setShowProfile(false);
                toast({ title: 'Seller profile saved' });
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
                  onClick={() => onOpenNote(entry.noteId)}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono text-sm font-medium">{entry.invoice.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.invoice.clientName}</span>
                  <InvoiceStatusChip status={entry.invoice.status} />
                  {missing.length > 0 && (
                    <span className="text-xxs text-amber-600 dark:text-amber-400">§14: {missing.length} missing</span>
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
    </div>
  );
}

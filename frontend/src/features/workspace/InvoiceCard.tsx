// Renders one ```invoice fence as a formatted invoice card (#364): parties,
// line-item table, totals with the correct VAT treatment and clause, status,
// and §14 UStG completeness warnings. Malformed source renders an error card.
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/ui';
import {
  computeTotals,
  formatEur,
  isInvoiceError,
  parseInvoice,
  readSellerProfile,
  validateInvoice,
  VAT_MODES,
  type InvoiceStatus,
} from './invoicing';

export const INVOICE_STATUS_CHIP: Record<InvoiceStatus, string> = {
  draft: 'border-border text-muted-foreground',
  sent: 'border-blue-500/40 text-blue-600 dark:text-blue-400',
  paid: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  overdue: 'border-red-500/40 text-red-600 dark:text-red-400',
};

export function InvoiceStatusChip({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xxs font-medium capitalize',
        INVOICE_STATUS_CHIP[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function InvoiceCard({ source }: { source: string }) {
  const parsed = parseInvoice(source);

  if (isInvoiceError(parsed)) {
    return (
      <div className="my-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-medium">Invalid invoice block</div>
          <div className="text-xs opacity-90">{parsed.error}</div>
        </div>
      </div>
    );
  }

  const seller = readSellerProfile();
  const totals = computeTotals(parsed);
  const info = VAT_MODES[parsed.vatMode];
  const missing = validateInvoice(parsed, seller);

  return (
    <div className="my-2 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold">Rechnung {parsed.number}</span>
        <span className="text-xs text-muted-foreground">{parsed.date}</span>
        <InvoiceStatusChip status={parsed.status} className="ml-auto" />
      </div>

      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">From</div>
          <div>{seller?.name ?? <span className="text-muted-foreground">Seller profile not set</span>}</div>
          {seller?.address && <div className="text-muted-foreground">{seller.address}</div>}
          {(seller?.vatId || seller?.taxNumber) && (
            <div className="text-muted-foreground">{seller.vatId ?? seller.taxNumber}</div>
          )}
        </div>
        <div>
          <div className="text-xxs uppercase tracking-wide text-muted-foreground">To</div>
          <div>{parsed.clientName}</div>
          {parsed.clientAddress && <div className="text-muted-foreground">{parsed.clientAddress}</div>}
          {parsed.clientVatId && <div className="text-muted-foreground">{parsed.clientVatId}</div>}
        </div>
      </div>

      {parsed.serviceDate && (
        <div className="mt-1.5 text-xs text-muted-foreground">Leistungszeitraum: {parsed.serviceDate}</div>
      )}

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-xxs uppercase tracking-wide text-muted-foreground">
            <th className="py-1 font-medium">Description</th>
            <th className="py-1 text-right font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Unit (net)</th>
            <th className="py-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {parsed.lines.map((l, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1 pr-2">{l.description}</td>
              <td className="py-1 text-right tabular-nums">{l.quantity}</td>
              <td className="py-1 text-right tabular-nums">{formatEur(l.unitPrice)}</td>
              <td className="py-1 text-right tabular-nums">{formatEur(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 ml-auto w-full max-w-56 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Net</span>
          <span className="tabular-nums">{formatEur(totals.net)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">VAT ({totals.vatRate}%)</span>
          <span className="tabular-nums">{formatEur(totals.vat)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-0.5 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatEur(totals.gross)}</span>
        </div>
      </div>

      {info.clause && <div className="mt-2 text-xs italic text-muted-foreground">{info.clause}</div>}
      {parsed.dueDate && <div className="mt-1 text-xs text-muted-foreground">Zahlbar bis {parsed.dueDate}.</div>}
      {parsed.paidEur !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground">
          Settled: {formatEur(parsed.paidEur)}
          {parsed.paidWith ? ` in ${parsed.paidWith}` : ''}
          {parsed.paidRate ? ` @ ${parsed.paidRate}` : ''} (EUR value at receipt)
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
          <div className="font-medium">§14 UStG — missing fields</div>
          <ul className="mt-0.5 list-inside list-disc">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

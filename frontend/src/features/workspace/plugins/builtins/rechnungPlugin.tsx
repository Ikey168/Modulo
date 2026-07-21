// Rechnung — German invoicing (#364). Contributes the ```invoice fence (a
// formatted invoice card with §14 UStG validation and VAT-mode clauses), the
// Invoices tab in the Business hub (list, seller profile, ZUGFeRD XML export,
// sequential numbering), and an editor action inserting an invoice template.
// Depends on Markdown Notes.
import { ReceiptText } from 'lucide-react';
import { InvoiceCard } from '../../InvoiceCard';
import { InvoicesView } from '../../InvoicesView';
import { invoiceTemplate } from '../../invoicing';
import type { NoteFenceProps, PluginModule, WorkspaceViewProps } from '../types';

function InvoiceFence({ source }: NoteFenceProps) {
  return <InvoiceCard source={source} />;
}

function InvoicesSurface(p: WorkspaceViewProps) {
  return <InvoicesView {...p} />;
}

const rechnungPlugin: PluginModule = {
  activate(ctx) {
    ctx.addNoteFence({ language: 'invoice', component: InvoiceFence });
    ctx.addView({ id: 'invoices', label: 'Invoices', icon: ReceiptText, order: 40, mode: 'business', component: InvoicesSurface });
    ctx.addEditorAction({
      id: 'insert-invoice',
      label: 'Insert invoice',
      icon: ReceiptText,
      run: (c) => {
        const date = new Date().toISOString().slice(0, 10);
        // The editor action cannot see existing numbers; the Invoices tab's
        // "New invoice" button continues the real sequence.
        c.insertAtCursor(`\n\n${invoiceTemplate(`${date.slice(0, 4)}-001`, date)}\n\n`);
      },
    });
  },
};

export default rechnungPlugin;

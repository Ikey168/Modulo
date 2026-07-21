// EÜR bookkeeping + DATEV export (#366) — income from paid invoices, manual
// expenses by category, USt-VA period numbers, and the Buchungsstapel CSV for
// the Steuerberater. Business hub tab; depends on Rechnung for the income side.
import { BookText } from 'lucide-react';
import { BooksView } from '../../BooksView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function BooksSurface(p: WorkspaceViewProps) {
  return <BooksView {...p} />;
}

const euerPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'books', label: 'Books', icon: BookText, order: 50, mode: 'business', component: BooksSurface });
  },
};

export default euerPlugin;

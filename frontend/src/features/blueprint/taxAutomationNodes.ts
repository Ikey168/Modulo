// Tax automation nodes (#367), contributed by the Tax Automation plugin.
// German filing-deadline reminders, payment chasing, and VIES USt-IdNr
// validation — mirrored by the backend interpreter cases. Mechanics, not tax
// advice; cadence and Dauerfristverlängerung are node config.

import { DataTypes, NodeDescriptor } from './nodeModel';

export const TAX_NODES: NodeDescriptor[] = [
  {
    type: 'action.tax.deadline.reminder',
    version: 1,
    category: 'action',
    title: 'Tax Deadline Reminder',
    description:
      'Creates a reminder note for the next USt-VA (10th of the following month; +1 month with ' +
      'Dauerfristverlängerung) and ZM (25th) deadlines. Cadence (monthly/quarterly) and ' +
      'Dauerfrist are node config. Pair with On Schedule; reminders dedupe by title.',
    execIn: true,
    execOut: ['then'],
    inputs: [],
    outputs: [
      { id: 'deadlines', name: 'Deadlines', type: DataTypes.String },
      { id: 'note', name: 'Note', type: DataTypes.Note },
    ],
    capability: 'notes:write',
  },
  {
    type: 'action.invoice.chase',
    version: 1,
    category: 'action',
    title: 'Chase Overdue Invoices',
    description:
      'Scans ```invoice fences for past-due invoices still awaiting payment and drafts a ' +
      'Zahlungserinnerung note per invoice (deduped; drafts only — nothing is sent automatically).',
    execIn: true,
    execOut: ['then'],
    inputs: [],
    outputs: [
      { id: 'overdueCount', name: 'Overdue', type: DataTypes.String },
      { id: 'draftsCreated', name: 'Drafts Created', type: DataTypes.String },
    ],
    capability: 'notes:write',
  },
  {
    type: 'action.vies.check',
    version: 1,
    category: 'action',
    title: 'VIES VAT-ID Check',
    description:
      'Validates a USt-IdNr against the EU VIES service. Outputs valid/invalid/unverified — ' +
      'unverified when VIES is unreachable, so the flow never blocks on the service.',
    execIn: true,
    execOut: ['then'],
    inputs: [{ id: 'vatId', name: 'VAT ID', type: DataTypes.String }],
    outputs: [
      { id: 'valid', name: 'Valid', type: DataTypes.Boolean },
      { id: 'status', name: 'Status', type: DataTypes.String },
      { id: 'checkedAt', name: 'Checked At', type: DataTypes.String },
    ],
    capability: 'network:vies',
  },
];

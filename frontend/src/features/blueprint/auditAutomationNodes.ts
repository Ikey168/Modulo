// Audit workflow automation nodes (#363), contributed to the blueprint palette
// by the Webhook Trigger and Scheduled Digest plugins. Descriptors are plain
// data mirrored by the backend interpreter cases.

import { DataTypes, NodeDescriptor } from './nodeModel';

/** Nodes contributed by the Webhook Trigger plugin. */
export const WEBHOOK_NODES: NodeDescriptor[] = [
  {
    type: 'trigger.webhook',
    version: 1,
    category: 'trigger',
    title: 'On Webhook',
    description:
      'Fires when the blueprint’s webhook endpoint is called ' +
      '(POST /api/public/blueprints/webhook/<blueprint>/<node> with X-Webhook-Secret). ' +
      'The shared secret is node config, not a pin; requests with a wrong secret are rejected.',
    execIn: false,
    execOut: ['then'],
    inputs: [],
    outputs: [{ id: 'payload', name: 'Payload', type: DataTypes.String }],
  },
  {
    type: 'action.audit.reaudit',
    version: 1,
    category: 'action',
    title: 'Create Re-audit Note',
    description:
      'Creates a fix-review intake note for an engagement (tagged engagement/… and stage/fix-review, ' +
      'so it lands in the pipeline’s Fix Review column) and records the webhook payload.',
    execIn: true,
    execOut: ['then'],
    inputs: [
      { id: 'engagement', name: 'Engagement', type: DataTypes.String },
      { id: 'payload', name: 'Payload', type: DataTypes.String },
    ],
    outputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    capability: 'notes:write',
  },
];

/** Nodes contributed by the Scheduled Digest plugin. */
export const DIGEST_NODES: NodeDescriptor[] = [
  {
    type: 'action.audit.digest',
    version: 1,
    category: 'action',
    title: 'Findings Status Digest',
    description:
      'Compiles finding counts by status (open/acknowledged/fixed/verified) for an engagement ' +
      'into a digest note. Pair with On Schedule for a weekly client status summary.',
    execIn: true,
    execOut: ['then'],
    inputs: [{ id: 'engagement', name: 'Engagement', type: DataTypes.String }],
    outputs: [
      { id: 'summary', name: 'Summary', type: DataTypes.String },
      { id: 'note', name: 'Note', type: DataTypes.Note },
    ],
    capability: 'notes:write',
  },
];

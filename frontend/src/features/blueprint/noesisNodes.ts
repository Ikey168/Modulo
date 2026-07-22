// Noesis knowledge-brief node, contributed by the Noesis Brief plugin.
// Fetches the daily brief (news, economics, tech, web3, and new research
// publications) from a Noesis instance as cited Markdown — mirrored by the
// backend interpreter case. Pair with On Schedule and Create Note to file
// the brief as a linked, taggable note every morning.

import { DataTypes, NodeDescriptor } from './nodeModel';

export const NOESIS_NODES: NodeDescriptor[] = [
  {
    type: 'action.noesis.brief',
    version: 1,
    category: 'action',
    title: 'Noesis Daily Brief',
    description:
      'Fetches the daily knowledge brief from a Noesis instance (noesis-kb-v1): per-domain ' +
      'changes with corroboration and contested claims, plus a New-publications section for ' +
      'research domains — as Markdown with every line cited. Domains is a comma-separated ' +
      'subset (empty = all); Since is an ISO-8601 UTC floor (empty = last 24h). The instance ' +
      'URL is backend config (NOESIS_BRIEF_URL). Unreachable Noesis yields status ' +
      '"unavailable" and empty content — the flow continues.',
    execIn: true,
    execOut: ['then'],
    inputs: [
      { id: 'domains', name: 'Domains', type: DataTypes.String },
      { id: 'since', name: 'Since', type: DataTypes.String },
    ],
    outputs: [
      { id: 'title', name: 'Title', type: DataTypes.String },
      { id: 'markdown', name: 'Markdown', type: DataTypes.String },
      { id: 'status', name: 'Status', type: DataTypes.String },
      { id: 'itemCount', name: 'Items', type: DataTypes.String },
    ],
    capability: 'network:noesis',
  },
];

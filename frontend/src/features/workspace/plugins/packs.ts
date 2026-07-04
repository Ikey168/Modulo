// Packs: curated bundles of plugins plus starter blueprints. Installing a pack
// installs each of its plugins (through the plugin runtime) and adds each of
// its blueprints (through the client-side blueprint store), so one click sets
// up a whole workflow.

import { ClipboardList, Library, Zap, type LucideIcon } from 'lucide-react';
import { IR_VERSION, type BlueprintIR } from '../../blueprint/blueprintIR';
import { DATABASE_PLUGIN_ID, GRAPH_PLUGIN_ID, NOTES_PLUGIN_ID, OUTLINE_PLUGIN_ID } from '../plugins';

export interface PackBlueprint {
  name: string;
  description: string;
  ir: BlueprintIR;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  /** Plugins installed when this pack is installed. */
  pluginIds: string[];
  /** Blueprints added when this pack is installed. */
  blueprints: PackBlueprint[];
}

// ── Blueprint builders ───────────────────────────────────────────────────────

const TS = '2024-01-01T00:00:00.000Z';
const node = (id: string, type: string, x: number, y: number) => ({ id, type, nodeVersion: 1, position: { x, y } });
const exec = (id: string, fromNode: string, toNode: string) =>
  ({ id, kind: 'exec' as const, fromNode, fromPin: 'then', toNode, toPin: 'in' });
const data = (id: string, fromNode: string, fromPin: string, toNode: string, toPin: string) =>
  ({ id, kind: 'data' as const, fromNode, fromPin, toNode, toPin });

function bp(name: string, description: string, nodes: BlueprintIR['nodes'], edges: BlueprintIR['edges']): PackBlueprint {
  return { name, description, ir: { irVersion: IR_VERSION, nodes, edges, metadata: { name, description, createdAt: TS, updatedAt: TS } } };
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export const PACKS: Pack[] = [
  {
    id: 'pack-knowledge-base',
    name: 'Knowledge Base',
    description: 'Notes, the knowledge graph, and document outlines, with a blueprint that summarizes every note you save.',
    icon: Library,
    category: 'productivity',
    pluginIds: [NOTES_PLUGIN_ID, GRAPH_PLUGIN_ID, OUTLINE_PLUGIN_ID],
    blueprints: [
      bp(
        'Summarize on save',
        'When a note is saved, generate an AI summary of it.',
        [node('n1', 'trigger.note.saved', 40, 40), node('n2', 'action.ai.summarize', 360, 40)],
        [exec('e1', 'n1', 'n2'), data('e2', 'n1', 'note', 'n2', 'note')],
      ),
    ],
  },
  {
    id: 'pack-project-tracker',
    name: 'Project Tracker',
    description: 'Notes plus embedded databases for tables and boards, with a blueprint that tags new notes automatically.',
    icon: ClipboardList,
    category: 'productivity',
    pluginIds: [NOTES_PLUGIN_ID, DATABASE_PLUGIN_ID],
    blueprints: [
      bp(
        'Tag new notes',
        'When a note is saved, add a tag to it.',
        [node('n1', 'trigger.note.saved', 40, 40), node('n2', 'action.tag.add', 360, 40)],
        [exec('e1', 'n1', 'n2'), data('e2', 'n1', 'note', 'n2', 'note')],
      ),
    ],
  },
  {
    id: 'pack-automation-starter',
    name: 'Automation Starter',
    description: 'Markdown notes plus two starter automations: a scheduled task and on-save on-chain anchoring.',
    icon: Zap,
    category: 'automation',
    pluginIds: [NOTES_PLUGIN_ID],
    blueprints: [
      bp(
        'Scheduled task',
        'Run a sandboxed script on a schedule.',
        [node('n1', 'trigger.schedule', 40, 40), node('n2', 'action.code.execute', 360, 40)],
        [exec('e1', 'n1', 'n2')],
      ),
      bp(
        'Anchor on save',
        'When a note is saved, anchor its content hash on-chain.',
        [node('n1', 'trigger.note.saved', 40, 40), node('n2', 'action.note.anchor', 360, 40)],
        [exec('e1', 'n1', 'n2'), data('e2', 'n1', 'note', 'n2', 'note')],
      ),
    ],
  },
];

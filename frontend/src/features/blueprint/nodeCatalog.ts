// The node catalog (#271): a registry of node descriptors. Plugins/packs
// contribute additional nodes into the same catalog (the property that makes
// the system extensible). Seeded here with the core node set.

import { DataTypes, NodeDescriptor, validateDescriptor } from './nodeModel';

/**
 * A registry of node descriptors, keyed by `type@version`, with latest-version
 * resolution per type.
 */
export class NodeCatalog {
  private readonly byKey = new Map<string, NodeDescriptor>();
  private readonly latest = new Map<string, number>();

  /** Register a descriptor. Throws if it is structurally invalid. */
  register(desc: NodeDescriptor): void {
    const check = validateDescriptor(desc);
    if (!check.ok) {
      throw new Error(`Invalid node descriptor '${desc.type}': ${check.reason}`);
    }
    this.byKey.set(key(desc.type, desc.version), desc);
    const currentLatest = this.latest.get(desc.type);
    if (currentLatest === undefined || desc.version > currentLatest) {
      this.latest.set(desc.type, desc.version);
    }
  }

  /** Get a descriptor by type. With no version, returns the latest registered. */
  get(type: string, version?: number): NodeDescriptor | undefined {
    const resolved = version ?? this.latest.get(type);
    if (resolved === undefined) return undefined;
    return this.byKey.get(key(type, resolved));
  }

  has(type: string, version?: number): boolean {
    return this.get(type, version) !== undefined;
  }

  /** All latest-version descriptors. */
  list(): NodeDescriptor[] {
    return [...this.latest.entries()].map(([type, version]) => this.byKey.get(key(type, version))!);
  }

  /** Latest descriptors in a category. */
  listByCategory(category: NodeDescriptor['category']): NodeDescriptor[] {
    return this.list().filter((d) => d.category === category);
  }
}

function key(type: string, version: number): string {
  return `${type}@${version}`;
}

// The catalog is split so the editor palette can be plugin-gated: CORE_NODES
// are generic workflow primitives that are always available, while feature
// nodes (e.g. NOTES_NODES) are contributed by a plugin and only appear in the
// editor while that plugin is installed. All descriptors are plain data, so
// they double as a JSON spec the backend can read.

/** Generic workflow primitives — always available, independent of any plugin. */
export const CORE_NODES: NodeDescriptor[] = [
  {
    type: 'trigger.schedule',
    version: 1,
    category: 'trigger',
    title: 'On Schedule',
    description: 'Fires on a schedule. The cron expression is node config (see the IR), not a pin.',
    execIn: false,
    execOut: ['then'],
    inputs: [],
    outputs: [{ id: 'firedAt', name: 'Fired At', type: DataTypes.String }],
  },
  {
    type: 'action.code.execute',
    version: 1,
    category: 'action',
    title: 'Custom Code',
    description:
      'Runs a sandboxed JavaScript function with the note as input. ' +
      'Write a function expression in the node body: function(note) { return note.title; }. ' +
      'No Java, filesystem, or network access. CPU time and instruction count are bounded.',
    execIn: true,
    execOut: ['then'],
    inputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    outputs: [{ id: 'output', name: 'Output', type: DataTypes.String }],
    capability: 'code:execute',
  },
  {
    type: 'logic.branch',
    version: 1,
    category: 'logic',
    title: 'Branch',
    description: 'Routes execution down the true or false path based on a condition.',
    execIn: true,
    execOut: ['true', 'false'],
    inputs: [{ id: 'condition', name: 'Condition', type: DataTypes.Boolean }],
    outputs: [],
  },
];

/**
 * Note-related nodes contributed by the Markdown Notes plugin. Installing that
 * plugin adds these to the editor palette; uninstalling removes them.
 */
export const NOTES_NODES: NodeDescriptor[] = [
  // ----- Triggers -----
  {
    type: 'trigger.note.saved',
    version: 1,
    category: 'trigger',
    title: 'On Note Saved',
    description: 'Fires when a note is created or updated.',
    execIn: false,
    execOut: ['then'],
    inputs: [],
    outputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
  },
  {
    type: 'trigger.link.created',
    version: 1,
    category: 'trigger',
    title: 'On Link Created',
    description: 'Fires when a [[link]] between two notes is created.',
    execIn: false,
    execOut: ['then'],
    inputs: [],
    outputs: [
      { id: 'link', name: 'Link', type: DataTypes.Link },
      { id: 'source', name: 'Source Note', type: DataTypes.Note },
      { id: 'target', name: 'Target Note', type: DataTypes.Note },
    ],
  },

  // ----- Actions -----
  {
    type: 'action.note.create',
    version: 1,
    category: 'action',
    title: 'Create Note',
    description: 'Creates a new note.',
    execIn: true,
    execOut: ['then'],
    inputs: [
      { id: 'title', name: 'Title', type: DataTypes.String },
      { id: 'content', name: 'Content', type: DataTypes.String },
    ],
    outputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    capability: 'notes:write',
  },
  {
    type: 'action.tag.add',
    version: 1,
    category: 'action',
    title: 'Add Tag',
    description: 'Adds a tag to a note.',
    execIn: true,
    execOut: ['then'],
    inputs: [
      { id: 'note', name: 'Note', type: DataTypes.Note },
      { id: 'tag', name: 'Tag', type: DataTypes.String },
    ],
    outputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    capability: 'notes:write',
  },
  {
    type: 'action.note.anchor',
    version: 1,
    category: 'action',
    title: 'Anchor On-Chain',
    description: "Anchors the note's content hash on-chain for verifiable authorship.",
    execIn: true,
    execOut: ['then'],
    inputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    outputs: [{ id: 'txHash', name: 'Tx Hash', type: DataTypes.String }],
    capability: 'blockchain:anchor',
  },
  {
    type: 'action.ai.summarize',
    version: 1,
    category: 'action',
    title: 'Summarize (AI)',
    description: 'Generates an AI summary of a note.',
    execIn: true,
    execOut: ['then'],
    inputs: [{ id: 'note', name: 'Note', type: DataTypes.Note }],
    outputs: [{ id: 'summary', name: 'Summary', type: DataTypes.String }],
    capability: 'ai:invoke',
  },

  // ----- Logic -----
  {
    type: 'logic.notes.filter',
    version: 1,
    category: 'logic',
    title: 'Filter Notes by Tag',
    description: 'Filters a list of notes to those carrying the given tag.',
    execIn: true,
    execOut: ['then'],
    inputs: [
      { id: 'notes', name: 'Notes', type: DataTypes.NoteList },
      { id: 'tag', name: 'Tag', type: DataTypes.String },
    ],
    outputs: [{ id: 'result', name: 'Result', type: DataTypes.NoteList }],
  },
];

/** A fresh catalog seeded with {@link CORE_NODES}. Plugin nodes register on top. */
export function createCoreCatalog(): NodeCatalog {
  const catalog = new NodeCatalog();
  for (const node of CORE_NODES) catalog.register(node);
  return catalog;
}

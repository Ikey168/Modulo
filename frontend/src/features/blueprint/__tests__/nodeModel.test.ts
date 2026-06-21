import { describe, it, expect } from 'vitest';
import {
  ConnectionEndpoint,
  DataTypes,
  NodeDescriptor,
  isAssignable,
  validateConnection,
  validateDescriptor,
} from '../nodeModel';
import { CORE_NODES, NodeCatalog, createCoreCatalog } from '../nodeCatalog';

const exec = (node: NodeDescriptor, pin: string): ConnectionEndpoint => ({ node, kind: 'exec', pin });
const data = (node: NodeDescriptor, pin: string): ConnectionEndpoint => ({ node, kind: 'data', pin });

describe('isAssignable', () => {
  it('accepts identical types', () => {
    expect(isAssignable(DataTypes.Note, DataTypes.Note)).toBe(true);
  });
  it('rejects mismatched types', () => {
    expect(isAssignable(DataTypes.Note, DataTypes.String)).toBe(false);
  });
  it('treats "any" as compatible in both directions', () => {
    expect(isAssignable(DataTypes.Any, DataTypes.Note)).toBe(true);
    expect(isAssignable(DataTypes.Note, DataTypes.Any)).toBe(true);
  });
});

describe('validateConnection (exec)', () => {
  const catalog = createCoreCatalog();
  const trigger = catalog.get('trigger.note.saved')!;
  const addTag = catalog.get('action.tag.add')!;
  const branch = catalog.get('logic.branch')!;

  it('allows exec-out -> exec-in', () => {
    expect(validateConnection(exec(trigger, 'then'), exec(addTag, 'then'))).toEqual({ ok: true });
  });

  it('rejects connecting into a trigger (no exec input)', () => {
    const res = validateConnection(exec(addTag, 'then'), exec(trigger, 'then'));
    expect(res.ok).toBe(false);
  });

  it('rejects an unknown exec-out name', () => {
    const res = validateConnection(exec(trigger, 'nope'), exec(addTag, 'then'));
    expect(res.ok).toBe(false);
  });

  it('supports multiple named exec outputs (branch true/false)', () => {
    expect(validateConnection(exec(branch, 'true'), exec(addTag, 'then')).ok).toBe(true);
    expect(validateConnection(exec(branch, 'false'), exec(addTag, 'then')).ok).toBe(true);
  });

  it('rejects mixing an exec pin with a data pin', () => {
    const res = validateConnection(exec(trigger, 'then'), data(addTag, 'note'));
    expect(res.ok).toBe(false);
  });
});

describe('validateConnection (data)', () => {
  const catalog = createCoreCatalog();
  const trigger = catalog.get('trigger.note.saved')!; // outputs: note
  const addTag = catalog.get('action.tag.add')!; // inputs: note, tag
  const summarize = catalog.get('action.ai.summarize')!; // outputs: summary (string)

  it('allows note(out) -> note(in)', () => {
    expect(validateConnection(data(trigger, 'note'), data(addTag, 'note'))).toEqual({ ok: true });
  });

  it('allows string(out) -> string(in) (summary -> tag)', () => {
    expect(validateConnection(data(summarize, 'summary'), data(addTag, 'tag')).ok).toBe(true);
  });

  it('rejects note(out) -> tag(string in)', () => {
    const res = validateConnection(data(trigger, 'note'), data(addTag, 'tag'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not assignable/);
  });

  it('rejects an unknown pin id', () => {
    expect(validateConnection(data(trigger, 'ghost'), data(addTag, 'note')).ok).toBe(false);
    expect(validateConnection(data(trigger, 'note'), data(addTag, 'ghost')).ok).toBe(false);
  });
});

describe('validateDescriptor', () => {
  const base: NodeDescriptor = {
    type: 'x',
    version: 1,
    category: 'action',
    title: 'X',
    description: '',
    execIn: true,
    execOut: ['then'],
    inputs: [],
    outputs: [],
  };

  it('accepts a valid descriptor', () => {
    expect(validateDescriptor(base).ok).toBe(true);
  });
  it('rejects version < 1', () => {
    expect(validateDescriptor({ ...base, version: 0 }).ok).toBe(false);
  });
  it('rejects duplicate input pin ids', () => {
    const res = validateDescriptor({
      ...base,
      inputs: [
        { id: 'a', name: 'A', type: DataTypes.String },
        { id: 'a', name: 'A2', type: DataTypes.String },
      ],
    });
    expect(res.ok).toBe(false);
  });
  it('rejects a trigger with an exec input', () => {
    expect(validateDescriptor({ ...base, category: 'trigger', execIn: true }).ok).toBe(false);
  });
});

describe('NodeCatalog', () => {
  it('seeds all core nodes and they are individually valid', () => {
    const catalog = createCoreCatalog();
    expect(catalog.list().length).toBe(CORE_NODES.length);
    for (const node of CORE_NODES) {
      expect(validateDescriptor(node).ok).toBe(true);
      expect(catalog.has(node.type)).toBe(true);
    }
  });

  it('has all core node type ids unique', () => {
    const ids = CORE_NODES.map((n) => n.type);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists by category', () => {
    const catalog = createCoreCatalog();
    expect(catalog.listByCategory('trigger').length).toBe(3);
    expect(catalog.listByCategory('action').length).toBe(4);
    expect(catalog.listByCategory('logic').length).toBe(2);
  });

  it('resolves the latest version by default and exact version on request', () => {
    const catalog = new NodeCatalog();
    const v1: NodeDescriptor = {
      type: 'demo',
      version: 1,
      category: 'action',
      title: 'Demo v1',
      description: '',
      execIn: true,
      execOut: ['then'],
      inputs: [],
      outputs: [],
    };
    const v2: NodeDescriptor = { ...v1, version: 2, title: 'Demo v2' };
    catalog.register(v1);
    catalog.register(v2);
    expect(catalog.get('demo')!.version).toBe(2); // latest
    expect(catalog.get('demo', 1)!.title).toBe('Demo v1'); // pinned
  });

  it('rejects registering an invalid descriptor', () => {
    const catalog = new NodeCatalog();
    expect(() =>
      catalog.register({
        type: 'bad',
        version: 1,
        category: 'trigger',
        title: 'Bad',
        description: '',
        execIn: true, // trigger with exec input -> invalid
        execOut: ['then'],
        inputs: [],
        outputs: [],
      }),
    ).toThrow();
  });

  it('returns undefined for unknown types', () => {
    expect(createCoreCatalog().get('nope')).toBeUndefined();
  });
});

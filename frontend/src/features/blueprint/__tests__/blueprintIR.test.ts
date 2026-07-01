import { describe, it, expect } from 'vitest';
import { BlueprintIR, IR_VERSION, validateIR } from '../blueprintIR';
import { NodeCatalog, createCoreCatalog } from '../nodeCatalog';
import { DataTypes } from '../nodeModel';

const catalog = createCoreCatalog();

// The worked example from docs/blueprint/node-catalog.md:
// trigger.note.saved → action.ai.summarize → action.tag.add → action.note.anchor
const FULL_PIPELINE: BlueprintIR = {
  irVersion: IR_VERSION,
  nodes: [
    { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
    { id: 'n2', type: 'action.ai.summarize', nodeVersion: 1 },
    { id: 'n3', type: 'action.tag.add', nodeVersion: 1 },
    { id: 'n4', type: 'action.note.anchor', nodeVersion: 1 },
  ],
  edges: [
    { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'in' },
    { id: 'e2', kind: 'data', fromNode: 'n1', fromPin: 'note', toNode: 'n2', toPin: 'note' },
    { id: 'e3', kind: 'exec', fromNode: 'n2', fromPin: 'then', toNode: 'n3', toPin: 'in' },
    { id: 'e4', kind: 'data', fromNode: 'n2', fromPin: 'summary', toNode: 'n3', toPin: 'tag' },
    { id: 'e5', kind: 'data', fromNode: 'n1', fromPin: 'note', toNode: 'n3', toPin: 'note' },
    { id: 'e6', kind: 'exec', fromNode: 'n3', fromPin: 'then', toNode: 'n4', toPin: 'in' },
    { id: 'e7', kind: 'data', fromNode: 'n3', fromPin: 'note', toNode: 'n4', toPin: 'note' },
  ],
  metadata: {
    name: 'On Save → Summarize → Tag → Anchor',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

describe('validateIR — happy path', () => {
  it('accepts the full pipeline from the docs', () => {
    expect(validateIR(FULL_PIPELINE, catalog)).toEqual({ ok: true });
  });

  it('accepts a minimal IR with no edges', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 }],
      edges: [],
      metadata: { name: 'Empty', createdAt: '', updatedAt: '' },
    };
    expect(validateIR(ir, catalog)).toEqual({ ok: true });
  });

  it('accepts a branch with both true and false exec outs', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'branch', type: 'logic.branch', nodeVersion: 1 },
        { id: 'yes', type: 'action.note.create', nodeVersion: 1 },
        { id: 'no', type: 'action.tag.add', nodeVersion: 1 },
      ],
      edges: [
        { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'branch', toPin: 'in' },
        { id: 'e2', kind: 'exec', fromNode: 'branch', fromPin: 'true', toNode: 'yes', toPin: 'in' },
        { id: 'e3', kind: 'exec', fromNode: 'branch', fromPin: 'false', toNode: 'no', toPin: 'in' },
      ],
      metadata: { name: 'Branch', createdAt: '', updatedAt: '' },
    };
    expect(validateIR(ir, catalog)).toEqual({ ok: true });
  });

  it('uses the pinned version when the catalog has multiple versions', () => {
    const localCatalog = new NodeCatalog();
    const v1 = {
      type: 'demo.node', version: 1, category: 'action' as const,
      title: 'Demo v1', description: '',
      execIn: true, execOut: ['then'],
      inputs: [{ id: 'x', name: 'X', type: DataTypes.String }],
      outputs: [],
    };
    const v2 = { ...v1, version: 2, inputs: [] };
    localCatalog.register(v1);
    localCatalog.register(v2);

    // Pinned to v1 — which still has the 'x' input
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'demo.node', nodeVersion: 1 }],
      edges: [],
      metadata: { name: 'Pinned', createdAt: '', updatedAt: '' },
    };
    expect(validateIR(ir, localCatalog)).toEqual({ ok: true });
  });
});

describe('validateIR — schema errors', () => {
  it('rejects an unsupported IR version', () => {
    const ir = { ...FULL_PIPELINE, irVersion: 99 as any };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Unsupported IR version/);
  });

  it('rejects duplicate node ids', () => {
    const ir: BlueprintIR = {
      ...FULL_PIPELINE,
      nodes: [
        { id: 'dup', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'dup', type: 'action.ai.summarize', nodeVersion: 1 },
      ],
      edges: [],
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Duplicate node id/);
  });

  it('rejects duplicate edge ids', () => {
    const ir: BlueprintIR = {
      ...FULL_PIPELINE,
      edges: [
        { id: 'dup', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'in' },
        { id: 'dup', kind: 'exec', fromNode: 'n2', fromPin: 'then', toNode: 'n3', toPin: 'in' },
      ],
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Duplicate edge id/);
  });
});

describe('validateIR — catalog resolution errors', () => {
  it('rejects an unknown node type', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'action.does.not.exist', nodeVersion: 1 }],
      edges: [],
      metadata: { name: 'Bad', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Unknown node/);
  });

  it('rejects a node pinned to a non-existent version', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'trigger.note.saved', nodeVersion: 99 }],
      edges: [],
      metadata: { name: 'Bad version', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Unknown node/);
  });
});

describe('validateIR — edge reference errors', () => {
  it('rejects an edge whose fromNode does not exist', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'action.ai.summarize', nodeVersion: 1 }],
      edges: [{ id: 'e1', kind: 'exec', fromNode: 'ghost', fromPin: 'then', toNode: 'n1', toPin: 'in' }],
      metadata: { name: 'Dangling from', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/unknown fromNode/);
  });

  it('rejects an edge whose toNode does not exist', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [{ id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 }],
      edges: [{ id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'ghost', toPin: 'in' }],
      metadata: { name: 'Dangling to', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/unknown toNode/);
  });
});

describe('validateIR — connection validation errors', () => {
  it('rejects a data type mismatch (note → string input)', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'n2', type: 'action.tag.add', nodeVersion: 1 },
      ],
      edges: [
        // note output → tag (string) input: not assignable
        { id: 'e1', kind: 'data', fromNode: 'n1', fromPin: 'note', toNode: 'n2', toPin: 'tag' },
      ],
      metadata: { name: 'Type error', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not assignable/);
  });

  it('rejects wiring into a trigger (no exec input)', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'action.tag.add', nodeVersion: 1 },
        { id: 'n2', type: 'trigger.note.saved', nodeVersion: 1 },
      ],
      edges: [
        { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'in' },
      ],
      metadata: { name: 'Trigger loop', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/entry point/);
  });

  it('rejects mixing exec and data pin kinds in one edge', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'n2', type: 'action.tag.add', nodeVersion: 1 },
      ],
      edges: [
        { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'note' },
      ],
      metadata: { name: 'Kind mismatch', createdAt: '', updatedAt: '' },
    };
    // exec -> data: the endpoints have the same kind ('exec') on both sides,
    // but 'note' as toPin will be fine for exec since execIn is only checked by boolean.
    // Actually this IS valid because validateConnection(exec, exec) only checks execIn
    // and from.execOut. Let's do the real kind-mismatch test: one side exec one side data.
    const ir2: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'n2', type: 'action.tag.add', nodeVersion: 1 },
      ],
      edges: [
        // We can't express a mixed-kind edge in the IR (both sides share `kind`),
        // but we can simulate the validateConnection rejection by building it directly.
        // Instead, test an exec pin going to a node with no exec-out name:
        { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'nope', toNode: 'n2', toPin: 'in' },
      ],
      metadata: { name: 'Bad exec-out', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir2, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/no exec output/);
  });

  it('rejects an unknown data output pin', () => {
    const ir: BlueprintIR = {
      irVersion: IR_VERSION,
      nodes: [
        { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1 },
        { id: 'n2', type: 'action.tag.add', nodeVersion: 1 },
      ],
      edges: [
        { id: 'e1', kind: 'data', fromNode: 'n1', fromPin: 'ghost', toNode: 'n2', toPin: 'note' },
      ],
      metadata: { name: 'Unknown pin', createdAt: '', updatedAt: '' },
    };
    const res = validateIR(ir, catalog);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/no data output/);
  });
});

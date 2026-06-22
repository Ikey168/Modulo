import { describe, it, expect } from 'vitest';
import type { Connection } from 'reactflow';
import { BlueprintIR, IR_VERSION } from '../../blueprintIR';
import { createCoreCatalog } from '../../nodeCatalog';
import { NodeDescriptor } from '../../nodeModel';
import {
  EXEC_IN_HANDLE,
  checkFlowConnection,
  dataInHandle,
  dataOutHandle,
  execOutHandle,
  flowToIR,
  irToFlow,
  parseHandle,
} from '../reactFlowAdapter';

const catalog = createCoreCatalog();

const IR: BlueprintIR = {
  irVersion: IR_VERSION,
  nodes: [
    { id: 'n1', type: 'trigger.note.saved', nodeVersion: 1, position: { x: 0, y: 0 } },
    { id: 'n2', type: 'action.ai.summarize', nodeVersion: 1, position: { x: 300, y: 0 } },
    { id: 'n3', type: 'action.tag.add', nodeVersion: 1, position: { x: 600, y: 0 } },
  ],
  edges: [
    { id: 'e1', kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'in' },
    { id: 'e2', kind: 'data', fromNode: 'n1', fromPin: 'note', toNode: 'n2', toPin: 'note' },
    { id: 'e3', kind: 'exec', fromNode: 'n2', fromPin: 'then', toNode: 'n3', toPin: 'in' },
    { id: 'e4', kind: 'data', fromNode: 'n2', fromPin: 'summary', toNode: 'n3', toPin: 'tag' },
  ],
  metadata: { name: 'Test', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
};

describe('parseHandle', () => {
  it('decodes the exec input handle', () => {
    expect(parseHandle(EXEC_IN_HANDLE)).toEqual({ kind: 'exec', role: 'in', pin: 'in' });
  });

  it('decodes encoded handles round-trip', () => {
    expect(parseHandle(execOutHandle('then'))).toEqual({ kind: 'exec', role: 'out', pin: 'then' });
    expect(parseHandle(dataInHandle('note'))).toEqual({ kind: 'data', role: 'in', pin: 'note' });
    expect(parseHandle(dataOutHandle('summary'))).toEqual({ kind: 'data', role: 'out', pin: 'summary' });
  });

  it('returns null for unknown handles', () => {
    expect(parseHandle(null)).toBeNull();
    expect(parseHandle('nonsense')).toBeNull();
    expect(parseHandle('weird:thing')).toBeNull();
  });
});

describe('irToFlow / flowToIR', () => {
  it('produces a React Flow node per IR node with the right handle ids on edges', () => {
    const flow = irToFlow(IR, catalog);
    expect(flow.nodes).toHaveLength(3);
    expect(flow.nodes[0]).toMatchObject({ id: 'n1', type: 'blueprintNode' });
    expect(flow.nodes[0].data.descriptor.type).toBe('trigger.note.saved');

    const execEdge = flow.edges.find((e) => e.id === 'e1')!;
    expect(execEdge.sourceHandle).toBe(execOutHandle('then'));
    expect(execEdge.targetHandle).toBe(EXEC_IN_HANDLE);

    const dataEdge = flow.edges.find((e) => e.id === 'e4')!;
    expect(dataEdge.sourceHandle).toBe(dataOutHandle('summary'));
    expect(dataEdge.targetHandle).toBe(dataInHandle('tag'));
  });

  it('round-trips IR -> flow -> IR preserving graph structure', () => {
    const flow = irToFlow(IR, catalog);
    const back = flowToIR(flow.nodes, flow.edges, IR.metadata);

    expect(back.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3']);
    expect(back.nodes.find((n) => n.id === 'n2')!.type).toBe('action.ai.summarize');

    const e4 = back.edges.find((e) => e.id === 'e4')!;
    expect(e4).toMatchObject({ kind: 'data', fromNode: 'n2', fromPin: 'summary', toNode: 'n3', toPin: 'tag' });

    const e1 = back.edges.find((e) => e.id === 'e1')!;
    expect(e1).toMatchObject({ kind: 'exec', fromNode: 'n1', fromPin: 'then', toNode: 'n2', toPin: 'in' });
  });

  it('renders unknown node types with a placeholder descriptor', () => {
    const ir: BlueprintIR = {
      ...IR,
      nodes: [{ id: 'x', type: 'does.not.exist', nodeVersion: 9 }],
      edges: [],
    };
    const flow = irToFlow(ir, catalog);
    expect(flow.nodes[0].data.descriptor.title).toContain('unknown');
  });
});

describe('checkFlowConnection', () => {
  const getDesc = (id: string): NodeDescriptor | undefined => {
    const map: Record<string, string> = {
      n1: 'trigger.note.saved',
      n2: 'action.ai.summarize',
      n3: 'action.tag.add',
      branch: 'logic.branch',
    };
    return catalog.get(map[id]);
  };

  const conn = (over: Partial<Connection>): Connection => ({
    source: 'n1',
    target: 'n2',
    sourceHandle: execOutHandle('then'),
    targetHandle: EXEC_IN_HANDLE,
    ...over,
  });

  it('accepts a valid exec connection', () => {
    expect(checkFlowConnection(conn({}), getDesc).ok).toBe(true);
  });

  it('accepts a matching data connection (note -> note)', () => {
    const c = conn({
      source: 'n1',
      target: 'n2',
      sourceHandle: dataOutHandle('note'),
      targetHandle: dataInHandle('note'),
    });
    expect(checkFlowConnection(c, getDesc).ok).toBe(true);
  });

  it('rejects a type-incompatible data connection (note -> boolean)', () => {
    const c = conn({
      source: 'n1',
      target: 'branch',
      sourceHandle: dataOutHandle('note'),
      targetHandle: dataInHandle('condition'),
    });
    const res = checkFlowConnection(c, getDesc);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('not assignable');
  });

  it('rejects mixing exec and data pins', () => {
    const c = conn({ sourceHandle: execOutHandle('then'), targetHandle: dataInHandle('note') });
    expect(checkFlowConnection(c, getDesc).ok).toBe(false);
  });

  it('rejects output-to-output and input-to-input', () => {
    const c = conn({ sourceHandle: EXEC_IN_HANDLE, targetHandle: execOutHandle('then') });
    expect(checkFlowConnection(c, getDesc).ok).toBe(false);
  });

  it('rejects connecting a node to itself', () => {
    expect(checkFlowConnection(conn({ target: 'n1' }), getDesc).ok).toBe(false);
  });

  it('rejects connecting into a trigger exec input (entry point)', () => {
    const c = conn({ source: 'n2', target: 'n1', sourceHandle: execOutHandle('then'), targetHandle: EXEC_IN_HANDLE });
    expect(checkFlowConnection(c, getDesc).ok).toBe(false);
  });
});

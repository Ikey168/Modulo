// Bridge between the blueprint graph IR (#272) and React Flow's node/edge model
// (#274). React Flow needs handle ids on every pin; we encode the pin's kind,
// direction, and name into the handle id so onConnect can reconstruct a
// ConnectionEndpoint and reuse validateConnection from the shared node model.

import type { Connection, Edge as RFEdge, Node as RFNode } from 'reactflow';
import {
  BlueprintEdge,
  BlueprintIR,
  BlueprintMetadata,
  BlueprintNode,
  IR_VERSION,
} from '../blueprintIR';
import { NodeCatalog } from '../nodeCatalog';
import {
  ConnectionCheck,
  ConnectionEndpoint,
  NodeDescriptor,
  validateConnection,
} from '../nodeModel';

/** Data carried on every React Flow node so the custom renderer can draw pins. */
export interface BlueprintNodeData {
  descriptor: NodeDescriptor;
  nodeVersion: number;
  config?: Record<string, unknown>;
}

export type FlowNode = RFNode<BlueprintNodeData>;
export type FlowEdge = RFEdge;

// --- Handle id encoding -----------------------------------------------------
// exec input:  'e-in'
// exec output: 'e-out:<execOutName>'
// data input:  'd-in:<pinId>'
// data output: 'd-out:<pinId>'

export const EXEC_IN_HANDLE = 'e-in';
export const execOutHandle = (name: string) => `e-out:${name}`;
export const dataInHandle = (pinId: string) => `d-in:${pinId}`;
export const dataOutHandle = (pinId: string) => `d-out:${pinId}`;

export interface ParsedHandle {
  kind: 'exec' | 'data';
  role: 'in' | 'out';
  pin: string;
}

/** Decode a handle id back into its kind/direction/pin. Returns null if unrecognised. */
export function parseHandle(handleId: string | null | undefined): ParsedHandle | null {
  if (!handleId) return null;
  if (handleId === EXEC_IN_HANDLE) return { kind: 'exec', role: 'in', pin: 'in' };
  const colon = handleId.indexOf(':');
  if (colon < 0) return null;
  const prefix = handleId.slice(0, colon);
  const pin = handleId.slice(colon + 1);
  switch (prefix) {
    case 'e-out':
      return { kind: 'exec', role: 'out', pin };
    case 'd-in':
      return { kind: 'data', role: 'in', pin };
    case 'd-out':
      return { kind: 'data', role: 'out', pin };
    default:
      return null;
  }
}

// --- IR -> React Flow -------------------------------------------------------

export function irToFlow(
  ir: BlueprintIR,
  catalog: NodeCatalog,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = ir.nodes.map((n, i) => {
    const descriptor = catalog.get(n.type, n.nodeVersion);
    return {
      id: n.id,
      type: 'blueprintNode',
      position: n.position ?? { x: 80 + (i % 4) * 240, y: 80 + Math.floor(i / 4) * 200 },
      data: {
        // A missing descriptor means the catalog no longer has this node; we
        // surface a placeholder so the graph still renders rather than crashing.
        descriptor: descriptor ?? placeholderDescriptor(n),
        nodeVersion: n.nodeVersion,
        config: n.config,
      },
    };
  });

  const edges: FlowEdge[] = ir.edges.map((e) => flowEdgeFromIR(e));
  return { nodes, edges };
}

function flowEdgeFromIR(e: BlueprintEdge): FlowEdge {
  const isExec = e.kind === 'exec';
  return {
    id: e.id,
    source: e.fromNode,
    target: e.toNode,
    sourceHandle: isExec ? execOutHandle(e.fromPin) : dataOutHandle(e.fromPin),
    targetHandle: isExec ? EXEC_IN_HANDLE : dataInHandle(e.toPin),
    type: isExec ? 'smoothstep' : 'default',
    data: { kind: e.kind },
    className: isExec ? 'bp-edge-exec' : 'bp-edge-data',
  };
}

function placeholderDescriptor(n: BlueprintNode): NodeDescriptor {
  return {
    type: n.type,
    version: n.nodeVersion,
    category: 'action',
    title: `${n.type} (unknown)`,
    description: 'This node type is not in the catalog.',
    execIn: true,
    execOut: ['then'],
    inputs: [],
    outputs: [],
  };
}

// --- React Flow -> IR -------------------------------------------------------

export function flowToIR(
  nodes: FlowNode[],
  edges: FlowEdge[],
  metadata: BlueprintMetadata,
): BlueprintIR {
  return {
    irVersion: IR_VERSION,
    nodes: nodes.map((n) => {
      const node: BlueprintNode = {
        id: n.id,
        type: n.data.descriptor.type,
        nodeVersion: n.data.nodeVersion,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      };
      if (n.data.config && Object.keys(n.data.config).length > 0) {
        node.config = n.data.config;
      }
      return node;
    }),
    edges: edges.map((e) => irEdgeFromFlow(e)),
    metadata,
  };
}

function irEdgeFromFlow(e: FlowEdge): BlueprintEdge {
  const from = parseHandle(e.sourceHandle);
  const to = parseHandle(e.targetHandle);
  const kind: 'exec' | 'data' = from?.kind ?? to?.kind ?? 'data';
  return {
    id: e.id,
    kind,
    fromNode: e.source,
    fromPin: from?.pin ?? '',
    toNode: e.target,
    toPin: to?.pin ?? (kind === 'exec' ? 'in' : ''),
  };
}

// --- Connection validation --------------------------------------------------

/**
 * Validate a prospective React Flow connection against the typed node model.
 * `getDescriptor` resolves a node id to its descriptor (from current canvas state).
 */
export function checkFlowConnection(
  connection: Connection,
  getDescriptor: (nodeId: string) => NodeDescriptor | undefined,
): ConnectionCheck {
  const from = parseHandle(connection.sourceHandle);
  const to = parseHandle(connection.targetHandle);
  if (!from || !to) return { ok: false, reason: 'Unknown pin' };
  if (from.role !== 'out' || to.role !== 'in') {
    return { ok: false, reason: 'Connect an output pin to an input pin' };
  }
  if (!connection.source || !connection.target) {
    return { ok: false, reason: 'Incomplete connection' };
  }
  if (connection.source === connection.target) {
    return { ok: false, reason: 'A node cannot connect to itself' };
  }
  const fromDesc = getDescriptor(connection.source);
  const toDesc = getDescriptor(connection.target);
  if (!fromDesc || !toDesc) return { ok: false, reason: 'Unknown node' };

  const fromEndpoint: ConnectionEndpoint = { node: fromDesc, kind: from.kind, pin: from.pin };
  const toEndpoint: ConnectionEndpoint = { node: toDesc, kind: to.kind, pin: to.pin };
  return validateConnection(fromEndpoint, toEndpoint);
}

/** Unique-ish id generator for new nodes/edges created in the editor. */
export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

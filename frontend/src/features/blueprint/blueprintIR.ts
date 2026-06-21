// Blueprint graph IR (#272) — the versioned JSON intermediate representation
// that the editor serializes and the interpreter deserializes. Blueprints are
// stored in plugin_registry (runtime = 'BLUEPRINT') so they participate in the
// same catalog, history, and permission infrastructure as other plugins.

import { NodeDescriptor } from './nodeModel';
import { validateConnection, ConnectionEndpoint } from './nodeModel';
import { NodeCatalog } from './nodeCatalog';

export const IR_VERSION = 1 as const;

/** A blueprint node instance inside a graph. References a NodeDescriptor by type + pinned version. */
export interface BlueprintNode {
  id: string;
  type: string;
  nodeVersion: number;
  /** Editor layout hint; ignored by the interpreter. */
  position?: { x: number; y: number };
  /** Node-specific config (e.g. cron expression for trigger.schedule). Not a data pin. */
  config?: Record<string, unknown>;
}

/**
 * A directed edge in the blueprint graph.
 *
 * For exec edges `toPin` is always `'in'` by convention; the interpreter only
 * checks `to.node.execIn` (a boolean), not the pin name.
 */
export interface BlueprintEdge {
  id: string;
  kind: 'exec' | 'data';
  fromNode: string;
  fromPin: string;
  toNode: string;
  toPin: string;
}

export interface BlueprintMetadata {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** The root of the graph IR. Serialize this to store a blueprint. */
export interface BlueprintIR {
  irVersion: typeof IR_VERSION;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  metadata: BlueprintMetadata;
}

export type IRCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validate a BlueprintIR against a NodeCatalog.
 *
 * Checks:
 * 1. IR schema version is known.
 * 2. No duplicate node ids.
 * 3. All node types resolve in the catalog at the pinned version.
 * 4. No duplicate edge ids.
 * 5. All edge endpoints reference existing node ids.
 * 6. Every edge passes validateConnection (type safety + exec rules).
 */
export function validateIR(ir: BlueprintIR, catalog: NodeCatalog): IRCheck {
  if (ir.irVersion !== IR_VERSION) {
    return { ok: false, reason: `Unsupported IR version: ${ir.irVersion}` };
  }

  const dupNodeId = firstDuplicate(ir.nodes.map((n) => n.id));
  if (dupNodeId) return { ok: false, reason: `Duplicate node id '${dupNodeId}'` };

  const resolved = new Map<string, NodeDescriptor>();
  for (const node of ir.nodes) {
    const desc = catalog.get(node.type, node.nodeVersion);
    if (!desc) {
      return { ok: false, reason: `Unknown node '${node.type}@${node.nodeVersion}'` };
    }
    resolved.set(node.id, desc);
  }

  const dupEdgeId = firstDuplicate(ir.edges.map((e) => e.id));
  if (dupEdgeId) return { ok: false, reason: `Duplicate edge id '${dupEdgeId}'` };

  for (const edge of ir.edges) {
    const fromDesc = resolved.get(edge.fromNode);
    const toDesc = resolved.get(edge.toNode);
    if (!fromDesc) return { ok: false, reason: `Edge '${edge.id}': unknown fromNode '${edge.fromNode}'` };
    if (!toDesc) return { ok: false, reason: `Edge '${edge.id}': unknown toNode '${edge.toNode}'` };

    const from: ConnectionEndpoint = { node: fromDesc, kind: edge.kind, pin: edge.fromPin };
    const to: ConnectionEndpoint = { node: toDesc, kind: edge.kind, pin: edge.toPin };
    const check = validateConnection(from, to);
    if (!check.ok) return { ok: false, reason: `Edge '${edge.id}': ${check.reason}` };
  }

  return { ok: true };
}

function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return undefined;
}

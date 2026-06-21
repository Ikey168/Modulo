// Blueprint node model (#271) — the UE5-style typed node system that the
// editor (#274) composes, the IR (#272) serializes, and the interpreter (#273)
// executes.
//
// A node has:
//  - execution pins ("exec"): the white flow pins. A node may have one exec
//    INPUT (entry) and zero-or-more named exec OUTPUTS (e.g. 'then', or
//    'true'/'false' for a branch). Triggers have no exec input (they are entry
//    points); they fire an exec output.
//  - data pins: typed value inputs/outputs (e.g. a `note`, a `string`).
//
// Descriptors are plain data (JSON-serializable) so the backend interpreter can
// consume the same catalog. Connection legality is decided by the rules below.

/** Built-in data-pin types. `type` is an open string so plugins can add more. */
export const DataTypes = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Note: 'note',
  NoteList: 'noteList',
  Tag: 'tag',
  Link: 'link',
  User: 'user',
  /** Accepts/provides any type (escape hatch, like a wildcard). */
  Any: 'any',
} as const;

/** A data-pin type id. Built-ins live in {@link DataTypes}; plugins may add others. */
export type DataType = string;

export type NodeCategory = 'trigger' | 'action' | 'logic';

export interface DataPin {
  /** Stable id, unique within the node's inputs (or outputs). */
  id: string;
  /** Human label for the editor. */
  name: string;
  type: DataType;
  description?: string;
}

export interface NodeDescriptor {
  /** Unique node type id, e.g. 'action.note.create'. */
  type: string;
  /** Signature version. Bump when pins change (breaking-change safe). */
  version: number;
  category: NodeCategory;
  title: string;
  description: string;
  /** Whether the node has an exec INPUT pin. Triggers are entry points (false). */
  execIn: boolean;
  /** Named exec OUTPUT pins, in display order (e.g. ['then'] or ['true','false']). */
  execOut: string[];
  inputs: DataPin[];
  outputs: DataPin[];
  /** Capability required to run this node (enforced by #275). */
  capability?: string;
}

// ---------------------------------------------------------------------------
// Type system
// ---------------------------------------------------------------------------

/**
 * Is a value of `sourceType` acceptable where `targetType` is expected?
 * `any` is compatible in both directions; otherwise types must match.
 */
export function isAssignable(sourceType: DataType, targetType: DataType): boolean {
  return sourceType === DataTypes.Any || targetType === DataTypes.Any || sourceType === targetType;
}

// ---------------------------------------------------------------------------
// Connection rules
// ---------------------------------------------------------------------------

export interface ConnectionEndpoint {
  node: NodeDescriptor;
  kind: 'exec' | 'data';
  /** For exec: the source node's exec-out name. For data: the pin id. */
  pin: string;
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Decide whether a connection from a source endpoint to a target endpoint is
 * legal. Direction is source -> target: for exec, `from` is the upstream node's
 * exec-OUT and `to` is the downstream node's exec-IN; for data, `from` is an
 * OUTPUT pin and `to` is an INPUT pin.
 */
export function validateConnection(from: ConnectionEndpoint, to: ConnectionEndpoint): ConnectionCheck {
  if (from.kind !== to.kind) {
    return { ok: false, reason: 'Cannot connect an exec pin to a data pin' };
  }

  if (from.kind === 'exec') {
    if (!from.node.execOut.includes(from.pin)) {
      return { ok: false, reason: `'${from.node.type}' has no exec output '${from.pin}'` };
    }
    if (!to.node.execIn) {
      return { ok: false, reason: `'${to.node.type}' has no exec input (it is an entry point)` };
    }
    return { ok: true };
  }

  const output = from.node.outputs.find((p) => p.id === from.pin);
  const input = to.node.inputs.find((p) => p.id === to.pin);
  if (!output) {
    return { ok: false, reason: `'${from.node.type}' has no data output '${from.pin}'` };
  }
  if (!input) {
    return { ok: false, reason: `'${to.node.type}' has no data input '${to.pin}'` };
  }
  if (!isAssignable(output.type, input.type)) {
    return {
      ok: false,
      reason: `type '${output.type}' is not assignable to '${input.type}'`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Descriptor validation
// ---------------------------------------------------------------------------

/** Structural validation for a descriptor (called on registration). */
export function validateDescriptor(desc: NodeDescriptor): ConnectionCheck {
  if (!desc.type) return { ok: false, reason: 'descriptor.type is required' };
  if (!Number.isInteger(desc.version) || desc.version < 1) {
    return { ok: false, reason: `descriptor.version must be an integer >= 1 (got ${desc.version})` };
  }
  const dupExec = firstDuplicate(desc.execOut);
  if (dupExec) return { ok: false, reason: `duplicate exec output '${dupExec}'` };
  const dupIn = firstDuplicate(desc.inputs.map((p) => p.id));
  if (dupIn) return { ok: false, reason: `duplicate input pin '${dupIn}'` };
  const dupOut = firstDuplicate(desc.outputs.map((p) => p.id));
  if (dupOut) return { ok: false, reason: `duplicate output pin '${dupOut}'` };
  // Triggers are entry points: they must not consume an exec input.
  if (desc.category === 'trigger' && desc.execIn) {
    return { ok: false, reason: 'trigger nodes must not have an exec input' };
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

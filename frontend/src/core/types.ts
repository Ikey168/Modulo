// Core domain types for ModuloCoreAPI (#294).
// These are the only types that cross the core/pack boundary — they carry no
// React, editor, or graph-view imports. All read/write operations in
// ModuloCoreAPI are expressed in terms of these types.

/** A note as seen by a feature pack. */
export interface CoreNote {
  id: number;
  title: string;
  content: string;
  markdownContent?: string;
  tags: CoreTag[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/** A tag as seen by a feature pack. */
export interface CoreTag {
  id: string;
  name: string;
}

/** A directed link between two notes. */
export interface CoreLink {
  id: string;
  linkType: string;
  sourceNoteId: number;
  targetNoteId: number;
}

// ── Graph query types ─────────────────────────────────────────────────────────

/** A node in a graph query result (one per note). */
export interface GraphNodeData {
  id: string;
  noteId: number;
  title: string;
  tags: string[];
  connectionCount: number;
}

/** An edge in a graph query result (one per link). */
export interface GraphEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: string;
}

/** The return value of graph read/query methods on ModuloCoreAPI. */
export interface GraphQueryResult {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

// ── Capability types ──────────────────────────────────────────────────────────

/**
 * Capabilities that a pack or node can request.
 * Mirrors the backend NODE_CAPABILITY_MAP in BlueprintCapabilityService (#275).
 * Write operations in ModuloCoreAPI require the corresponding capability to be
 * declared by the pack.
 */
export type CoreCapability =
  | 'notes:write'        // createNote, updateNote, deleteNote, addTag, removeTag, createLink, removeLink
  | 'ai:invoke'          // AI summarisation
  | 'blockchain:anchor'  // on-chain anchoring
  | 'code:execute';      // custom JS sandbox (#279)

// ── Event types ───────────────────────────────────────────────────────────────

/** Events that a pack can subscribe to via ModuloCoreAPI.on(). */
export type CoreEventType =
  | 'note.saved'
  | 'note.deleted'
  | 'link.created'
  | 'link.removed'
  | 'tag.added'
  | 'tag.removed';

export type CoreEventListener<T = unknown> = (event: T) => void;

/** Call this to remove a subscription registered with ModuloCoreAPI.on(). */
export type Unsubscribe = () => void;

// ── Blueprint types ───────────────────────────────────────────────────────────

export interface BlueprintListItem {
  id: number;
  name: string;
  description?: string;
  version: string;
  updatedAt: string;
}

export interface BlueprintInvokeOptions {
  /** Name of the blueprint to run. */
  name: string;
  /** Optional input overrides (interpreted by the backend; must be JSON-serialisable). */
  inputs?: Record<string, unknown>;
}

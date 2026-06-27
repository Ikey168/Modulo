// ModuloCoreAPI (#294) — the single public surface through which feature packs
// interact with the Modulo core. Every method here corresponds to an existing
// backend capability. No React, editor, or graph-view types appear in this file.
//
// Capability mapping (aligns with BlueprintCapabilityService #275):
//   notes:write       → createNote, updateNote, deleteNote, addTag, removeTag,
//                       createLink, removeLink
//   ai:invoke         → (invoked indirectly via blueprint nodes)
//   blockchain:anchor → (invoked indirectly via blueprint nodes)
//   code:execute      → (invoked indirectly via blueprint nodes, #279)
//
// Packs declare their needs via requestCapabilities() at initialisation so the
// app shell can surface a consent prompt before the pack performs any write.

import type {
  BlueprintInvokeOptions,
  BlueprintListItem,
  CoreCapability,
  CoreEventListener,
  CoreEventType,
  CoreLink,
  CoreNote,
  CoreTag,
  GraphNodeData,
  GraphQueryResult,
  Unsubscribe,
} from './types';

export interface ModuloCoreAPI {
  // ── Note CRUD ─────────────────────────────────────────────────────────────

  /** Return all notes visible to the current user. */
  notes(): Promise<CoreNote[]>;

  /** Return a single note by numeric id. */
  getNote(id: number): Promise<CoreNote>;

  /** Full-text search over notes. Returns ranked matches. */
  searchNotes(query: string): Promise<CoreNote[]>;

  /**
   * Create a new note.
   * @capability notes:write
   * Emits: note.saved
   */
  createNote(title: string, content: string, tags?: string[]): Promise<CoreNote>;

  /**
   * Update title, content, or markdownContent of an existing note.
   * @capability notes:write
   * Emits: note.saved
   */
  updateNote(
    id: number,
    patch: { title?: string; content?: string; markdownContent?: string },
  ): Promise<CoreNote>;

  /**
   * Permanently delete a note.
   * @capability notes:write
   * Emits: note.deleted
   */
  deleteNote(id: number): Promise<void>;

  // ── Tags ──────────────────────────────────────────────────────────────────

  /** Return all tags defined in the workspace. */
  tags(): Promise<CoreTag[]>;

  /**
   * Attach a tag to a note (creating the tag if it doesn't exist).
   * @capability notes:write
   * Emits: tag.added
   */
  addTag(noteId: number, tagName: string): Promise<CoreNote>;

  /**
   * Remove a tag from a note by tag id.
   * @capability notes:write
   * Emits: tag.removed
   */
  removeTag(noteId: number, tagId: string): Promise<CoreNote>;

  // ── Links ─────────────────────────────────────────────────────────────────

  /** Return all links in the workspace. */
  links(): Promise<CoreLink[]>;

  /** Return links whose source is the given note. */
  outgoingLinks(noteId: number): Promise<CoreLink[]>;

  /** Return links whose target is the given note. */
  incomingLinks(noteId: number): Promise<CoreLink[]>;

  /**
   * Create a directed link between two notes.
   * @capability notes:write
   * Emits: link.created
   */
  createLink(sourceId: number, targetId: number, linkType?: string): Promise<CoreLink>;

  /**
   * Remove a link by id.
   * @capability notes:write
   * Emits: link.removed
   */
  removeLink(linkId: string): Promise<void>;

  // ── Graph read / query ────────────────────────────────────────────────────

  /** Return the full note graph (all nodes and edges). */
  graph(): Promise<GraphQueryResult>;

  /**
   * Return the subgraph containing only notes that carry at least one of the
   * given tags, plus the links between them.
   */
  filterGraphByTags(tagNames: string[]): Promise<GraphQueryResult>;

  /**
   * Return the immediate neighbours (one hop away) of the given note.
   * Traverses both incoming and outgoing links.
   */
  neighbours(noteId: number): Promise<GraphNodeData[]>;

  /**
   * Return the subgraph reachable from a note within `depth` hops (default 2).
   * Uses bidirectional BFS over the full link set.
   */
  subgraph(noteId: number, depth?: number): Promise<GraphQueryResult>;

  // ── Event subscription ────────────────────────────────────────────────────

  /**
   * Subscribe to a core domain event. Returns a function that removes the
   * subscription when called.
   *
   * Events fire after successful API calls — e.g. `note.saved` fires after
   * createNote() or updateNote() resolves.
   */
  on(event: CoreEventType, listener: CoreEventListener): Unsubscribe;

  // ── Blueprint invocation ──────────────────────────────────────────────────

  /** List all blueprints registered in the workspace. */
  listBlueprints(): Promise<BlueprintListItem[]>;

  /**
   * Request a manual run of a named blueprint.
   * The backend executes it asynchronously; the returned promise resolves once
   * the run has been accepted (not necessarily completed).
   *
   * Note: blueprint execution is normally event-driven. Manual invocation is
   * available for testing and scripting. Backend endpoint wired in B7.
   */
  invokeBlueprint(opts: BlueprintInvokeOptions): Promise<void>;

  // ── Capability awareness ──────────────────────────────────────────────────

  /**
   * Declare that the calling pack requires these capabilities. Packs call this
   * once at initialisation (before performing any write). Returns the subset of
   * capabilities that have NOT yet been granted — the app shell uses this list
   * to present a consent prompt.
   *
   * A non-empty return does not prevent execution; it signals what the user
   * should be asked to approve. The backend enforces grants independently.
   */
  requestCapabilities(caps: CoreCapability[]): Promise<CoreCapability[]>;

  /**
   * Return whether the given capability is currently available in this session.
   * Read capabilities always return true; write capabilities depend on the
   * pack's grants (managed by the app shell via the consent flow).
   */
  hasCapability(cap: CoreCapability): Promise<boolean>;
}

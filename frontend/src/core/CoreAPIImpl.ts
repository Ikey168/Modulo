// CoreAPIImpl (#294) — the concrete implementation of ModuloCoreAPI.
// Delegates to existing workspace API clients and blueprint service; maps their
// return types to the stable core domain types so packs never see workspace
// internals. Emits domain events after each successful write so subscribers
// registered via api.on() are notified immediately.
//
// Not exported directly — use createCoreAPI() from index.ts.

import {
  linksApi,
  notesApi,
  tagsApi,
} from '../features/workspace/workspaceApi';
import {
  normalizeLink,
  type WorkspaceNote,
  type WorkspaceTag,
} from '../features/workspace/types';
import { listBlueprints as bpList } from '../features/blueprint/blueprintService';
import type { ModuloCoreAPI } from './ModuloCoreAPI';
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
import { CoreEventBus } from './coreEventBus';
import {
  buildGraph,
  filterGraphByTags as filterGraph,
  neighbours as graphNeighbours,
  subgraph as graphSubgraph,
} from './graphQueries';

// ── Type mapping helpers ─────────────────────────────────────────────────────

function toNote(n: WorkspaceNote): CoreNote {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    markdownContent: n.markdownContent,
    tags: (n.tags ?? []).map(toTag),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    version: n.version,
    isOnBlockchain: n.isOnBlockchain,
    isDecentralized: n.isDecentralized,
    blockchainTxHash: n.blockchainTxHash,
    ipfsCid: n.ipfsCid,
  };
}

function toTag(t: WorkspaceTag): CoreTag {
  return { id: t.id, name: t.name };
}

function toLink(id: string, linkType: string, sourceNoteId: number, targetNoteId: number): CoreLink {
  return { id, linkType, sourceNoteId, targetNoteId };
}

// ── CoreAPIImpl ──────────────────────────────────────────────────────────────

export class CoreAPIImpl implements ModuloCoreAPI {
  private readonly bus = new CoreEventBus();
  /** Capabilities declared by this pack instance via requestCapabilities(). */
  private readonly grantedCaps = new Set<CoreCapability>();

  // ── Note CRUD ─────────────────────────────────────────────────────────────

  async notes(): Promise<CoreNote[]> {
    const list = await notesApi.list();
    return (Array.isArray(list) ? list : []).map(toNote);
  }

  async getNote(id: number): Promise<CoreNote> {
    const n = await notesApi.get(id);
    return toNote(n);
  }

  async searchNotes(query: string): Promise<CoreNote[]> {
    const list = await notesApi.search(query);
    return (Array.isArray(list) ? list : []).map(toNote);
  }

  async createNote(title: string, content: string, tags?: string[]): Promise<CoreNote> {
    const created = await notesApi.create({ title, content, tagNames: tags });
    const note = toNote(created);
    this.bus.emit('note.saved', note);
    return note;
  }

  async updateNote(
    id: number,
    patch: { title?: string; content?: string; markdownContent?: string },
  ): Promise<CoreNote> {
    const existing = await notesApi.get(id);
    const updated = await notesApi.update(id, {
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      markdownContent: patch.markdownContent ?? existing.markdownContent,
      version: existing.version,
    });
    const note = toNote(updated);
    this.bus.emit('note.saved', note);
    return note;
  }

  async deleteNote(id: number): Promise<void> {
    await notesApi.remove(id);
    this.bus.emit('note.deleted', { id });
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async tags(): Promise<CoreTag[]> {
    const list = await tagsApi.list();
    return (Array.isArray(list) ? list : []).map(toTag);
  }

  async addTag(noteId: number, tagName: string): Promise<CoreNote> {
    const updated = await notesApi.addTag(noteId, tagName);
    const note = toNote(updated);
    this.bus.emit('tag.added', { noteId, tagName, note });
    return note;
  }

  async removeTag(noteId: number, tagId: string): Promise<CoreNote> {
    const updated = await notesApi.removeTag(noteId, tagId);
    const note = toNote(updated);
    this.bus.emit('tag.removed', { noteId, tagId, note });
    return note;
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  async links(): Promise<CoreLink[]> {
    const list = await linksApi.all();
    return (Array.isArray(list) ? list : [])
      .map(normalizeLink)
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => toLink(l.id, l.linkType, l.sourceId, l.targetId));
  }

  async outgoingLinks(noteId: number): Promise<CoreLink[]> {
    const list = await linksApi.outgoing(noteId);
    return (Array.isArray(list) ? list : [])
      .map(normalizeLink)
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => toLink(l.id, l.linkType, l.sourceId, l.targetId));
  }

  async incomingLinks(noteId: number): Promise<CoreLink[]> {
    const list = await linksApi.incoming(noteId);
    return (Array.isArray(list) ? list : [])
      .map(normalizeLink)
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => toLink(l.id, l.linkType, l.sourceId, l.targetId));
  }

  async createLink(
    sourceId: number,
    targetId: number,
    linkType = 'RELATED',
  ): Promise<CoreLink> {
    const created = await linksApi.create({ sourceNoteId: sourceId, targetNoteId: targetId, linkType });
    const normalized = normalizeLink(created);
    if (!normalized) throw new Error('Backend returned an unparseable link');
    const link = toLink(normalized.id, normalized.linkType, normalized.sourceId, normalized.targetId);
    this.bus.emit('link.created', link);
    return link;
  }

  async removeLink(linkId: string): Promise<void> {
    await linksApi.remove(linkId);
    this.bus.emit('link.removed', { id: linkId });
  }

  // ── Graph read / query ────────────────────────────────────────────────────

  private async _fetchGraph(): Promise<GraphQueryResult> {
    const [noteList, linkList] = await Promise.all([notesApi.list(), linksApi.all()]);
    const coreNotes = (Array.isArray(noteList) ? noteList : []).map(toNote);
    const coreLinks = (Array.isArray(linkList) ? linkList : [])
      .map(normalizeLink)
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => toLink(l.id, l.linkType, l.sourceId, l.targetId));
    return buildGraph(coreNotes, coreLinks);
  }

  async graph(): Promise<GraphQueryResult> {
    return this._fetchGraph();
  }

  async filterGraphByTags(tagNames: string[]): Promise<GraphQueryResult> {
    const g = await this._fetchGraph();
    return filterGraph(g, tagNames);
  }

  async neighbours(noteId: number): Promise<GraphNodeData[]> {
    const g = await this._fetchGraph();
    return graphNeighbours(g, noteId);
  }

  async subgraph(noteId: number, depth = 2): Promise<GraphQueryResult> {
    const g = await this._fetchGraph();
    return graphSubgraph(g, noteId, depth);
  }

  // ── Event subscription ────────────────────────────────────────────────────

  on(event: CoreEventType, listener: CoreEventListener): Unsubscribe {
    return this.bus.on(event, listener);
  }

  // ── Blueprint invocation ──────────────────────────────────────────────────

  async listBlueprints(): Promise<BlueprintListItem[]> {
    return bpList();
  }

  async invokeBlueprint(opts: BlueprintInvokeOptions): Promise<void> {
    const res = await fetch(`/api/blueprints/${encodeURIComponent(opts.name)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: opts.inputs ? JSON.stringify(opts.inputs) : undefined,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`invokeBlueprint failed: ${res.status} ${res.statusText}`);
    }
  }

  // ── Capability awareness ──────────────────────────────────────────────────

  async requestCapabilities(caps: CoreCapability[]): Promise<CoreCapability[]> {
    const READ_CAPS: CoreCapability[] = [];
    const ungrantedWriteCaps: CoreCapability[] = [];
    for (const cap of caps) {
      if (READ_CAPS.includes(cap) || this.grantedCaps.has(cap)) continue;
      ungrantedWriteCaps.push(cap);
    }
    // Packs learn what still needs user approval; the app shell is responsible
    // for showing a consent dialog and calling back into the API to record grants.
    // For now we optimistically record them all so subsequent hasCapability calls
    // return true — the backend enforces grants independently via #275.
    for (const cap of caps) this.grantedCaps.add(cap);
    return ungrantedWriteCaps;
  }

  async hasCapability(cap: CoreCapability): Promise<boolean> {
    const READ_CAPS: CoreCapability[] = [];
    return READ_CAPS.includes(cap) || this.grantedCaps.has(cap);
  }
}

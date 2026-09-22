import type { CoreNote } from '@modulo/core';
type WorkspaceNote = Omit<CoreNote, 'tags'> & { tags?: CoreNote['tags'] };

export type NoteEdit = { title: string; content: string; markdownContent?: string; tagNames?: string[]; version?: number;
  /** Client-only text shown to the editor before this edit. Never sent to the server. */
  expectedLocal?: { title: string; content: string; markdownContent?: string } };
interface PendingEdit { body: NoteEdit; baseVersion: number; conflict?: WorkspaceNote; error?: string }
export interface OfflineNoteSnapshot { version: 1; notes: WorkspaceNote[]; pending: Record<string, PendingEdit>;
  resources: Record<string, unknown>; legacySource?: string }
export interface NoteCachePersistence {
  load(key: string): Promise<OfflineNoteSnapshot | null>;
  save(key: string, snapshot: OfflineNoteSnapshot): Promise<void>;
}
export interface OfflineNoteTransport {
  list(): Promise<WorkspaceNote[]>;
  get(id: number): Promise<WorkspaceNote>;
  put(id: number, body: NoteEdit): Promise<WorkspaceNote>;
}
export class NoteHttpError extends Error { constructor(readonly status: number) { super(`Note request failed (${status}).`); } }
const transient = (error: unknown) => error instanceof TypeError || error instanceof NoteHttpError && error.status >= 500;
export const noteMatchesEdit = (note: WorkspaceNote, edit: NoteEdit) => note.title === edit.title && note.content === edit.content &&
  (note.markdownContent ?? note.content) === (edit.markdownContent ?? edit.content) &&
  (!edit.tagNames || [...edit.tagNames].sort().join('\0') === (note.tags ?? []).map(tag => tag.name).sort().join('\0'));
const empty = (): OfflineNoteSnapshot => ({ version: 1, notes: [], pending: {}, resources: {} });
const copy = <T>(value: T): T => structuredClone(value);

export function validateOfflineNoteSnapshot(value: OfflineNoteSnapshot): void {
  if (!value || value.version !== 1 || !Array.isArray(value.notes) || !value.pending
    || typeof value.pending !== 'object' || Array.isArray(value.pending)
    || !value.resources || typeof value.resources !== 'object' || Array.isArray(value.resources)
    || (value.legacySource !== undefined && typeof value.legacySource !== 'string')
    || value.notes.some(note => !note || !Number.isSafeInteger(note.id) || typeof note.title !== 'string'
      || typeof note.content !== 'string')
    || Object.values(value.pending).some(edit => !edit || !edit.body || !Number.isSafeInteger(edit.baseVersion)
      || typeof edit.body.title !== 'string' || typeof edit.body.content !== 'string')) {
    throw new Error('Offline note cache requires recovery.');
  }
}

/** Durable edits retain the reviewed version. All mutations run under an account-wide tab lock. */
export class OfflineNotes {
  cacheError = '';
  private state: OfflineNoteSnapshot = empty();
  private readonly ready: Promise<void>;
  private hadCache = false;
  private async cache(value: OfflineNoteSnapshot) {
    this.check();
    try { await this.write(value); this.cacheError = ''; }
    catch (reason) { this.check(); this.cacheError = reason instanceof Error ? reason.message : 'Offline cache unavailable'; this.changed(); }
  }
  constructor(readonly key: string, private persistence: NoteCachePersistence, private transport: OfflineNoteTransport,
    private valid: () => boolean, private lock: <T>(work: () => Promise<T>) => Promise<T>, private changed: () => void = () => {}) {
    this.ready = this.initialize();
    void this.ready.catch(() => {});
  }
  private check() { if (!this.valid()) throw new Error('Account changed. Reopen the workspace.'); }
  private async initialize(): Promise<void> {
    try {
      this.check();
      const value = await this.persistence.load(this.key);
      this.check();
      if (value) { validateOfflineNoteSnapshot(value); this.state = copy(value); this.hadCache = true; }
      this.changed();
    } catch (reason) {
      this.cacheError = reason instanceof Error ? reason.message : 'Offline note cache requires recovery.';
      this.changed();
      throw reason;
    }
  }
  private async read(): Promise<OfflineNoteSnapshot> {
    await this.ready; this.check();
    // The account-wide lock spans this read and the following write. Reloading
    // inside it prevents another tab's durable edit from being overwritten by
    // this tab's stale in-memory snapshot.
    const latest = await this.persistence.load(this.key);
    this.check();
    if (latest) validateOfflineNoteSnapshot(latest);
    this.state = copy(latest ?? empty()); this.hadCache = latest !== null;
    return copy(this.state);
  }
  private async write(value: OfflineNoteSnapshot): Promise<void> {
    this.check(); await this.persistence.save(this.key, value); this.check();
    this.state = copy(value); this.hadCache = true; this.changed();
  }
  private upsert(state: OfflineNoteSnapshot, note: WorkspaceNote) { state.notes = [...state.notes.filter(item => item.id !== note.id), note]; }
  snapshot() { this.check(); return copy(this.state); }
  async refreshCache(): Promise<void> {
    await this.lock(async () => { await this.read(); this.changed(); });
  }
  async list(): Promise<WorkspaceNote[]> {
    return this.lock(async () => {
      const state = await this.read();
      try {
        const notes = await this.transport.list(); this.check();
        state.notes = [...notes.filter(note => !state.pending[note.id]), ...state.notes.filter(note => !!state.pending[note.id])];
        await this.cache(state);
      } catch (error) { if (!transient(error) || !this.hadCache) throw error; }
      return state.notes;
    });
  }
  async get(id: number): Promise<WorkspaceNote> {
    return this.lock(async () => {
      const state = await this.read(); const cached = state.notes.find(note => note.id === id);
      if (state.pending[id] && cached) return cached;
      try { const note = await this.transport.get(id); this.check(); this.upsert(state, note); await this.cache(state); return note; }
      catch (error) { if (transient(error) && cached) return cached; throw error; }
    });
  }
  async remember(note: WorkspaceNote) { return this.lock(async () => { const state = await this.read(); this.upsert(state, note); await this.cache(state); return note; }); }
  async resource<T>(key: string, load: () => Promise<T>): Promise<T> {
    return this.lock(async () => {
      const state = await this.read();
      try { const value = await load(); this.check(); state.resources[key] = value; await this.cache(state); return value; }
      catch (error) { if (transient(error) && key in state.resources) return state.resources[key] as T; throw error; }
    });
  }
  async update(id: number, body: NoteEdit): Promise<WorkspaceNote> {
    return this.lock(async () => {
      const state = await this.read(); const cached = state.notes.find(note => note.id === id);
      if (!cached || !Number.isSafeInteger(body.version)) throw new Error('Refresh the note before editing.');
      const previous = state.pending[id];
      if (previous?.conflict || previous?.error) throw new Error('Resolve this note’s synchronization conflict before editing.');
      if (body.version !== cached.version) throw new Error('The note changed. Refresh and review your edit.');
      if (previous && (!body.expectedLocal || body.expectedLocal.title !== cached.title
        || body.expectedLocal.content !== cached.content
        || (body.expectedLocal.markdownContent ?? body.expectedLocal.content) !== (cached.markdownContent ?? cached.content))) {
        throw new Error('Another editor changed this offline note. Refresh and review its pending edit before saving.');
      }
      const requestBody = { ...body };
      delete requestBody.expectedLocal;
      body = { ...requestBody, tagNames: body.tagNames ?? cached.tags?.map(tag => tag.name) ?? [] };
      state.pending[id] = { body, baseVersion: previous?.baseVersion ?? body.version! };
      this.upsert(state, { ...cached, ...body }); await this.write(state);
      await this.send(state, id);
      return state.notes.find(note => note.id === id)!;
    });
  }
  private async send(state: OfflineNoteSnapshot, id: number) {
    const edit = state.pending[id]; if (!edit || edit.conflict || edit.error) return;
    try {
      const remote = await this.transport.get(id); this.check();
      // A lost successful PUT response is acknowledged by its exact resulting text.
      if (noteMatchesEdit(remote, edit.body)) { this.upsert(state, remote); delete state.pending[id]; await this.write(state); return; }
      if (remote.version !== edit.baseVersion) { edit.conflict = remote; await this.write(state); return; }
      const saved = await this.transport.put(id, { ...edit.body, version: edit.baseVersion }); this.check();
      this.upsert(state, saved); delete state.pending[id]; await this.write(state);
    } catch (error) {
      this.check();
      if (!transient(error)) {
        if (error instanceof NoteHttpError && error.status === 409) {
          try { edit.conflict = await this.transport.get(id); this.check(); } catch { edit.error = 'The server changed. Retry to review the current version.'; }
        } else edit.error = error instanceof Error ? error.message : String(error);
        await this.write(state);
      }
    }
  }
  async synchronize() { return this.lock(async () => { const state = await this.read(); for (const id of Object.keys(state.pending)) await this.send(state, Number(id)); }); }
  async resolve(id: number, choice: 'local' | 'remote') {
    return this.lock(async () => {
      const state = await this.read(); const edit = state.pending[id]; if (!edit) return;
      const remote = await this.transport.get(id); this.check();
      if (choice === 'remote') { this.upsert(state, remote); delete state.pending[id]; await this.write(state); return; }
      if (!edit.conflict || remote.version !== edit.conflict.version) { edit.conflict = remote; delete edit.error; await this.write(state); throw new Error('The server changed again. Review the current version before keeping your edit.'); }
      edit.baseVersion = remote.version!; edit.body.version = remote.version; delete edit.conflict; delete edit.error; await this.write(state); await this.send(state, id);
    });
  }
  async retry() { return this.lock(async () => { const state = await this.read(); for (const [id, edit] of Object.entries(state.pending)) { delete edit.error; if (!edit.conflict) await this.send(state, Number(id)); } await this.write(state); }); }
}

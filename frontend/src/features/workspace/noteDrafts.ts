import { authService } from '../auth/authService';
import type { CoreNote } from '@modulo/core';
import { deviceDocuments } from '../../services/deviceDocuments';
import { claimLegacyDraft } from '../../services/legacy/legacyDeviceTransfer';

export type NoteText = { title: string; content: string };
export type DraftSnapshot = NoteText & {
  status: 'Saved' | 'Unsaved' | 'Saving…' | 'Save failed';
  /** False when the unsaved text could not be committed to device storage. */
  local: boolean;
};
/** Account-scoped so another account on this device never sees or replays the draft. */
export const noteDraftKey = (id: number) => {
  const session = authService.stateSession?.();
  return session ? `modulo-note-draft-${JSON.stringify([session.issuer, session.subject])}:${id}` : `modulo-note-draft-${id}`;
};
export const noteText = (note: CoreNote): NoteText => ({
  title: note.title,
  content: note.markdownContent ?? note.content ?? '',
});
const same = (a: NoteText, b: NoteText) =>
  a.title === b.title && a.content === b.content;

/**
 * A single queue per note survives editor navigation and never acknowledges
 * newer text. Unsaved text is committed to device storage (IndexedDB, or
 * SQLite on Android) until the server accepts the save.
 */
export class NoteDraft {
  snapshot: DraftSnapshot;
  /** Resolves when any draft recovered from device storage has been applied. */
  readonly loaded: Promise<void>;
  private saved: NoteText;
  private readonly storageKey: string;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private edited = false;
  save: (text: NoteText) => Promise<boolean | void>;
  constructor(
    readonly id: number,
    initial: NoteText,
    save: NoteDraft['save'],
    private readonly documents = deviceDocuments(),
  ) {
    this.storageKey = noteDraftKey(id);
    this.saved = initial;
    this.save = save;
    this.snapshot = { ...initial, status: 'Saved', local: true };
    this.loaded = this.recover();
  }
  private async recover(): Promise<void> {
    let recovered: NoteText | undefined;
    try {
      recovered = await this.documents.get<NoteText>(this.storageKey)
        ?? await claimLegacyDraft(this.storageKey, this.documents);
    } catch {
      return; // An unreadable draft must not prevent opening the server copy.
    }
    if (!recovered || typeof recovered.title !== 'string' || typeof recovered.content !== 'string') return;
    if (this.edited || same(recovered, this.saved)) return;
    this.publish({ title: recovered.title, content: recovered.content, status: 'Unsaved' });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(patch: Partial<DraftSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  change(patch: Partial<NoteText>) {
    if (this.storageKey !== noteDraftKey(this.id)) return;
    this.edited = true;
    const text = {
      title: this.snapshot.title,
      content: this.snapshot.content,
      ...patch,
    };
    this.publish({ ...text, status: 'Unsaved' });
    this.writes = this.writes.then(() => this.documents.set(this.storageKey, text))
      .then(() => { if (same(this.snapshot, text)) this.publish({ local: true }); },
        () => { if (same(this.snapshot, text)) this.publish({ local: false }); });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 900);
  }
  accept(note: NoteText) {
    if (
      this.snapshot.status === 'Saved' &&
      !this.pending &&
      !same(note, this.saved)
    ) {
      this.saved = note;
      this.publish(note);
    }
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.storageKey !== noteDraftKey(this.id)) return Promise.resolve();
    if (this.pending) return this.pending;
    if (same(this.snapshot, this.saved)) {
      this.publish({ status: 'Saved' });
      return Promise.resolve();
    }
    this.pending = this.drain().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  };
  private async drain() {
    while (!same(this.snapshot, this.saved)) {
      const text = {
        title: this.snapshot.title,
        content: this.snapshot.content,
      };
      this.publish({ status: 'Saving…' });
      try {
        if (
          (await this.save({
            ...text,
            title: text.title.trim() || 'Untitled Note',
          })) === false
        )
          throw new Error('Save failed');
        this.saved = text;
        if (same(this.snapshot, text)) {
          // Another tab may have stored its own newer draft in the meantime; only this text is cleared.
          await this.writes;
          await this.documents.removeIfEqual(this.storageKey, text).catch(() => false);
          this.publish({ status: 'Saved', local: true });
        }
      } catch {
        this.publish({ status: 'Save failed' });
        return;
      }
    }
  }
}
const drafts = new Map<string, NoteDraft>();
export function getNoteDraft(note: CoreNote, save: NoteDraft['save']) {
  let draft = drafts.get(noteDraftKey(note.id));
  if (!draft) {
    draft = new NoteDraft(note.id, noteText(note), save);
    drafts.set(noteDraftKey(note.id), draft);
  }
  draft.save = save;
  return draft;
}
export function flushNoteDrafts() {
  return Promise.all([...drafts.entries()].filter(([key, draft]) => key === noteDraftKey(draft.id)).map(([, draft]) => draft.flush()));
}
export function hasUnsavedNotes() {
  return [...drafts.entries()].filter(([key, draft]) => key === noteDraftKey(draft.id)).some(
    ([, draft]) => draft.snapshot.status !== 'Saved',
  );
}

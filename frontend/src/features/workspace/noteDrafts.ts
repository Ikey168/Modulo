import { authService } from '../auth/authService';
import type { CoreNote } from '@modulo/core';
import { writeWorkspaceJson } from './workspaceStorage';

export type NoteText = { title: string; content: string };
export type DraftSnapshot = NoteText & {
  status: 'Saved' | 'Unsaved' | 'Saving…' | 'Save failed';
  local: boolean;
};
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

/** A single queue per note survives editor navigation and never acknowledges newer text. */
export class NoteDraft {
  snapshot: DraftSnapshot;
  private saved: NoteText;
  private readonly storageKey: string;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  save: (text: NoteText) => Promise<boolean | void>;
  constructor(
    readonly id: number,
    initial: NoteText,
    save: NoteDraft['save'],
  ) {
    this.storageKey = noteDraftKey(id);
    this.saved = initial;
    this.save = save;
    let recovered = initial;
    try {
      const raw = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (
        raw &&
        typeof raw.title === 'string' &&
        typeof raw.content === 'string'
      )
        recovered = raw;
    } catch {
      /* An unreadable draft must not prevent opening the server copy. */
    }
    this.snapshot = {
      ...recovered,
      status: same(recovered, initial) ? 'Saved' : 'Unsaved',
      local: true,
    };
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
    const text = {
      title: this.snapshot.title,
      content: this.snapshot.content,
      ...patch,
    };
    const local = writeWorkspaceJson(this.storageKey, text);
    this.publish({ ...text, local, status: 'Unsaved' });
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
          // Another tab may have saved its own draft in the meantime.
          try {
            if (
              localStorage.getItem(this.storageKey) ===
              JSON.stringify(text)
            )
              localStorage.removeItem(this.storageKey);
          } catch {
            /* The server save succeeded even if local cleanup is unavailable. */
          }
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

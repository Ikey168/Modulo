// Client-side store for the Saved Searches plugin. A saved search is a named
// query (text plus required tags) persisted in localStorage, evaluated live
// over the current notes. The list operations are pure and unit-tested; the
// matcher mirrors the notes filter's semantics (title or tag contains the text).
import type { CoreNote } from '@modulo/core';

const STORE_KEY = 'modulo-saved-searches';

export interface SavedSearch {
  id: string;
  name: string;
  /** Free text matched against a note's title or tags. */
  text: string;
  /** Tag names that must all be present on a matching note. */
  tags: string[];
}

let seq = 0;
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `ss_${crypto.randomUUID()}`;
  } catch {
    /* fall through to the counter */
  }
  seq += 1;
  return `ss_${seq}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function isSearch(s: unknown): s is SavedSearch {
  return Boolean(s) && typeof (s as SavedSearch).id === 'string' && typeof (s as SavedSearch).name === 'string';
}

export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isSearch).map((s) => ({ ...s, text: s.text ?? '', tags: Array.isArray(s.tags) ? s.tags : [] }));
      }
    }
  } catch {
    /* corrupt or unavailable storage falls back to an empty list */
  }
  return [];
}

export function saveSavedSearches(list: SavedSearch[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable; state still applies for this session */
  }
}

export function addSearch(list: SavedSearch[], name: string): SavedSearch[] {
  return [...list, { id: newId(), name, text: '', tags: [] }];
}

export function renameSearch(list: SavedSearch[], id: string, name: string): SavedSearch[] {
  return list.map((s) => (s.id === id ? { ...s, name } : s));
}

export function updateSearch(list: SavedSearch[], id: string, patch: Partial<Omit<SavedSearch, 'id'>>): SavedSearch[] {
  return list.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function removeSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter((s) => s.id !== id);
}

/** Notes matching a search: the text matches a note's title or any tag, and
 *  every required tag must be present. An empty query matches everything. */
export function matchNotes(notes: CoreNote[], search: Pick<SavedSearch, 'text' | 'tags'>): CoreNote[] {
  const text = search.text.trim().toLowerCase();
  const tags = search.tags.map((t) => t.toLowerCase());
  return notes.filter((n) => {
    const noteTags = (n.tags ?? []).map((t) => t.name.toLowerCase());
    const okText = !text || n.title.toLowerCase().includes(text) || noteTags.some((t) => t.includes(text));
    const okTags = tags.every((t) => noteTags.includes(t));
    return okText && okTags;
  });
}

import { beforeEach, describe, expect, it } from 'vitest';
import type { CoreNote, CoreTag } from '@modulo/core';
import {
  addSearch,
  loadSavedSearches,
  matchNotes,
  removeSearch,
  renameSearch,
  saveSavedSearches,
  updateSearch,
} from '../savedSearchesStore';

const tag = (name: string): CoreTag => ({ id: name, name });
const note = (id: number, title: string, ...tags: string[]): CoreNote => ({
  id,
  title,
  content: '',
  tags: tags.map(tag),
});

beforeEach(() => localStorage.clear());

describe('savedSearchesStore - list operations', () => {
  it('adds, renames, updates, and removes', () => {
    let list = addSearch([], 'First');
    expect(list).toHaveLength(1);
    const id = list[0].id;
    list = renameSearch(list, id, 'Renamed');
    expect(list[0].name).toBe('Renamed');
    list = updateSearch(list, id, { text: 'hello', tags: ['x'] });
    expect(list[0]).toMatchObject({ text: 'hello', tags: ['x'] });
    list = removeSearch(list, id);
    expect(list).toHaveLength(0);
  });

  it('round-trips through localStorage', () => {
    const list = updateSearch(addSearch([], 'Work'), '', {}); // no-op update keeps shape
    saveSavedSearches(list);
    const loaded = loadSavedSearches();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Work');
  });

  it('returns an empty list for missing or corrupt storage', () => {
    expect(loadSavedSearches()).toEqual([]);
    localStorage.setItem('modulo-saved-searches', '{ not json');
    expect(loadSavedSearches()).toEqual([]);
  });
});

describe('savedSearchesStore - matching', () => {
  const notes = [
    note(1, 'Weekly review', 'work', 'planning'),
    note(2, 'Grocery list', 'home'),
    note(3, 'Work notes', 'work'),
  ];

  it('matches an empty query to everything', () => {
    expect(matchNotes(notes, { text: '', tags: [] })).toHaveLength(3);
  });

  it('matches text against title or tags, case-insensitively', () => {
    expect(matchNotes(notes, { text: 'work', tags: [] }).map((n) => n.id).sort()).toEqual([1, 3]);
    expect(matchNotes(notes, { text: 'GROCERY', tags: [] }).map((n) => n.id)).toEqual([2]);
  });

  it('requires all listed tags to be present', () => {
    expect(matchNotes(notes, { text: '', tags: ['work'] }).map((n) => n.id).sort()).toEqual([1, 3]);
    expect(matchNotes(notes, { text: '', tags: ['work', 'planning'] }).map((n) => n.id)).toEqual([1]);
    expect(matchNotes(notes, { text: '', tags: ['missing'] })).toHaveLength(0);
  });

  it('combines text and tag filters', () => {
    expect(matchNotes(notes, { text: 'notes', tags: ['work'] }).map((n) => n.id)).toEqual([3]);
  });
});

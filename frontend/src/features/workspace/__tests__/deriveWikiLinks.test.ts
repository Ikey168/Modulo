import { describe, expect, it } from 'vitest';
import type { CoreLink, CoreNote } from '@modulo/core';
import { deriveWikiLinks, mergeWithWikiLinks } from '../deriveWikiLinks';

function note(id: number, title: string, content = ''): CoreNote {
  return { id, title, content, tags: [] };
}

function edgeKeys(links: CoreLink[]): string[] {
  return links.map((l) => `${l.sourceNoteId}->${l.targetNoteId}`).sort();
}

describe('deriveWikiLinks', () => {
  it('creates a directed edge for a [[Title]] reference', () => {
    const notes = [note(1, 'Alpha', 'see [[Beta]] for more'), note(2, 'Beta')];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('resolves titles by trimmed exact match, like the renderer', () => {
    const notes = [note(1, 'Alpha', 'links [[  Beta  ]] and [[beta]]'), note(2, 'Beta')];
    // "  Beta  " trims to "Beta" → matches; "beta" is a different title → no edge.
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('forms an edge for an aliased link [[Title|alias]]', () => {
    const notes = [note(1, 'Alpha', 'see [[Beta|the beta note]]'), note(2, 'Beta')];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('forms an edge for a heading-scoped link [[Title#Heading]]', () => {
    const notes = [note(1, 'Alpha', 'see [[Beta#Usage|usage]]'), note(2, 'Beta')];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('does not form an edge for an in-note heading link [[#Heading]]', () => {
    const notes = [note(1, 'Alpha', 'jump to [[#Section]]'), note(2, 'Beta')];
    expect(deriveWikiLinks(notes)).toEqual([]);
  });

  it('ignores references to unknown titles (missing links)', () => {
    const notes = [note(1, 'Alpha', 'see [[Ghost]]')];
    expect(deriveWikiLinks(notes)).toEqual([]);
  });

  it('drops self-links', () => {
    const notes = [note(1, 'Alpha', 'recursive [[Alpha]]')];
    expect(deriveWikiLinks(notes)).toEqual([]);
  });

  it('dedupes repeated references to the same target', () => {
    const notes = [note(1, 'Alpha', '[[Beta]] and again [[Beta]]'), note(2, 'Beta')];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('scans markdownContent as well as content', () => {
    const notes: CoreNote[] = [
      { id: 1, title: 'Alpha', content: '', markdownContent: 'see [[Beta]]', tags: [] },
      note(2, 'Beta'),
    ];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2']);
  });

  it('keeps directed edges in both directions distinct', () => {
    const notes = [note(1, 'Alpha', '[[Beta]]'), note(2, 'Beta', '[[Alpha]]')];
    expect(edgeKeys(deriveWikiLinks(notes))).toEqual(['1->2', '2->1']);
  });
});

describe('mergeWithWikiLinks', () => {
  const notes = [note(1, 'Alpha', '[[Beta]] and [[Gamma]]'), note(2, 'Beta'), note(3, 'Gamma')];

  it('appends derived links not already present as explicit links', () => {
    const explicit: CoreLink[] = [
      { id: 'db-1', linkType: 'RELATED', sourceNoteId: 1, targetNoteId: 2 },
    ];
    const merged = mergeWithWikiLinks(notes, explicit);
    expect(edgeKeys(merged)).toEqual(['1->2', '1->3']);
    // Explicit edge 1->2 is preserved as-is (keeps its real id), not duplicated.
    expect(merged.filter((l) => l.sourceNoteId === 1 && l.targetNoteId === 2)).toEqual([
      explicit[0],
    ]);
  });

  it('returns the original array when there are no derived links to add', () => {
    const explicit: CoreLink[] = [];
    const plain = [note(1, 'Alpha'), note(2, 'Beta')];
    expect(mergeWithWikiLinks(plain, explicit)).toBe(explicit);
  });
});

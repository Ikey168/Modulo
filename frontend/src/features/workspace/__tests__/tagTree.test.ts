import { describe, expect, it } from 'vitest';
import type { CoreNote, CoreTag } from '@modulo/core';
import { buildTagTree, noteMatchesTag, normalizeTag } from '../tagTree';

const tag = (name: string): CoreTag => ({ id: name, name });
const note = (id: number, ...tags: string[]): CoreNote => ({
  id,
  title: `Note ${id}`,
  content: '',
  tags: tags.map(tag),
});

describe('tagTree', () => {
  it('normalizes slash-delimited names', () => {
    expect(normalizeTag(' area / topic ')).toBe('area/topic');
    expect(normalizeTag('a//b/')).toBe('a/b');
  });

  it('builds a nested tree with descendant-inclusive counts', () => {
    const notes = [
      note(1, 'area/topic/a'),
      note(2, 'area/topic/b'),
      note(3, 'area/other'),
      note(4, 'solo'),
    ];
    const tree = buildTagTree(notes);
    // Roots: 'area' and 'solo', sorted.
    expect(tree.map((n) => n.key)).toEqual(['area', 'solo']);
    const area = tree[0];
    expect(area.count).toBe(3); // notes 1, 2, 3 all under 'area'
    const topic = area.children.find((c) => c.key === 'area/topic')!;
    expect(topic.count).toBe(2); // notes 1, 2
    expect(topic.children.map((c) => c.name).sort()).toEqual(['a', 'b']);
  });

  it('counts a note once even with multiple descendant tags', () => {
    const tree = buildTagTree([note(1, 'area/x', 'area/y')]);
    expect(tree[0].count).toBe(1);
  });

  it('includes registered vault tags no note carries, counting 0', () => {
    const tree = buildTagTree([note(1, 'area/x')], ['area/unused', 'fresh']);
    expect(tree.map((n) => n.key)).toEqual(['area', 'fresh']);
    expect(tree.find((n) => n.key === 'fresh')!.count).toBe(0);
    const area = tree.find((n) => n.key === 'area')!;
    expect(area.count).toBe(1); // still only note 1
    const unused = area.children.find((c) => c.key === 'area/unused')!;
    expect(unused.count).toBe(0);
  });

  it('matches a tag and its descendants but not siblings', () => {
    const n = note(1, 'area/topic/a');
    expect(noteMatchesTag(n, 'area')).toBe(true);
    expect(noteMatchesTag(n, 'area/topic')).toBe(true);
    expect(noteMatchesTag(n, 'area/topic/a')).toBe(true);
    expect(noteMatchesTag(n, 'area/other')).toBe(false);
    expect(noteMatchesTag(n, 'are')).toBe(false); // prefix but not a path segment
  });
});

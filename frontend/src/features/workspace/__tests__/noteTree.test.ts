import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { buildForest, isDescendant, moveNote, type TreeMap, type TreeNode } from '../noteTree';

function note(id: number, title = `Note ${id}`): CoreNote {
  return { id, title, content: '', tags: [] };
}

/** Flatten a forest to `id@depth` strings in visual (pre-order) sequence. */
function flatten(forest: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(`${n.note.id}@${n.depth}`);
      walk(n.children);
    }
  };
  walk(forest);
  return out;
}

describe('buildForest', () => {
  it('lists notes with no tree entry at the top level in id order', () => {
    const notes = [note(3), note(1), note(2)];
    expect(flatten(buildForest({}, notes))).toEqual(['1@0', '2@0', '3@0']);
  });

  it('nests children under their parent and honours sibling order', () => {
    const map: TreeMap = {
      2: { parent: 1, order: 1 },
      3: { parent: 1, order: 0 },
    };
    const forest = buildForest(map, [note(1), note(2), note(3)]);
    // 3 has the lower order, so it sorts before 2 under parent 1.
    expect(flatten(forest)).toEqual(['1@0', '3@1', '2@1']);
  });

  it('floats orphans (missing parent) back to the top level', () => {
    const map: TreeMap = { 2: { parent: 99, order: 0 } };
    const forest = buildForest(map, [note(1), note(2)]);
    // Both end up at depth 0; the orphan keeps its stored order (0), so it
    // sorts ahead of the entry-less note whose order defaults to the end.
    expect(flatten(forest).sort()).toEqual(['1@0', '2@0']);
  });
});

describe('isDescendant', () => {
  const map: TreeMap = {
    2: { parent: 1, order: 0 },
    3: { parent: 2, order: 0 },
  };

  it('detects a transitive ancestor', () => {
    expect(isDescendant(map, 3, 1)).toBe(true);
  });

  it('is false for unrelated nodes', () => {
    expect(isDescendant(map, 1, 3)).toBe(false);
  });

  it('does not loop forever on a corrupt cycle', () => {
    const cyclic: TreeMap = { 1: { parent: 2, order: 0 }, 2: { parent: 1, order: 0 } };
    expect(isDescendant(cyclic, 1, 99)).toBe(false);
  });
});

describe('moveNote', () => {
  const notes = [note(1), note(2), note(3)];

  it('nests a note inside a target with pos "inside"', () => {
    const next = moveNote({}, notes, 2, 1, 'inside');
    expect(flatten(buildForest(next, notes))).toEqual(['1@0', '2@1', '3@0']);
  });

  it('reorders siblings with pos "before"', () => {
    const next = moveNote({}, notes, 3, 1, 'before');
    expect(flatten(buildForest(next, notes))).toEqual(['3@0', '1@0', '2@0']);
  });

  it('reorders siblings with pos "after"', () => {
    const next = moveNote({}, notes, 1, 3, 'after');
    expect(flatten(buildForest(next, notes))).toEqual(['2@0', '3@0', '1@0']);
  });

  it('refuses to move a node into its own descendant', () => {
    const nested = moveNote({}, notes, 2, 1, 'inside'); // 2 under 1
    const attempted = moveNote(nested, notes, 1, 2, 'inside'); // 1 under its child 2
    expect(attempted).toBe(nested);
  });

  it('is a no-op when dropping a note onto itself', () => {
    const map: TreeMap = { 1: { parent: null, order: 0 } };
    expect(moveNote(map, notes, 1, 1, 'before')).toBe(map);
  });
});

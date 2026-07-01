import { describe, expect, it } from 'vitest';
import { buildGraph, filterGraphByTags, neighbours, subgraph } from '../graphQueries';
import type { CoreLink, CoreNote } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function note(id: number, title: string, tagNames: string[] = []): CoreNote {
  return {
    id,
    title,
    content: '',
    tags: tagNames.map((name) => ({ id: `t-${name}`, name })),
  };
}

function link(id: string, sourceNoteId: number, targetNoteId: number, linkType = 'RELATED'): CoreLink {
  return { id, linkType, sourceNoteId, targetNoteId };
}

// 4-note fixture: n1 → n2 → n3, n1 → n4
const NOTES = [
  note(1, 'Alpha', ['typescript', 'core']),
  note(2, 'Beta', ['typescript']),
  note(3, 'Gamma', ['core']),
  note(4, 'Delta', []),
];

const LINKS = [
  link('l1', 1, 2),
  link('l2', 2, 3),
  link('l3', 1, 4),
];

// ── buildGraph ────────────────────────────────────────────────────────────────

describe('buildGraph', () => {
  it('returns empty graph for empty input', () => {
    const g = buildGraph([], []);
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });

  it('maps each note to a node with correct id and tags', () => {
    const g = buildGraph(NOTES, []);
    expect(g.nodes).toHaveLength(4);
    const n1 = g.nodes.find((n) => n.noteId === 1)!;
    expect(n1.id).toBe('1');
    expect(n1.title).toBe('Alpha');
    expect(n1.tags).toEqual(['typescript', 'core']);
  });

  it('maps each link to an edge with correct source/target ids', () => {
    const g = buildGraph(NOTES, LINKS);
    expect(g.edges).toHaveLength(3);
    const e1 = g.edges.find((e) => e.id === 'l1')!;
    expect(e1.sourceId).toBe('1');
    expect(e1.targetId).toBe('2');
    expect(e1.linkType).toBe('RELATED');
  });

  it('computes connectionCount correctly', () => {
    const g = buildGraph(NOTES, LINKS);
    const n1 = g.nodes.find((n) => n.noteId === 1)!; // source of l1, l3
    expect(n1.connectionCount).toBe(2);
    const n2 = g.nodes.find((n) => n.noteId === 2)!; // target of l1, source of l2
    expect(n2.connectionCount).toBe(2);
    const n4 = g.nodes.find((n) => n.noteId === 4)!; // target of l3 only
    expect(n4.connectionCount).toBe(1);
  });

  it('gives zero connectionCount for isolated nodes', () => {
    const g = buildGraph([note(99, 'Orphan')], []);
    expect(g.nodes[0].connectionCount).toBe(0);
  });
});

// ── filterGraphByTags ─────────────────────────────────────────────────────────

describe('filterGraphByTags', () => {
  const graph = buildGraph(NOTES, LINKS);

  it('returns the full graph when tagNames is empty', () => {
    const result = filterGraphByTags(graph, []);
    expect(result).toBe(graph);
  });

  it('keeps only nodes with at least one matching tag', () => {
    const result = filterGraphByTags(graph, ['typescript']);
    const titles = result.nodes.map((n) => n.title);
    expect(titles).toContain('Alpha');
    expect(titles).toContain('Beta');
    expect(titles).not.toContain('Gamma');
    expect(titles).not.toContain('Delta');
  });

  it('keeps edges only between surviving nodes', () => {
    // 'typescript' nodes: Alpha (1) and Beta (2) — edge l1 should survive; l2, l3 should not
    const result = filterGraphByTags(graph, ['typescript']);
    expect(result.edges.map((e) => e.id)).toEqual(['l1']);
  });

  it('is case-insensitive and uses substring match', () => {
    const result = filterGraphByTags(graph, ['SCRIPT']); // substring of 'typescript'
    expect(result.nodes.map((n) => n.title)).toContain('Alpha');
  });

  it('returns empty graph when no notes match', () => {
    const result = filterGraphByTags(graph, ['nonexistent']);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});

// ── neighbours ────────────────────────────────────────────────────────────────

describe('neighbours', () => {
  const graph = buildGraph(NOTES, LINKS);

  it('returns direct neighbours from both directions', () => {
    // Node 2 is target of l1 (from 1) and source of l2 (to 3)
    const result = neighbours(graph, 2);
    const ids = result.map((n) => n.noteId);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
    expect(ids).not.toContain(4);
  });

  it('returns empty array for isolated node', () => {
    const g = buildGraph([note(5, 'Isolated')], []);
    expect(neighbours(g, 5)).toHaveLength(0);
  });

  it('returns empty array for unknown note id', () => {
    expect(neighbours(graph, 999)).toHaveLength(0);
  });
});

// ── subgraph ──────────────────────────────────────────────────────────────────

describe('subgraph', () => {
  const graph = buildGraph(NOTES, LINKS);

  it('depth=0 returns only the start node', () => {
    const result = subgraph(graph, 1, 0);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].noteId).toBe(1);
    expect(result.edges).toHaveLength(0);
  });

  it('depth=1 returns the start node and its direct neighbours', () => {
    const result = subgraph(graph, 1, 1);
    const ids = result.nodes.map((n) => n.noteId).sort();
    // 1 → 2 and 1 → 4, so neighbours are 2 and 4
    expect(ids).toEqual([1, 2, 4]);
  });

  it('depth=2 (default) follows two hops', () => {
    const result = subgraph(graph, 1); // default depth 2
    const ids = result.nodes.map((n) => n.noteId).sort();
    // hop 1: 2, 4; hop 2 from 2: 3
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it('includes only edges where both endpoints are in the subgraph', () => {
    const result = subgraph(graph, 1, 1);
    // Nodes: 1, 2, 4. Edges: l1 (1→2) and l3 (1→4). l2 (2→3) excluded.
    expect(result.edges.map((e) => e.id).sort()).toEqual(['l1', 'l3']);
  });

  it('returns empty for unknown start node', () => {
    const result = subgraph(graph, 999);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});

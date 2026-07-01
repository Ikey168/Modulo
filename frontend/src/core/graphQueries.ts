// Pure graph query functions over CoreNote / CoreLink arrays (#294).
// No network calls, no React, no Graphology — just data transforms.
// Used by CoreAPIImpl to answer graph() / filterGraphByTags() / neighbours() /
// subgraph() queries, and exported from the barrel so pack authors can run the
// same queries locally on data they've already fetched.

import type { CoreLink, CoreNote, GraphEdgeData, GraphNodeData, GraphQueryResult } from './types';

/** Build a GraphQueryResult from flat note and link arrays. */
export function buildGraph(notes: CoreNote[], links: CoreLink[]): GraphQueryResult {
  const connectionCounts = new Map<number, number>();
  for (const l of links) {
    connectionCounts.set(l.sourceNoteId, (connectionCounts.get(l.sourceNoteId) ?? 0) + 1);
    connectionCounts.set(l.targetNoteId, (connectionCounts.get(l.targetNoteId) ?? 0) + 1);
  }

  const nodes: GraphNodeData[] = notes.map((n) => ({
    id: String(n.id),
    noteId: n.id,
    title: n.title,
    tags: n.tags.map((t) => t.name),
    connectionCount: connectionCounts.get(n.id) ?? 0,
  }));

  const edges: GraphEdgeData[] = links.map((l) => ({
    id: l.id,
    sourceId: String(l.sourceNoteId),
    targetId: String(l.targetNoteId),
    linkType: l.linkType,
  }));

  return { nodes, edges };
}

/**
 * Return the subset of a graph whose nodes carry at least one of the given
 * tag names (case-insensitive substring match). Edges are only included when
 * both endpoints survive the filter.
 */
export function filterGraphByTags(
  graph: GraphQueryResult,
  tagNames: string[],
): GraphQueryResult {
  if (tagNames.length === 0) return graph;

  const lower = tagNames.map((t) => t.toLowerCase());
  const filteredNodes = graph.nodes.filter((n) =>
    n.tags.some((tag) => lower.some((q) => tag.toLowerCase().includes(q))),
  );
  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => filteredIds.has(e.sourceId) && filteredIds.has(e.targetId),
  );
  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Return nodes directly connected to the given note (one hop, both directions).
 */
export function neighbours(graph: GraphQueryResult, noteId: number): GraphNodeData[] {
  const nodeId = String(noteId);
  const neighbourIds = new Set<string>();
  for (const e of graph.edges) {
    if (e.sourceId === nodeId) neighbourIds.add(e.targetId);
    if (e.targetId === nodeId) neighbourIds.add(e.sourceId);
  }
  return graph.nodes.filter((n) => neighbourIds.has(n.id));
}

/**
 * Return the subgraph reachable from `noteId` within `depth` hops using
 * bidirectional BFS. Default depth is 2.
 */
export function subgraph(
  graph: GraphQueryResult,
  noteId: number,
  depth = 2,
): GraphQueryResult {
  const startId = String(noteId);

  const adj = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!adj.has(e.sourceId)) adj.set(e.sourceId, new Set());
    if (!adj.has(e.targetId)) adj.set(e.targetId, new Set());
    adj.get(e.sourceId)!.add(e.targetId);
    adj.get(e.targetId)!.add(e.sourceId);
  }

  const visited = new Set<string>([startId]);
  let frontier = new Set<string>([startId]);
  for (let d = 0; d < depth && frontier.size > 0; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          next.add(nb);
        }
      }
    }
    frontier = next;
  }

  const subNodes = graph.nodes.filter((n) => visited.has(n.id));
  const subEdges = graph.edges.filter(
    (e) => visited.has(e.sourceId) && visited.has(e.targetId),
  );
  return { nodes: subNodes, edges: subEdges };
}

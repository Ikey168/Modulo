import { api } from '../../../services/api';

// Mirrors the backend DTOs in com.modulo.graph.dto.

export interface Backlink {
  id: number;
  title: string;
  snippet: string;
}

export interface UnlinkedMention {
  id: number;
  title: string;
  snippet: string;
  matchedText: string;
}

export interface RelatedNote {
  id: number;
  title: string;
  score: number;
  snippet: string;
}

export interface GraphNode {
  id: number;
  title: string;
}

export interface GraphEdge {
  source: number;
  target: number;
  type: string;
}

export interface Neighborhood {
  center: number;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphStatus {
  available: boolean;
  nodeCount: number;
}

export const graphApi = {
  /** #251 — notes linking to this note. */
  getBacklinks: (noteId: number): Promise<Backlink[]> =>
    api.get(`/graph/notes/${noteId}/backlinks`),

  /** #252 — notes mentioning this note's title without linking it. */
  getUnlinkedMentions: (noteId: number): Promise<UnlinkedMention[]> =>
    api.get(`/graph/notes/${noteId}/unlinked-mentions`),

  /** #253 — structurally related notes. */
  getRelated: (noteId: number, limit = 10): Promise<RelatedNote[]> =>
    api.get(`/graph/notes/${noteId}/related?limit=${limit}`),

  /** #254 — local subgraph around this note. */
  getNeighborhood: (noteId: number, depth = 1): Promise<Neighborhood> =>
    api.get(`/graph/notes/${noteId}/neighborhood?depth=${depth}`),

  /** #252 — create a link FROM sourceId TO noteId (the "Link" action). */
  linkFrom: (noteId: number, sourceId: number, linkType = 'REFERENCE') =>
    api.post(`/graph/notes/${noteId}/link-from/${sourceId}?linkType=${linkType}`, {}),

  /** Projection availability + node count. */
  getStatus: (): Promise<GraphStatus> => api.get('/graph/status'),
};

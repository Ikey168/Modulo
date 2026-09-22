import type { CoreLink, CoreNote } from '@modulo/core';
import { isAnchored } from './workspaceUtils';

export interface GraphViewInputNode {
  id: number;
  title: string;
  anchored: boolean;
}

export interface GraphViewInputLink {
  source: number;
  target: number;
}

export interface GraphViewInput {
  key: string;
  nodes: GraphViewInputNode[];
  links: GraphViewInputLink[];
}

/**
 * Keep graph input deterministic and independent from transient React array
 * identities. Workspace synchronization can recreate otherwise identical note
 * and link arrays; treating that as a topology change makes the force layout
 * jump back to its initial positions.
 */
export function createGraphViewInput(notes: CoreNote[], links: CoreLink[]): GraphViewInput {
  const nodes = notes
    .map((note) => ({ id: note.id, title: note.title, anchored: isAnchored(note) }))
    .sort((a, b) => a.id - b.id);
  const noteIds = new Set(nodes.map((node) => node.id));
  const graphLinks = links
    .filter((link) => noteIds.has(link.sourceNoteId) && noteIds.has(link.targetNoteId))
    .map((link) => ({ source: link.sourceNoteId, target: link.targetNoteId }))
    .sort((a, b) => a.source - b.source || a.target - b.target);

  return {
    key: JSON.stringify([
      nodes.map((node) => [node.id, node.title, node.anchored]),
      graphLinks.map((link) => [link.source, link.target]),
    ]),
    nodes,
    links: graphLinks,
  };
}

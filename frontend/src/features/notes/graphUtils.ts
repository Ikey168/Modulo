import { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import louvain from 'graphology-communities-louvain';

export interface Note {
  id: number;
  title: string;
  content: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface NoteLink {
  id: string;
  sourceNote: Note;
  targetNote: Note;
  linkType: string;
}

export interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  size: number;
  color: string;
  community?: number;
  tags: string[];
  connectionCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  color: string;
  size: number;
}

export const LINK_TYPE_COLORS = {
  RELATED: '#3b82f6',
  REFERENCES: '#10b981',
  DEPENDS_ON: '#f59e0b',
  PART_OF: '#8b5cf6',
  CONTRADICTS: '#ef4444',
  SUPPORTS: '#06d6a0',
  EXTENDS: '#ff6b6b',
  EXAMPLE_OF: '#ffd23f'
} as const;

export const COMMUNITY_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
  '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
  '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'
];

export function createGraphFromData(notes: Note[], links: NoteLink[]): DirectedGraph {
  const graph = new DirectedGraph();

  // Add nodes
  notes.forEach(note => {
    const connections = links.filter(link => 
      link.sourceNote.id === note.id || link.targetNote.id === note.id
    ).length;
    
    const size = Math.max(10, Math.min(30, 10 + connections * 3));
    
    graph.addNode(note.id.toString(), {
      label: note.title.length > 30 ? note.title.substring(0, 30) + '...' : note.title,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      size,
      color: '#6366f1', // Will be overridden by community detection
      tags: note.tags?.map(tag => tag.name) || [],
      connectionCount: connections,
      originalNote: note
    });
  });

  // Add edges
  links.forEach(link => {
    const sourceId = link.sourceNote.id.toString();
    const targetId = link.targetNote.id.toString();
    
    if (graph.hasNode(sourceId) && graph.hasNode(targetId)) {
      graph.addDirectedEdge(sourceId, targetId, {
        id: link.id,
        label: link.linkType.replace('_', ' '),
        type: link.linkType,
        color: LINK_TYPE_COLORS[link.linkType as keyof typeof LINK_TYPE_COLORS] || '#666666',
        size: 2
      });
    }
  });

  return graph;
}

export function applyCommunityDetection(graph: DirectedGraph): void {
  try {
    const communities = louvain(graph);
    
    graph.forEachNode((node) => {
      const community = communities[node];
      const communityColor = COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
      graph.setNodeAttribute(node, 'color', communityColor);
      graph.setNodeAttribute(node, 'community', community);
    });
  } catch (error) {
    console.warn('Community detection failed:', error);
    // Fallback: assign random colors
    graph.forEachNode((node) => {
      const randomColor = COMMUNITY_COLORS[Math.floor(Math.random() * COMMUNITY_COLORS.length)];
      graph.setNodeAttribute(node, 'color', randomColor);
    });
  }
}

export function applyForceAtlas2Layout(graph: DirectedGraph): void {
  try {
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, {
      iterations: 50,
      settings: {
        ...settings,
        strongGravityMode: true,
        gravity: 0.05,
        scalingRatio: 10,
        slowDown: 2,
        adjustSizes: false,
        barnesHutOptimize: graph.order > 500
      }
    });
  } catch (error) {
    console.warn('Layout application failed:', error);
    // Fallback: use random positioning
    graph.forEachNode((node) => {
      graph.setNodeAttribute(node, 'x', Math.random() * 1000);
      graph.setNodeAttribute(node, 'y', Math.random() * 1000);
    });
  }
}

export function getGraphStatistics(graph: DirectedGraph) {
  const nodeCount = graph.order;
  const edgeCount = graph.size;
  const communities = new Set();
  
  graph.forEachNode((node) => {
    const community = graph.getNodeAttribute(node, 'community');
    if (community !== undefined) {
      communities.add(community);
    }
  });

  // Calculate centrality metrics
  const degreeCentrality: Record<string, number> = {};
  graph.forEachNode((node) => {
    degreeCentrality[node] = graph.degree(node);
  });

  const mostConnectedNode = Object.entries(degreeCentrality)
    .sort(([,a], [,b]) => b - a)[0];

  return {
    nodeCount,
    edgeCount,
    communityCount: communities.size,
    mostConnectedNode: mostConnectedNode ? {
      id: mostConnectedNode[0],
      connections: mostConnectedNode[1],
      label: graph.getNodeAttribute(mostConnectedNode[0], 'label')
    } : null,
    averageConnections: nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0
  };
}

export function filterGraphByTags(graph: DirectedGraph, selectedTags: string[]): DirectedGraph {
  if (selectedTags.length === 0) return graph;

  const filteredGraph = new DirectedGraph();
  
  // Add nodes that have at least one of the selected tags
  graph.forEachNode((node, attributes) => {
    const nodeTags: string[] = attributes.tags || [];
    const hasSelectedTag = selectedTags.some(tag => 
      nodeTags.some((nodeTag: string) => 
        nodeTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    if (hasSelectedTag) {
      filteredGraph.addNode(node, attributes);
    }
  });

  // Add edges between filtered nodes
  graph.forEachEdge((_edge, attributes, source, target) => {
    if (filteredGraph.hasNode(source) && filteredGraph.hasNode(target)) {
      filteredGraph.addDirectedEdge(source, target, attributes);
    }
  });

  return filteredGraph;
}

export function searchNodes(graph: DirectedGraph, query: string): string[] {
  if (!query.trim()) return [];
  
  const matches: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  graph.forEachNode((node, attributes) => {
    const label = attributes.label?.toLowerCase() || '';
    const tags = attributes.tags || [];
    
    if (label.includes(lowerQuery) || 
        tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) {
      matches.push(node);
    }
  });
  
  return matches;
}

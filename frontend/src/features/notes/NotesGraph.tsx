// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import { DirectedGraph } from 'graphology';
import { createCoreAPI } from '@modulo/core';
import type { CoreNote, CoreLink } from '@modulo/core';
import { useNotesSync } from '../../hooks/useWebSocket';
import { NoteUpdateMessage } from '../../services/websocket';
import {
  createGraphFromData,
  applyCommunityDetection,
  applyForceAtlas2Layout,
  getGraphStatistics,
  filterGraphByTags,
  searchNodes,
  LINK_TYPE_COLORS
} from './graphUtils';
import { Button, Input, Label, Spinner } from '@/ui';
import './NotesGraph.css';

// Import Sigma.js CSS
import '@react-sigma/core/lib/react-sigma.min.css';

/** Convert CoreLink[] to the shape createGraphFromData expects. */
function toGraphLinks(
  coreLinks: CoreLink[],
  noteById: Map<number, CoreNote>,
) {
  const result = [];
  for (const l of coreLinks) {
    const src = noteById.get(l.sourceNoteId);
    const tgt = noteById.get(l.targetNoteId);
    if (src && tgt) result.push({ id: l.id, sourceNote: src, targetNote: tgt, linkType: l.linkType });
  }
  return result;
}

const GraphLoader: React.FC<{ graph: DirectedGraph }> = ({ graph }) => {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();

  useEffect(() => {
    applyCommunityDetection(graph);
    applyForceAtlas2Layout(graph);

    loadGraph(graph);

    sigma.on('enterNode', ({ node }) => {
      sigma.getGraph().setNodeAttribute(node, 'highlighted', true);
      sigma.getGraph().forEachEdge(node, (edge) => {
        sigma.getGraph().setEdgeAttribute(edge, 'highlighted', true);
      });
      sigma.refresh();
    });

    sigma.on('leaveNode', ({ node }) => {
      sigma.getGraph().setNodeAttribute(node, 'highlighted', false);
      sigma.getGraph().forEachEdge(node, (edge) => {
        sigma.getGraph().setEdgeAttribute(edge, 'highlighted', false);
      });
      sigma.refresh();
    });
  }, [loadGraph, sigma, graph]);

  return null;
};

const GraphEvents: React.FC<{ onNodeClick: (nodeId: string) => void }> = ({ onNodeClick }) => {
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => {
        onNodeClick(node);
      }
    });
  }, [registerEvents, onNodeClick]);

  return null;
};

const NotesGraph: React.FC = () => {
  const api = useMemo(() => createCoreAPI(), []);

  const [notes, setNotes] = useState<CoreNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<CoreNote | null>(null);
  const [graph, setGraph] = useState<DirectedGraph>(new DirectedGraph());
  const [filteredGraph, setFilteredGraph] = useState<DirectedGraph>(new DirectedGraph());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [graphStats, setGraphStats] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Two parallel requests instead of O(n) serial link fetches.
      const [coreNotes, coreLinks] = await Promise.all([api.notes(), api.links()]);
      setNotes(coreNotes);

      const allTags = new Set<string>();
      for (const note of coreNotes) {
        note.tags?.forEach(tag => allTags.add(tag.name));
      }
      setAvailableTags(Array.from(allTags));

      const noteById = new Map(coreNotes.map(n => [n.id, n]));
      const graphLinks = toGraphLinks(coreLinks, noteById);

      const newGraph = createGraphFromData(coreNotes, graphLinks);
      setGraph(newGraph);
      setFilteredGraph(newGraph);
      setGraphStats(getGraphStatistics(newGraph));

    } catch (err) {
      setError('Failed to load graph data');
      console.error('Error loading graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGraphUpdate = useCallback((message: NoteUpdateMessage) => {
    console.log('Received real-time graph update:', message);

    switch (message.eventType) {
      case 'NOTE_CREATED':
      case 'NOTE_UPDATED':
      case 'NOTE_DELETED':
      case 'NOTE_LINK_CREATED':
      case 'NOTE_LINK_DELETED':
        loadData();
        break;

      default:
        console.log('Unknown graph update message type:', message.eventType);
    }
  }, []);

  useNotesSync(handleGraphUpdate);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    applyFilters(selectedTags, query);
  }, [selectedTags]);

  const handleTagFilter = useCallback((tags: string[]) => {
    setSelectedTags(tags);
    applyFilters(tags, searchQuery);
  }, [searchQuery]);

  const applyFilters = useCallback((tags: string[], query: string) => {
    let filtered = graph;

    if (tags.length > 0) {
      filtered = filterGraphByTags(filtered, tags);
    }

    if (query.trim()) {
      const matchingNodes = searchNodes(filtered, query);
      const searchGraph = new DirectedGraph();

      matchingNodes.forEach(nodeId => {
        if (filtered.hasNode(nodeId)) {
          searchGraph.addNode(nodeId, filtered.getNodeAttributes(nodeId));

          filtered.forEachNeighbor(nodeId, (neighbor) => {
            if (!searchGraph.hasNode(neighbor)) {
              searchGraph.addNode(neighbor, filtered.getNodeAttributes(neighbor));
            }
            filtered.forEachEdge(nodeId, neighbor, (_edge, attributes) => {
              if (!searchGraph.hasEdge(nodeId, neighbor)) {
                searchGraph.addDirectedEdge(nodeId, neighbor, attributes);
              }
            });
          });
        }
      });

      filtered = searchGraph;
    }

    setFilteredGraph(filtered);
    setGraphStats(getGraphStatistics(filtered));
  }, [graph]);

  const handleNodeClick = useCallback((nodeId: string) => {
    const note = notes.find(n => n.id.toString() === nodeId);
    if (note) setSelectedNote(note);
  }, [notes]);

  const handleCloseModal = () => setSelectedNote(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters(selectedTags, searchQuery);
  }, [graph, applyFilters, selectedTags, searchQuery]);

  if (loading) {
    return (
      <div className="notes-graph-container">
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
          <Spinner className="size-10 text-primary" />
          <p className="m-0 text-[13px] text-muted-foreground">Loading notes graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notes-graph-container">
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
          <p className="m-0 text-[13px] text-destructive">Error: {error}</p>
          <Button onClick={loadData} variant="primary" size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-graph-container">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4 max-md:flex-col max-md:items-stretch">
        <h1 className="m-0 text-2xl font-bold text-foreground">Notes Graph</h1>
        {graphStats && (
          <div className="flex gap-8 max-md:justify-center">
            <span className="text-[13px] text-muted-foreground">
              <strong className="text-lg text-foreground">{graphStats.nodeCount}</strong> notes
            </span>
            <span className="text-[13px] text-muted-foreground">
              <strong className="text-lg text-foreground">{graphStats.edgeCount}</strong> connections
            </span>
            <span className="text-[13px] text-muted-foreground">
              <strong className="text-lg text-foreground">{graphStats.communityCount}</strong> communities
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={loadData} variant="secondary" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 rounded-lg border border-border bg-surface p-4 max-md:flex-col max-md:gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {availableTags.length > 0 && (
          <div className="flex min-w-[200px] flex-col gap-2 max-md:min-w-0">
            <Label>Filter by tags:</Label>
            <select
              multiple
              value={selectedTags}
              onChange={(e) => {
                const tags = Array.from(e.target.selectedOptions, option => option.value);
                handleTagFilter(tags);
              }}
              className="max-h-[100px] w-full overflow-y-auto rounded-md border border-border-strong bg-surface-2 p-2 text-[13px] text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h3 className="m-0 mb-3 text-sm font-semibold text-foreground">Link Types</h3>
        <div className="flex flex-wrap gap-4 max-md:justify-center">
          {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <div
                className="size-3 rounded-sm"
                style={{ backgroundColor: color }}
              ></div>
              <span>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <SigmaContainer
          style={{ height: '600px', width: '100%', backgroundColor: '#111114' }}
          settings={{
            defaultNodeColor: '#6366f1',
            defaultEdgeColor: '#2a2a30',
            labelColor: { color: '#a1a1aa' },
            labelFont: 'Arial',
            labelSize: 12,
            labelWeight: 'normal',
            zIndex: true
          }}
        >
          <GraphLoader graph={filteredGraph} />
          <GraphEvents onNodeClick={handleNodeClick} />
        </SigmaContainer>
      </div>

      {selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
          onClick={handleCloseModal}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-border-strong bg-popover shadow-lg animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <h2 className="m-0 text-lg font-semibold text-foreground">{selectedNote.title}</h2>
              <button
                className="flex size-8 items-center justify-center rounded-md text-xl leading-none text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedNote.tags && selectedNote.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {selectedNote.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-subtle-foreground">
                <pre className="m-0 whitespace-pre-wrap break-words font-mono leading-relaxed">{selectedNote.content}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesGraph;

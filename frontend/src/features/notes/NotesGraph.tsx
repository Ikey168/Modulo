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
        <div className="notes-graph-loading">
          <div className="loading-spinner"></div>
          <p>Loading notes graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notes-graph-container">
        <div className="notes-graph-error">
          <p>Error: {error}</p>
          <button onClick={loadData} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-graph-container">
      <div className="notes-graph-header">
        <h1>Notes Graph</h1>
        {graphStats && (
          <div className="graph-stats">
            <span className="stat">
              <strong>{graphStats.nodeCount}</strong> notes
            </span>
            <span className="stat">
              <strong>{graphStats.edgeCount}</strong> connections
            </span>
            <span className="stat">
              <strong>{graphStats.communityCount}</strong> communities
            </span>
          </div>
        )}
        <div className="graph-controls">
          <button onClick={loadData} className="btn btn-secondary btn-small">
            Refresh
          </button>
        </div>
      </div>

      <div className="graph-search-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {availableTags.length > 0 && (
          <div className="filter-section">
            <label>Filter by tags:</label>
            <select
              multiple
              value={selectedTags}
              onChange={(e) => {
                const tags = Array.from(e.target.selectedOptions, option => option.value);
                handleTagFilter(tags);
              }}
              className="tag-filter"
            >
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="notes-graph-legend">
        <h3>Link Types</h3>
        <div className="legend-items">
          {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: color }}
              ></div>
              <span>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="notes-graph-viewport">
        <SigmaContainer
          style={{ height: '600px', width: '100%' }}
          settings={{
            defaultNodeColor: '#6366f1',
            defaultEdgeColor: '#e5e7eb',
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
        <div className="note-modal-overlay" onClick={handleCloseModal}>
          <div className="note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="note-modal-header">
              <h2>{selectedNote.title}</h2>
              <button
                className="note-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="note-modal-content">
              {selectedNote.tags && selectedNote.tags.length > 0 && (
                <div className="note-tags">
                  {selectedNote.tags.map((tag, index) => (
                    <span key={index} className="note-tag">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="note-content">
                <pre>{selectedNote.content}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesGraph;

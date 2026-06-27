// @ts-nocheck
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents } from '@react-sigma/core';
import { DirectedGraph } from 'graphology';
import { applyForceAtlas2Layout } from '../graphUtils';
import { graphApi, Neighborhood } from './graphApi';
import {
  GraphFilters,
  SavedView,
  DEFAULT_FILTERS,
  loadSavedViews,
  saveView,
  deleteView,
} from './savedViews';
import '@react-sigma/core/lib/react-sigma.min.css';

interface Props {
  noteId: number;
  onOpenNote: (noteId: number) => void;
  refreshKey?: number;
}

const CENTER_COLOR = '#ef4444';
const NODE_COLOR = '#6366f1';
const EDGE_COLOR = '#cbd5e1';

/** Builds a graphology graph from a neighborhood response, applying the link-type filter. */
function buildGraph(data: Neighborhood, linkTypes: string[]): DirectedGraph {
  const graph = new DirectedGraph();
  data.nodes.forEach((n) => {
    const isCenter = n.id === data.center;
    graph.addNode(String(n.id), {
      label: n.title || `Note #${n.id}`,
      size: isCenter ? 16 : 11,
      color: isCenter ? CENTER_COLOR : NODE_COLOR,
      x: Math.random() * 100,
      y: Math.random() * 100,
    });
  });
  data.edges.forEach((e) => {
    if (linkTypes.length > 0 && !linkTypes.includes(e.type)) {
      return;
    }
    const s = String(e.source);
    const t = String(e.target);
    if (graph.hasNode(s) && graph.hasNode(t) && !graph.hasEdge(s, t)) {
      graph.addDirectedEdge(s, t, { size: 1.5, color: EDGE_COLOR, type: e.type });
    }
  });
  return graph;
}

const GraphLoader: React.FC<{ graph: DirectedGraph; onOpenNote: (id: number) => void }> = ({
  graph,
  onOpenNote,
}) => {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    if (graph.order > 0) {
      applyForceAtlas2Layout(graph);
    }
    loadGraph(graph);
  }, [loadGraph, graph]);

  useEffect(() => {
    registerEvents({ clickNode: ({ node }) => onOpenNote(Number(node)) });
  }, [registerEvents, onOpenNote]);

  return null;
};

/** #254 — focused local graph for the open note plus configurable filters / saved views. */
const LocalGraphPanel: React.FC<Props> = ({ noteId, onOpenNote, refreshKey }) => {
  const [data, setData] = useState<Neighborhood | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [views, setViews] = useState<SavedView[]>(() => loadSavedViews());
  const [viewName, setViewName] = useState('');

  const load = useCallback(
    async (depth: number) => {
      setLoading(true);
      setError(null);
      try {
        setData(await graphApi.getNeighborhood(noteId, depth));
      } catch (e) {
        setError('Failed to load local graph');
      } finally {
        setLoading(false);
      }
    },
    [noteId]
  );

  useEffect(() => {
    load(filters.depth);
  }, [load, filters.depth, refreshKey]);

  const availableLinkTypes = useMemo(() => {
    const types = new Set<string>();
    data?.edges.forEach((e) => e.type && types.add(e.type));
    return Array.from(types).sort();
  }, [data]);

  const graph = useMemo(
    () => (data ? buildGraph(data, filters.linkTypes) : new DirectedGraph()),
    [data, filters.linkTypes]
  );

  const handleSaveView = () => {
    const name = viewName.trim();
    if (!name) {
      return;
    }
    setViews(saveView(name, filters));
    setViewName('');
  };

  const handleApplyView = (view: SavedView) => setFilters(view.filters);

  const handleDeleteView = (id: string) => setViews(deleteView(id));

  return (
    <div className="local-graph">
      <div className="local-graph-controls">
        <label className="local-graph-control">
          Depth
          <select
            value={filters.depth}
            onChange={(e) => setFilters({ ...filters, depth: Number(e.target.value) })}
          >
            <option value={1}>1 hop</option>
            <option value={2}>2 hops</option>
            <option value={3}>3 hops</option>
          </select>
        </label>

        {availableLinkTypes.length > 0 && (
          <label className="local-graph-control">
            Link types
            <select
              multiple
              value={filters.linkTypes}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  linkTypes: Array.from(e.target.selectedOptions, (o) => o.value),
                })
              }
            >
              {availableLinkTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="local-graph-control saved-views">
          <div className="saved-views-save">
            <input
              type="text"
              placeholder="Save view as…"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
            <button className="graph-link-btn" onClick={handleSaveView} disabled={!viewName.trim()}>
              Save
            </button>
          </div>
          {views.length > 0 && (
            <div className="saved-views-list">
              {views.map((v) => (
                <span key={v.id} className="saved-view-chip">
                  <button className="saved-view-apply" onClick={() => handleApplyView(v)}>
                    {v.name}
                  </button>
                  <button
                    className="saved-view-delete"
                    title="Delete view"
                    onClick={() => handleDeleteView(v.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="graph-panel-state">Loading local graph…</div>}
      {error && (
        <div className="graph-panel-state graph-panel-error">
          {error} <button className="graph-link-btn" onClick={() => load(filters.depth)}>Retry</button>
        </div>
      )}
      {!loading && !error && graph.order <= 1 && (
        <div className="graph-panel-state graph-panel-empty">
          This note has no links yet — link it to other notes to grow its local graph.
        </div>
      )}
      {!loading && !error && graph.order > 1 && (
        <div className="local-graph-viewport">
          <SigmaContainer
            style={{ height: '360px', width: '100%' }}
            settings={{
              defaultNodeColor: NODE_COLOR,
              defaultEdgeColor: EDGE_COLOR,
              labelSize: 11,
              labelWeight: 'normal',
              renderEdgeLabels: false,
            }}
          >
            <GraphLoader graph={graph} onOpenNote={onOpenNote} />
          </SigmaContainer>
        </div>
      )}
    </div>
  );
};

export default LocalGraphPanel;

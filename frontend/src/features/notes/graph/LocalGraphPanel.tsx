import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents } from '@react-sigma/core';
import { DirectedGraph } from 'graphology';
import { applyForceAtlas2Layout } from '../graphUtils';
import { tokenColor } from '../theme/tokens';
import { graphApi, Neighborhood } from './graphApi';
import {
  GraphFilters,
  SavedView,
  DEFAULT_FILTERS,
  loadSavedViews,
  saveView,
  deleteView,
} from './savedViews';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/ui';
import { X } from 'lucide-react';
import '@react-sigma/core/lib/style.css';

interface Props {
  noteId: number;
  onOpenNote: (noteId: number) => void;
  refreshKey?: number;
}

/** Node/edge palette resolved from design tokens at render time. */
interface GraphPalette {
  center: string;
  node: string;
  edge: string;
  label: string;
}

/** Builds a graphology graph from a neighborhood response, applying the link-type filter. */
function buildGraph(data: Neighborhood, linkTypes: string[], palette: GraphPalette): DirectedGraph {
  const graph = new DirectedGraph();
  data.nodes.forEach((n) => {
    const isCenter = n.id === data.center;
    graph.addNode(String(n.id), {
      label: n.title || `Note #${n.id}`,
      size: isCenter ? 16 : 11,
      color: isCenter ? palette.center : palette.node,
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
      graph.addDirectedEdge(s, t, { size: 1.5, color: palette.edge, type: e.type });
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

  // Resolved once per data refresh so canvas colors track the active theme.
  const palette = useMemo<GraphPalette>(
    () => ({
      center: tokenColor('destructive'),
      node: tokenColor('primary-hover'),
      edge: tokenColor('border-strong'),
      label: tokenColor('subtle-foreground'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );

  const graph = useMemo(
    () => (data ? buildGraph(data, filters.linkTypes, palette) : new DirectedGraph()),
    [data, filters.linkTypes, palette]
  );

  const sigmaSettings = useMemo(
    () => ({
      defaultNodeColor: palette.node,
      defaultEdgeColor: palette.edge,
      labelSize: 11,
      labelWeight: 'normal',
      labelColor: { color: palette.label },
      renderEdgeLabels: false,
    }),
    [palette]
  );

  const sigmaStyle = useMemo(
    () =>
      ({
        height: '360px',
        width: '100%',
        // The vendor stylesheet paints the canvas white via this variable;
        // repoint it at the panel surface token.
        '--sigma-background-color': 'hsl(var(--surface))',
      }) as React.CSSProperties,
    []
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
    <div>
      <div className="mb-3 flex flex-wrap items-start gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Depth
          <Select
            value={String(filters.depth)}
            onValueChange={(val) => setFilters({ ...filters, depth: Number(val) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hop</SelectItem>
              <SelectItem value="2">2 hops</SelectItem>
              <SelectItem value="3">3 hops</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {availableLinkTypes.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Link types
            <select
              multiple
              aria-label="Filter by link types"
              value={filters.linkTypes}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  linkTypes: Array.from(e.target.selectedOptions, (o) => o.value),
                })
              }
              className="rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-[13px] text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {availableLinkTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <Label className="text-xs font-normal text-muted-foreground">Saved views</Label>
          <div className="flex gap-1.5">
            <Input
              type="text"
              placeholder="Save view as…"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="h-8 w-40"
            />
            <Button variant="primary" size="sm" onClick={handleSaveView} disabled={!viewName.trim()}>
              Save
            </Button>
          </div>
          {views.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {views.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center overflow-hidden rounded-full border border-border bg-surface-2"
                >
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleApplyView(v)}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    className="flex items-center px-2 py-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Delete view ${v.name}`}
                    title="Delete view"
                    onClick={() => handleDeleteView(v.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div aria-busy="true" aria-label="Loading local graph">
          <Skeleton className="h-[360px] w-full rounded-lg" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3.5 text-[13px] text-destructive">
          {error}{' '}
          <Button variant="outline" size="sm" onClick={() => load(filters.depth)}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && graph.order <= 1 && (
        <div className="p-3.5 text-[13px] italic text-muted-foreground">
          This note has no links yet — link it to other notes to grow its local graph.
        </div>
      )}
      {!loading && !error && graph.order > 1 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <SigmaContainer style={sigmaStyle} settings={sigmaSettings}>
            <GraphLoader graph={graph} onOpenNote={onOpenNote} />
          </SigmaContainer>
        </div>
      )}
    </div>
  );
};

export default LocalGraphPanel;

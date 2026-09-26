// issue 254 — named, persisted graph filters ("saved views"), stored as server workspace state.

import { useServerWorkspaceStore } from '../../workspace/useWorkspaceStore';

export interface GraphFilters {
  tags: string[];
  linkTypes: string[];
  /** ISO date (yyyy-mm-dd); notes updated on/after this date. Empty = no bound. */
  updatedAfter: string;
  /** Local-graph hop depth. */
  depth: number;
}

export interface SavedView {
  id: string;
  name: string;
  filters: GraphFilters;
  createdAt: string;
}

const STORAGE_KEY = 'modulo.graph.savedViews';

export const DEFAULT_FILTERS: GraphFilters = {
  tags: [],
  linkTypes: [],
  updatedAfter: '',
  depth: 1,
};

export function parseSavedViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const v = raw as Record<string, unknown>;
    const f = (typeof v.filters === 'object' && v.filters !== null ? v.filters : {}) as Record<string, unknown>;
    if (typeof v.id !== 'string' || typeof v.name !== 'string') return [];
    const strings = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
    return [{
      id: v.id,
      name: v.name,
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : '',
      filters: {
        tags: strings(f.tags),
        linkTypes: strings(f.linkTypes),
        updatedAfter: typeof f.updatedAfter === 'string' ? f.updatedAfter : '',
        depth: typeof f.depth === 'number' ? f.depth : DEFAULT_FILTERS.depth,
      },
    }];
  });
}

/** Saved views are workspace state on the server, shared by every device. */
export function useSavedGraphViews() {
  return useServerWorkspaceStore<SavedView[]>(
    'graph-views', 'views', 'modulo.workspace.graph.saved-views', [], parseSavedViews, STORAGE_KEY, 'Graph saved views');
}

export function saveView(views: SavedView[], name: string, filters: GraphFilters): SavedView[] {
  const existing = views.find((v) => v.name === name);
  if (existing) return views.map((v) => (v === existing ? { ...v, filters } : v));
  return [
    ...views,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function deleteView(views: SavedView[], id: string): SavedView[] {
  return views.filter((v) => v.id !== id);
}

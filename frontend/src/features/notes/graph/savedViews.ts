// #254 — named, persisted graph filters ("saved views"), stored in localStorage.

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

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

function persist(views: SavedView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    /* storage full / unavailable — saved views are best-effort */
  }
}

export function saveView(name: string, filters: GraphFilters): SavedView[] {
  const views = loadSavedViews();
  const existing = views.find((v) => v.name === name);
  if (existing) {
    existing.filters = filters;
  } else {
    views.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters,
      createdAt: new Date().toISOString(),
    });
  }
  persist(views);
  return loadSavedViews();
}

export function deleteView(id: string): SavedView[] {
  const views = loadSavedViews().filter((v) => v.id !== id);
  persist(views);
  return views;
}

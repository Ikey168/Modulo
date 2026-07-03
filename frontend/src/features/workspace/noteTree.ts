// Notion-style note hierarchy, modelled entirely on the client (the backend
// CoreNote has no parent/order fields yet). A small map of noteId → {parent,
// order} is persisted to localStorage and layered over the flat note list to
// produce a draggable, collapsible tree with subnotes.

import { useCallback, useMemo, useState } from 'react';
import type { CoreNote } from '@modulo/core';

export type DropPos = 'before' | 'after' | 'inside';

interface Entry {
  parent: number | null;
  order: number;
}
export type TreeMap = Record<number, Entry>;

export interface TreeNode {
  note: CoreNote;
  depth: number;
  children: TreeNode[];
}

const TREE_KEY = 'modulo-note-tree';
const COLLAPSE_KEY = 'modulo-note-collapsed';
const END = Number.MAX_SAFE_INTEGER;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/unavailable — state still applies for this session */
  }
}

const parentOf = (map: TreeMap, id: number): number | null => map[id]?.parent ?? null;

/** True when `id` sits somewhere under `maybeAncestor` (prevents drop cycles). */
export function isDescendant(map: TreeMap, id: number, maybeAncestor: number): boolean {
  let cur = parentOf(map, id);
  const guard = new Set<number>();
  while (cur != null && !guard.has(cur)) {
    if (cur === maybeAncestor) return true;
    guard.add(cur);
    cur = parentOf(map, cur);
  }
  return false;
}

function orderedSiblings(map: TreeMap, notes: CoreNote[], parent: number | null, present: Set<number>): number[] {
  const effParent = (id: number): number | null => {
    const p = parentOf(map, id);
    return p != null && present.has(p) ? p : null; // orphans float to the top level
  };
  return notes
    .filter((n) => effParent(n.id) === parent)
    .sort((a, b) => (map[a.id]?.order ?? END) - (map[b.id]?.order ?? END) || a.id - b.id)
    .map((n) => n.id);
}

/** Builds the nested forest from the flat note list and the tree map. */
export function buildForest(map: TreeMap, notes: CoreNote[]): TreeNode[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const present = new Set(byId.keys());
  const build = (parent: number | null, depth: number): TreeNode[] =>
    orderedSiblings(map, notes, parent, present).map((id) => ({
      note: byId.get(id)!,
      depth,
      children: build(id, depth + 1),
    }));
  return build(null, 0);
}

/** Returns a new map with `dragId` moved relative to `targetId`. */
export function moveNote(map: TreeMap, notes: CoreNote[], dragId: number, targetId: number, pos: DropPos): TreeMap {
  if (dragId === targetId) return map;
  const newParent = pos === 'inside' ? targetId : parentOf(map, targetId);
  // Refuse to move a node inside itself or its own descendants.
  if (newParent != null && (newParent === dragId || isDescendant(map, newParent, dragId))) return map;

  const present = new Set(notes.map((n) => n.id));
  const next: TreeMap = { ...map };
  const siblings = orderedSiblings(next, notes, newParent, present).filter((id) => id !== dragId);
  let idx: number;
  if (pos === 'inside') {
    idx = siblings.length;
  } else {
    const ti = siblings.indexOf(targetId);
    idx = ti < 0 ? siblings.length : pos === 'before' ? ti : ti + 1;
  }
  siblings.splice(idx, 0, dragId);
  siblings.forEach((id, i) => {
    next[id] = { parent: newParent, order: i };
  });
  return next;
}

export interface NoteTreeApi {
  forest: TreeNode[];
  collapsed: Set<number>;
  toggle: (id: number) => void;
  expand: (id: number) => void;
  move: (dragId: number, targetId: number, pos: DropPos) => void;
  /** Nest a (usually freshly created) note under a parent, appended last. */
  setParent: (id: number, parent: number | null) => void;
}

export function useNoteTree(notes: CoreNote[]): NoteTreeApi {
  const [map, setMap] = useState<TreeMap>(() => load<TreeMap>(TREE_KEY, {}));
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set(load<number[]>(COLLAPSE_KEY, [])));

  const forest = useMemo(() => buildForest(map, notes), [map, notes]);

  const move = useCallback(
    (dragId: number, targetId: number, pos: DropPos) => {
      setMap((prev) => {
        const nx = moveNote(prev, notes, dragId, targetId, pos);
        if (nx !== prev) save(TREE_KEY, nx);
        return nx;
      });
    },
    [notes],
  );

  const setParent = useCallback(
    (id: number, parent: number | null) => {
      setMap((prev) => {
        const present = new Set(notes.map((n) => n.id));
        const order = orderedSiblings(prev, notes, parent, present).filter((x) => x !== id).length;
        const nx: TreeMap = { ...prev, [id]: { parent, order } };
        save(TREE_KEY, nx);
        return nx;
      });
    },
    [notes],
  );

  const toggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      save(COLLAPSE_KEY, [...s]);
      return s;
    });
  }, []);

  const expand = useCallback((id: number) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const s = new Set(prev);
      s.delete(id);
      save(COLLAPSE_KEY, [...s]);
      return s;
    });
  }, []);

  return { forest, collapsed, toggle, expand, move, setParent };
}

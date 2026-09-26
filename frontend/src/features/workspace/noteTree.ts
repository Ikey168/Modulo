// Notion-style note hierarchy layered over the flat note list (the backend
// CoreNote has no parent/order fields yet). A small map of noteId → {parent,
// order} and the collapsed-node set are stored as workspace state on the
// server, so the tree is the same on every device.

import { useCallback, useMemo } from 'react';
import { useServerWorkspaceStore } from './useWorkspaceStore';
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

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function parseTreeMap(value: unknown): TreeMap {
  const map: TreeMap = {};
  for (const [key, raw] of Object.entries(record(value))) {
    const id = Number(key);
    const entry = record(raw);
    if (!Number.isInteger(id) || typeof entry.order !== 'number') continue;
    map[id] = { parent: typeof entry.parent === 'number' ? entry.parent : null, order: entry.order };
  }
  return map;
}

export const parseCollapsed = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];

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
  const [map, setMap] = useServerWorkspaceStore<TreeMap>(
    'note-tree', 'tree', 'modulo.workspace.note-tree', {}, parseTreeMap, TREE_KEY, 'Note tree');
  const [collapsedIds, setCollapsedIds] = useServerWorkspaceStore<number[]>(
    'note-tree', 'collapsed', 'modulo.workspace.note-tree.collapsed', [], parseCollapsed, COLLAPSE_KEY, 'Collapsed notes');
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  const forest = useMemo(() => buildForest(map, notes), [map, notes]);

  const move = useCallback(
    (dragId: number, targetId: number, pos: DropPos) => {
      setMap((prev) => {
        const nx = moveNote(prev, notes, dragId, targetId, pos);
        return nx;
      });
    },
    [notes, setMap],
  );

  const setParent = useCallback(
    (id: number, parent: number | null) => {
      setMap((prev) => {
        const present = new Set(notes.map((n) => n.id));
        const order = orderedSiblings(prev, notes, parent, present).filter((x) => x !== id).length;
        const nx: TreeMap = { ...prev, [id]: { parent, order } };
        return nx;
      });
    },
    [notes, setMap],
  );

  const toggle = useCallback((id: number) => {
    setCollapsedIds((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
  }, [setCollapsedIds]);

  const expand = useCallback((id: number) => {
    setCollapsedIds((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : prev);
  }, [setCollapsedIds]);

  return { forest, collapsed, toggle, expand, move, setParent };
}

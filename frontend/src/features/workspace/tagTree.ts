// Turns flat, '/'-delimited tag names into a nested tree with per-node counts,
// for the Tag Explorer plugin. A parent counts every distinct note under it.
// Pure functions so the tree building is unit-tested without a DOM.
import type { CoreNote } from '@modulo/core';

export interface TagTreeNode {
  /** Full path, e.g. 'area/topic'. */
  key: string;
  /** Last segment, e.g. 'topic'. */
  name: string;
  /** Distinct notes tagged with this node or any descendant. */
  count: number;
  children: TagTreeNode[];
}

/** Normalise a raw tag name into '/'-joined, trimmed, non-empty segments. */
export function normalizeTag(name: string): string {
  return name.split('/').map((s) => s.trim()).filter(Boolean).join('/');
}

/** A note matches a tag key if it carries that exact tag or any descendant of it. */
export function noteMatchesTag(note: CoreNote, tagKey: string): boolean {
  return (note.tags ?? []).some((t) => {
    const norm = normalizeTag(t.name);
    return norm === tagKey || norm.startsWith(`${tagKey}/`);
  });
}

/** Build the nested tag tree from the tags on `notes`. */
export function buildTagTree(notes: CoreNote[]): TagTreeNode[] {
  const ids = new Map<string, Set<number>>(); // full path -> note ids
  const kids = new Map<string, Set<string>>(); // full path -> child full paths
  const roots = new Set<string>();

  for (const n of notes) {
    for (const t of n.tags ?? []) {
      const segs = normalizeTag(t.name).split('/').filter(Boolean);
      let prefix = '';
      for (let i = 0; i < segs.length; i++) {
        const full = i === 0 ? segs[0] : `${prefix}/${segs[i]}`;
        if (!ids.has(full)) ids.set(full, new Set());
        ids.get(full)!.add(n.id);
        if (i === 0) {
          roots.add(full);
        } else {
          if (!kids.has(prefix)) kids.set(prefix, new Set());
          kids.get(prefix)!.add(full);
        }
        prefix = full;
      }
    }
  }

  const build = (full: string): TagTreeNode => {
    const name = full.includes('/') ? full.slice(full.lastIndexOf('/') + 1) : full;
    const children = [...(kids.get(full) ?? [])].sort().map(build);
    return { key: full, name, count: ids.get(full)!.size, children };
  };

  return [...roots].sort().map(build);
}

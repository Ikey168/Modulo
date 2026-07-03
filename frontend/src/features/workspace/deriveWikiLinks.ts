// Wiki-link edge derivation.
//
// `[[Title]]` references in a note body are resolved to navigable links at
// render time (see Markdown.tsx) but were never reflected as edges in the
// graph view — only explicit note-links (api.links()) drew edges. This module
// parses those references and synthesizes directed CoreLinks so the graph
// shows the connections a user actually wrote.
//
// These synthesized links are kept SEPARATE from the workspace's real DB links
// (data.links): they carry no backend id and must never be passed to
// removeLink(). Merge them only for read/render purposes.

import type { CoreLink, CoreNote } from '@modulo/core';
import { parseWikiRef } from './outline';

const WIKI_RE = /\[\[([^\]]+)\]\]/g;

/** `source->target` key used to dedupe directed edges. */
function edgeKey(sourceId: number, targetId: number): string {
  return `${sourceId}->${targetId}`;
}

/**
 * Parse `[[Title]]` wiki-links out of every note body and return the directed
 * links between notes they imply.
 *
 * Titles resolve to note ids by exact, trimmed title match — the same rule the
 * markdown renderer uses — so an edge appears exactly when the rendered link is
 * live (a "missing" link in the editor produces no edge). Self-links and
 * duplicate edges are dropped. On a title collision the first matching note
 * wins, mirroring `Array.find` in the renderer.
 */
export function deriveWikiLinks(notes: CoreNote[]): CoreLink[] {
  const idByTitle = new Map<string, number>();
  for (const n of notes) {
    const key = n.title.trim();
    if (!idByTitle.has(key)) idByTitle.set(key, n.id);
  }

  const seen = new Set<string>();
  const links: CoreLink[] = [];
  for (const n of notes) {
    // A note's text may live in either field depending on the editor; scan both.
    const text = `${n.markdownContent ?? ''}\n${n.content ?? ''}`;
    WIKI_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKI_RE.exec(text)) !== null) {
      // Resolve by note title, ignoring any #heading / |alias parts so aliased
      // and heading-scoped links still form graph edges. In-note heading links
      // ([[#Heading]]) have no target and produce no edge.
      const { target } = parseWikiRef(m[1]);
      if (!target) continue;
      const targetId = idByTitle.get(target);
      if (targetId == null || targetId === n.id) continue;
      const key = edgeKey(n.id, targetId);
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        id: `wiki:${n.id}:${targetId}`,
        linkType: 'WIKI',
        sourceNoteId: n.id,
        targetNoteId: targetId,
      });
    }
  }
  return links;
}

/**
 * Merge explicit DB links with derived wiki-links for rendering. Explicit links
 * win on a directed-edge collision so their real id/linkType are preserved.
 */
export function mergeWithWikiLinks(notes: CoreNote[], explicit: CoreLink[]): CoreLink[] {
  const present = new Set(explicit.map((l) => edgeKey(l.sourceNoteId, l.targetNoteId)));
  const derived = deriveWikiLinks(notes).filter(
    (l) => !present.has(edgeKey(l.sourceNoteId, l.targetNoteId)),
  );
  return derived.length ? [...explicit, ...derived] : explicit;
}

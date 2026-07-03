// Document outline support for the Obsidian-style Outline plugin: a shared
// heading slugger (kept in sync between the Markdown renderer's anchor ids and
// the parsed outline) plus a lightweight Markdown heading parser.

import { isValidElement, type ReactNode } from 'react';

export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/** Stable, id-safe slug from heading text. Renderer and parser must agree. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

/** Flattens react-markdown heading children into plain text (for the slug). */
export function nodeText(node: ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children);
  return '';
}

/**
 * Extracts ATX headings (`# …`) from Markdown, skipping fenced code blocks so
 * shell comments and the like never appear in the outline.
 */
export function parseHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  for (const raw of (md || '').split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    // Strip inline emphasis / links / code so the label reads cleanly.
    const text = m[2]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim();
    if (!text) continue;
    out.push({ level: m[1].length, text, slug: slugify(text) });
  }
  return out;
}

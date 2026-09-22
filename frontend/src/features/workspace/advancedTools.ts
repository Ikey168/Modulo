import type { CoreLink, CoreNote } from '@modulo/core';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being', 'between', 'both', 'but', 'can', 'could',
  'does', 'each', 'for', 'from', 'had', 'has', 'have', 'how', 'into', 'its', 'more', 'most', 'not', 'only', 'other', 'our', 'out',
  'should', 'some', 'such', 'than', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'would', 'you', 'your',
]);

export const noteText = (note: CoreNote): string => `${note.title}\n${note.markdownContent ?? note.content ?? ''}`;

export function terms(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]+/gu) ?? [])
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function vector(text: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const term of terms(text)) result.set(term, (result.get(term) ?? 0) + 1);
  const length = Math.sqrt([...result.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  for (const [term, value] of result) result.set(term, value / length);
  return result;
}

export function cosineText(a: string, b: string): number {
  const left = vector(a);
  const right = vector(b);
  let score = 0;
  for (const [term, value] of left) score += value * (right.get(term) ?? 0);
  return score;
}

export interface RankedNote {
  note: CoreNote;
  score: number;
  shared: string[];
}

export function relatedNotes(note: CoreNote, notes: CoreNote[], limit = 6): RankedNote[] {
  const sourceTerms = new Set(terms(noteText(note)));
  return notes
    .filter((candidate) => candidate.id !== note.id)
    .map((candidate) => ({
      note: candidate,
      score: cosineText(noteText(note), noteText(candidate)),
      shared: [...new Set(terms(noteText(candidate)).filter((term) => sourceTerms.has(term)))].slice(0, 5),
    }))
    .filter((candidate) => candidate.score > 0.05)
    .sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title))
    .slice(0, limit);
}

export function searchBySimilarity(query: string, notes: CoreNote[], limit = 30): RankedNote[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const queryTerms = new Set(terms(normalized));
  return notes
    .map((note) => {
      const title = note.title.toLocaleLowerCase();
      const shared = [...new Set(terms(noteText(note)).filter((term) => queryTerms.has(term)))];
      const phraseBoost = title.includes(normalized) ? 0.75 : noteText(note).toLocaleLowerCase().includes(normalized) ? 0.35 : 0;
      return { note, score: cosineText(normalized, noteText(note)) + phraseBoost, shared: shared.slice(0, 5) };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title))
    .slice(0, limit);
}

export interface GraphNoteMetric {
  note: CoreNote;
  incoming: number;
  outgoing: number;
  degree: number;
  pageRank: number;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  components: number;
  orphans: number;
  ranked: GraphNoteMetric[];
}

export function graphMetrics(notes: CoreNote[], links: CoreLink[]): GraphMetrics {
  const ids = new Set(notes.map((note) => note.id));
  const edges = links.filter((link) => ids.has(link.sourceNoteId) && ids.has(link.targetNoteId));
  const incoming = new Map(notes.map((note) => [note.id, 0]));
  const outgoing = new Map(notes.map((note) => [note.id, 0]));
  const adjacency = new Map(notes.map((note) => [note.id, new Set<number>()]));
  for (const edge of edges) {
    outgoing.set(edge.sourceNoteId, (outgoing.get(edge.sourceNoteId) ?? 0) + 1);
    incoming.set(edge.targetNoteId, (incoming.get(edge.targetNoteId) ?? 0) + 1);
    adjacency.get(edge.sourceNoteId)?.add(edge.targetNoteId);
    adjacency.get(edge.targetNoteId)?.add(edge.sourceNoteId);
  }

  const n = notes.length;
  let ranks = new Map(notes.map((note) => [note.id, n ? 1 / n : 0]));
  for (let iteration = 0; iteration < 24 && n > 0; iteration += 1) {
    const next = new Map(notes.map((note) => [note.id, 0.15 / n]));
    let dangling = 0;
    for (const note of notes) {
      const degree = outgoing.get(note.id) ?? 0;
      if (degree === 0) dangling += ranks.get(note.id) ?? 0;
    }
    for (const note of notes) next.set(note.id, (next.get(note.id) ?? 0) + 0.85 * dangling / n);
    for (const edge of edges) {
      const degree = outgoing.get(edge.sourceNoteId) ?? 1;
      next.set(edge.targetNoteId, (next.get(edge.targetNoteId) ?? 0) + 0.85 * (ranks.get(edge.sourceNoteId) ?? 0) / degree);
    }
    ranks = next;
  }

  let components = 0;
  const seen = new Set<number>();
  for (const note of notes) {
    if (seen.has(note.id)) continue;
    components += 1;
    const queue = [note.id];
    seen.add(note.id);
    while (queue.length) {
      for (const neighbor of adjacency.get(queue.shift()!) ?? []) {
        if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
    }
  }

  const ranked = notes.map((note) => {
    const incomingCount = incoming.get(note.id) ?? 0;
    const outgoingCount = outgoing.get(note.id) ?? 0;
    return { note, incoming: incomingCount, outgoing: outgoingCount, degree: incomingCount + outgoingCount, pageRank: ranks.get(note.id) ?? 0 };
  }).sort((a, b) => b.pageRank - a.pageRank || b.degree - a.degree);

  return {
    nodeCount: n,
    edgeCount: edges.length,
    density: n > 1 ? edges.length / (n * (n - 1)) : 0,
    components,
    orphans: ranked.filter((metric) => metric.degree === 0).length,
    ranked,
  };
}

export function safeFilename(value: string): string {
  return value.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'untitled';
}

export function downloadFile(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

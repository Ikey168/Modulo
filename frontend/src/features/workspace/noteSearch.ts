import type { CoreNote } from '@modulo/core';

export interface NoteSearchResult {
  note: CoreNote;
  excerpt: string;
  score: number;
}

function plainText(note: CoreNote): string {
  return (note.markdownContent || note.content || '')
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function termsFor(query: string): string[] {
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** A short plain-text preview, centred on the first matching content term. */
export function noteExcerpt(note: CoreNote, query = '', length = 160): string {
  const body = plainText(note);
  if (!body) return '';

  const lowerBody = body.toLocaleLowerCase();
  const term = termsFor(query).find((value) => lowerBody.includes(value));
  const matchAt = term ? lowerBody.indexOf(term) : 0;
  const start = Math.max(0, matchAt - Math.floor(length / 3));
  const excerpt = body.slice(start, start + length).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${start + length < body.length ? '…' : ''}`;
}

/**
 * Search the complete note record with AND semantics across query terms.
 * Title and tags rank above body matches, while the original order remains the
 * stable tie-breaker so an equal-score list does not jump around while typing.
 */
export function searchNotes(notes: CoreNote[], query: string): NoteSearchResult[] {
  const terms = termsFor(query);
  if (terms.length === 0) {
    return notes.map((note) => ({ note, excerpt: noteExcerpt(note), score: 0 }));
  }

  const phrase = query.trim().toLocaleLowerCase();
  return notes
    .map((note, index) => {
      const title = note.title.toLocaleLowerCase();
      const tags = (note.tags ?? []).map((tag) => tag.name.toLocaleLowerCase()).join(' ');
      const body = plainText(note).toLocaleLowerCase();
      const searchable = `${title}\n${tags}\n${body}`;
      if (!terms.every((term) => searchable.includes(term))) return null;

      let score = title.includes(phrase) ? 80 : 0;
      for (const term of terms) {
        if (title.includes(term)) score += 30;
        else if (tags.includes(term)) score += 18;
        else if (body.includes(term)) score += 8;
      }
      return { note, excerpt: noteExcerpt(note, query), score, index };
    })
    .filter((result): result is NoteSearchResult & { index: number } => result !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ note, excerpt, score }) => ({ note, excerpt, score }));
}

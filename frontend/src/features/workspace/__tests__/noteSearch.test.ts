import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { noteExcerpt, searchNotes } from '../noteSearch';

const note = (id: number, title: string, content: string, tags: string[] = []): CoreNote => ({
  id,
  title,
  content,
  tags: tags.map((name, index) => ({ id: `${id}-${index}`, name })),
});

describe('note search', () => {
  it('searches note content and tags, not just titles', () => {
    const results = searchNotes([
      note(1, 'Meeting', 'Discuss the migration plan.', ['work'] ),
      note(2, 'Weekend', 'Buy groceries.', ['personal']),
    ], 'migration');

    expect(results.map(({ note: result }) => result.id)).toEqual([1]);
    expect(results[0]?.excerpt).toContain('migration');
  });

  it('requires every query term and ranks title matches first', () => {
    const results = searchNotes([
      note(1, 'Architecture notes', 'A short overview.'),
      note(2, 'Release', 'Architecture notes for the next release.'),
      note(3, 'Architecture', 'Unrelated text.'),
    ], 'architecture notes');

    expect(results.map(({ note: result }) => result.id)).toEqual([1, 2]);
  });

  it('creates a readable excerpt without markdown decoration', () => {
    expect(noteExcerpt(note(1, 'Guide', '# Heading\n\n**Keep** this note.'), 'keep')).toBe('Heading Keep this note.');
  });
});

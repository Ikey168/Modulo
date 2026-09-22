import { describe, expect, it } from 'vitest';
import type { CoreLink, CoreNote } from '@modulo/core';
import { graphMetrics, relatedNotes, searchBySimilarity, sha256 } from '../advancedTools';

const note = (id: number, title: string, content: string): CoreNote => ({ id, title, content, markdownContent: content, tags: [] });

describe('advanced knowledge tools', () => {
  const notes = [
    note(1, 'Ethereum audit', 'smart contract invariant testing and threat model'),
    note(2, 'Contract findings', 'smart contract audit findings and invariant evidence'),
    note(3, 'Bread recipe', 'flour water salt fermentation'),
  ];

  it('ranks content-similar notes above unrelated notes', () => {
    expect(relatedNotes(notes[0]!, notes)[0]?.note.id).toBe(2);
    expect(searchBySimilarity('contract invariant evidence', notes)[0]?.note.id).toBe(2);
  });

  it('computes graph structure and centrality', () => {
    const links: CoreLink[] = [
      { id: 'a', linkType: 'RELATED', sourceNoteId: 1, targetNoteId: 2 },
      { id: 'b', linkType: 'RELATED', sourceNoteId: 3, targetNoteId: 2 },
    ];
    const metrics = graphMetrics(notes, links);
    expect(metrics).toMatchObject({ nodeCount: 3, edgeCount: 2, components: 1, orphans: 0 });
    expect(metrics.ranked[0]?.note.id).toBe(2);
  });

  it('creates stable SHA-256 digests', async () => {
    await expect(sha256('Modulo')).resolves.toBe('a7ae2d265df39d77be91ac911ad0a18fb46c8d95e4b10412cb778d7cf3c22f21');
  });
});

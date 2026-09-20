import { describe, expect, it } from 'vitest';
import type { CoreLink, CoreNote } from '@modulo/core';
import { createGraphViewInput } from '../graphViewModel';

const note = (id: number, title: string, extra: Partial<CoreNote> = {}): CoreNote => ({
  id,
  title,
  content: '',
  tags: [],
  ...extra,
});

const link = (id: string, sourceNoteId: number, targetNoteId: number): CoreLink => ({
  id,
  linkType: 'wiki',
  sourceNoteId,
  targetNoteId,
});

describe('createGraphViewInput', () => {
  it('keeps the graph identity stable when equivalent arrays are recreated or reordered', () => {
    const first = createGraphViewInput(
      [note(2, 'Second'), note(1, 'First')],
      [link('b', 2, 1), link('a', 1, 2)],
    );
    const second = createGraphViewInput(
      [note(1, 'First'), note(2, 'Second')],
      [link('a-copy', 1, 2), link('b-copy', 2, 1)],
    );

    expect(second.key).toBe(first.key);
    expect(second.nodes.map((node) => node.id)).toEqual([1, 2]);
    expect(second.links).toEqual([
      { source: 1, target: 2 },
      { source: 2, target: 1 },
    ]);
  });

  it('does not restart the visual graph for note fields that it does not render', () => {
    const first = createGraphViewInput([note(1, 'First', { content: 'before' })], []);
    const second = createGraphViewInput([
      note(1, 'First', { content: 'after', updatedAt: '2026-09-20T12:00:00Z', version: 7 }),
    ], []);

    expect(second.key).toBe(first.key);
  });

  it('changes identity for visible node changes and real topology changes', () => {
    const base = createGraphViewInput([note(1, 'First'), note(2, 'Second')], []);
    const renamed = createGraphViewInput([note(1, 'Renamed'), note(2, 'Second')], []);
    const anchored = createGraphViewInput([
      note(1, 'First', { isOnBlockchain: true }),
      note(2, 'Second'),
    ], []);
    const linked = createGraphViewInput(
      [note(1, 'First'), note(2, 'Second')],
      [link('a', 1, 2)],
    );

    expect(renamed.key).not.toBe(base.key);
    expect(anchored.key).not.toBe(base.key);
    expect(linked.key).not.toBe(base.key);
  });

  it('ignores links whose endpoints are not present in the graph', () => {
    const input = createGraphViewInput(
      [note(1, 'First')],
      [link('missing-target', 1, 99), link('missing-source', 99, 1)],
    );

    expect(input.links).toEqual([]);
  });
});

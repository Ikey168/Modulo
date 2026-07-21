import { beforeEach, describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  DEFAULT_STAGES,
  engagementLabel,
  groupByStage,
  isEngagement,
  readStages,
  stageOf,
  stageTag,
  toStageId,
  writeStages,
} from '../pipeline';

const note = (id: number, tags: string[]): CoreNote => ({
  id,
  title: `Note ${id}`,
  content: '',
  tags: tags.map((name) => ({ id: `t-${name}`, name })),
});

beforeEach(() => localStorage.clear());

describe('engagement + stage tags', () => {
  it('detects engagements and derives labels', () => {
    const n = note(1, ['engagement/acme-vault', 'stage/audit']);
    expect(isEngagement(n)).toBe(true);
    expect(engagementLabel(n)).toBe('acme-vault');
    expect(isEngagement(note(2, ['other']))).toBe(false);
    expect(engagementLabel(note(2, []))).toBeNull();
  });

  it('derives the stage from the stage/ tag', () => {
    const n = note(1, ['engagement/x', 'stage/fix-review']);
    expect(stageOf(n)).toBe('fix-review');
    expect(stageTag(n)?.id).toBe('t-stage/fix-review');
    expect(stageOf(note(2, ['engagement/x']))).toBeNull();
  });
});

describe('groupByStage', () => {
  it('groups engagements into their columns, unstaged into the first', () => {
    const notes = [
      note(1, ['engagement/a', 'stage/audit']),
      note(2, ['engagement/b']),
      note(3, ['engagement/c', 'stage/unknown-column']),
      note(4, ['not-an-engagement']),
    ];
    const groups = groupByStage(notes, DEFAULT_STAGES);
    expect(groups['audit'].map((n) => n.id)).toEqual([1]);
    expect(groups['inquiry'].map((n) => n.id)).toEqual([2, 3]);
    expect(Object.values(groups).flat()).toHaveLength(3);
  });
});

describe('column persistence', () => {
  it('round-trips custom stages and falls back to defaults', () => {
    expect(readStages()).toEqual(DEFAULT_STAGES);
    writeStages(['triage', 'done']);
    expect(readStages()).toEqual(['triage', 'done']);
    localStorage.setItem('modulo-pipeline-stages', '{ not json');
    expect(readStages()).toEqual(DEFAULT_STAGES);
    localStorage.setItem('modulo-pipeline-stages', '[]');
    expect(readStages()).toEqual(DEFAULT_STAGES);
  });

  it('normalises column labels to stage ids', () => {
    expect(toStageId('Fix Review')).toBe('fix-review');
    expect(toStageId('  Final!! ')).toBe('final');
  });
});

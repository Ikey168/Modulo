import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decisionIsDue, flashcardFromNote, logSkillPractice, newLearningRecord, reviewDecision, skillBlockers, validateDecision, validateSkill } from '../learningTools';
import { DECISION_JOURNAL_PLUGIN_ID, FLASHCARDS_PLUGIN_ID, SKILL_TREE_PLUGIN_ID } from '../foundationTools';
import { collectLifeOsEntities, createLifeOsBackup, planLifeOsRestore } from '../lifeOs';
import { emptyLifeCollection, lifeStoreKey, type LifeRecord } from '../lifeStore';
import { scheduleFlashcard } from '../foundationActions';

const skill = (id: string, prerequisites: string[] = [], status = 'Planned'): LifeRecord => ({
  ...newLearningRecord(status, 'Education'), id, title: id, values: { prerequisites: JSON.stringify(prerequisites), evidence: 'Completed a practical assessment' },
});

beforeEach(() => localStorage.clear());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('decision journal', () => {
  it('queues dated pending decisions and preserves predictions through repeated reviews', () => {
    const original = { ...newLearningRecord('Pending review', 'Career'), title: 'Choose a course', date: '2026-09-05', values: { choice: 'Evening class', expectedOutcome: 'Finish in six weeks', confidence: '70' } };
    expect(decisionIsDue(original, '2026-09-04')).toBe(false);
    expect(decisionIsDue(original, '2026-09-05')).toBe(true);
    const reviewed = reviewDecision(original, 'Finished in eight weeks', 'Allow more practice time', '2026-10-31');
    expect(reviewed.values).toMatchObject({ expectedOutcome: 'Finish in six weeks', confidence: '70', actualOutcome: 'Finished in eight weeks' });
    expect(decisionIsDue(reviewed, '2026-11-01')).toBe(false);
    expect(reviewDecision(reviewed, 'Used it at work', '', '2026-11-05').log).toHaveLength(2);
    expect(original.log).toEqual([]);
  });

  it('requires meaningful predictions and outcomes and bounded confidence', () => {
    expect(() => validateDecision(newLearningRecord('Pending review', 'Personal'))).toThrow(/title/);
    const record = { ...newLearningRecord('Pending review', 'Personal'), title: 'Decision', values: { choice: 'A', expectedOutcome: 'B', confidence: '101' } };
    expect(() => validateDecision(record)).toThrow(/Confidence/);
    expect(() => reviewDecision(record, '  ', '')).toThrow(/actual outcome/);
  });
});

describe('skill dependencies and practice', () => {
  it('rejects self-links, indirect cycles, and missing prerequisites', () => {
    expect(() => validateSkill(skill('a', ['a']), [])).toThrow(/cycle/);
    expect(() => validateSkill(skill('a', ['c']), [skill('b', ['a']), skill('c', ['b'])])).toThrow(/cycle/);
    expect(() => validateSkill(skill('a', ['missing']), [])).toThrow(/missing/);
    expect(() => validateSkill(skill('d', ['b', 'c']), [skill('a'), skill('b', ['a']), skill('c', ['a'])])).not.toThrow();
  });

  it('requires mastered prerequisites and evidence before mastery', () => {
    const target = skill('advanced', ['basic'], 'Mastered');
    expect(skillBlockers(target, [skill('basic')])).toEqual(['basic']);
    expect(() => validateSkill(target, [skill('basic')])).toThrow(/prerequisite/);
    expect(() => validateSkill(target, [skill('basic', [], 'Mastered')])).not.toThrow();
    expect(() => validateSkill({ ...skill('a', [], 'Mastered'), values: {} }, [])).toThrow(/evidence/);
  });

  it('accumulates dated practice without mutating the source record', () => {
    const original = skill('guitar');
    const practiced = logSkillPractice(original, 'Chord transitions', 25, '2026-09-05');
    expect(practiced.status).toBe('Practicing');
    expect(logSkillPractice(practiced, 'Finger picking', 15).values.practiceMinutes).toBe('40');
    expect(practiced.log[0]).toMatchObject({ date: '2026-09-05', title: '25 min · Chord transitions' });
    expect(() => logSkillPractice(original, 'Practice', -1)).toThrow(/duration/);
    expect(original.log).toEqual([]);
  });
});

describe('connected flashcards and portability', () => {
  it('captures a passage with its source and preserves those links after grading', () => {
    const note = { id: 42, title: 'Memory', content: 'Retrieval strengthens memory.', tags: [] };
    const card = flashcardFromNote(note, 'What strengthens memory?', note.content, 'Study', 'retrieval');
    expect(card.values).toMatchObject({ front: 'What strengthens memory?', back: note.content, sourceNoteId: '42', sourceNoteTitle: 'Memory', skillId: 'retrieval' });
    expect(scheduleFlashcard(card, 'Good').values.sourceNoteId).toBe('42');
    expect(() => flashcardFromNote(note, '', 'Answer', '')).toThrow(/question/);
  });

  it('uses the local calendar date for review logs at the UTC date boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 0, 15));
    expect(scheduleFlashcard(skill('card'), 'Again').date).toBe('2026-09-05');
    expect(scheduleFlashcard(skill('card'), 'Again').log[0].date).toBe('2026-09-05');
  });

  it('indexes and restores all three plugin stores and review limits', () => {
    const ids = [DECISION_JOURNAL_PLUGIN_ID, SKILL_TREE_PLUGIN_ID, FLASHCARDS_PLUGIN_ID];
    const stores: Record<string, unknown> = Object.fromEntries(ids.map((id) => [lifeStoreKey(id), { ...emptyLifeCollection(), records: [skill(id)] }]));
    stores['modulo-fsrs-deck-limits'] = { Study: 10 };
    expect(collectLifeOsEntities([], stores).map((entity) => entity.route)).toEqual(expect.arrayContaining(ids));
    const backup = createLifeOsBackup([], [], [], stores);
    const { planned } = planLifeOsRestore(backup, {});
    const restored = Object.fromEntries(planned.map(({ key, value }) => [key, value]));
    ids.forEach((id) => expect((restored[lifeStoreKey(id)] as { records: LifeRecord[] }).records[0].id).toBe(id));
    expect(restored['modulo-fsrs-deck-limits']).toEqual({ Study: 10 });
  });
});

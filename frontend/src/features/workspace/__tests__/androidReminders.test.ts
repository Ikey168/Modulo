import { describe, expect, it } from 'vitest';
import { planNativeReminders } from '../androidReminders';
import type { LifeCollectionData, LifeRecord } from '../lifeStore';

const record = (patch: Partial<LifeRecord>): LifeRecord => ({ id: 'r1', title: 'Pay rent', status: 'Scheduled', category: 'Task',
  recurrence: 'Once', favorite: false, tags: [], values: {}, checklist: [], log: [], ...patch });
const data = (records: LifeRecord[], occurrenceCompletions: LifeCollectionData['occurrenceCompletions'] = []): LifeCollectionData =>
  ({ version: 1, records, occurrenceCompletions });
const now = new Date(2026, 8, 26, 12, 0);

describe('Android reminder plan', () => {
  it('arms a one-off reminder at its time minus the lead, with a floating local time and a record link', () => {
    const [alarm, ...rest] = planNativeReminders(data([record({ date: '2026-09-28', values: { time: '10:30', leadTime: '15 minutes', message: 'Transfer' } })]),
      ['Done'], 'reminders-notifications', now);
    expect(rest).toEqual([]);
    expect(alarm).toEqual({ id: 'r1:2026-09-28', at: new Date(2026, 8, 28, 10, 15).getTime(), local: '2026-09-28T10:15',
      title: 'Pay rent', body: 'Transfer', route: '/app/reminders-notifications?record=r1' });
  });

  it('skips completed, past and already-done occurrences', () => {
    const plan = planNativeReminders(data([
      record({ id: 'done', date: '2026-09-28', status: 'Done' }),
      record({ id: 'past', date: '2026-09-26', values: { time: '08:00' } }),
      record({ id: 'daily', date: '2026-09-20', recurrence: 'Daily', values: { time: '18:00' } }),
    ], [{ recordId: 'daily', date: '2026-09-26', done: true }]), ['Done'], 'reminders-notifications', now);
    expect(plan.map(alarm => alarm.id)).toEqual(['daily:2026-09-27', 'daily:2026-09-28', 'daily:2026-09-29', 'daily:2026-09-30',
      'daily:2026-10-01', 'daily:2026-10-02', 'daily:2026-10-03']);
  });

  it('gives every occurrence a distinct id so re-publishing never duplicates an alarm', () => {
    const plan = planNativeReminders(data([record({ date: '2026-09-01', recurrence: 'Weekly' })]), [], 'reminders-notifications', now);
    expect(new Set(plan.map(alarm => alarm.id)).size).toBe(plan.length);
    expect(plan.length).toBeGreaterThan(3);
  });
});

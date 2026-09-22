import { beforeEach, describe, expect, it } from 'vitest';
import { LIFE_PLUGIN_CONFIGS } from '../lifeConfigs';
import {
  emptyLifeCollection,
  lifeRecordOccursOn,
  lifeOccurrenceDone,
  lifeRecordsOn,
  lifeStoreKey,
  parseLifeCollection,
  setLifeOccurrenceDone,
  type LifeRecord,
} from '../lifeStore';

beforeEach(() => localStorage.clear());

const record = (update: Partial<LifeRecord> = {}): LifeRecord => ({
  id: 'record-1', title: 'Water plants', status: 'Due', category: 'Chore', date: '2026-09-03', recurrence: 'Once', blockId: 'morning-prime', favorite: false, tags: [], values: {}, checklist: [], log: [], ...update,
});

describe('independent life plugin stores', () => {
  it('defines a unique store and complete configuration for every life plugin', () => {
    const ids = LIFE_PLUGIN_CONFIGS.map((config) => config.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const config of LIFE_PLUGIN_CONFIGS) {
      expect(config.statuses.length).toBeGreaterThan(1);
      expect(config.categories.length).toBeGreaterThan(1);
      expect(lifeStoreKey(config.id)).toContain(config.id);
    }
  });

  it('parses nested checklists, logs, custom fields, and safe defaults', () => {
    const parsed = parseLifeCollection({ records: [{
      id: 'r1', title: 'Boiler', status: '', category: '', recurrence: 'invalid', blockId: 'nope', rating: 9,
      values: { room: 'Basement', bad: 4 }, checklist: [{ id: 'c1', title: 'Inspect', done: true }, { bad: true }],
      log: [{ id: 'l1', date: '2026-09-03', title: 'Serviced' }],
    }] });
    expect(parsed.records[0]).toMatchObject({ status: 'Active', category: 'Other', recurrence: 'Once', rating: 5, values: { room: 'Basement' } });
    expect(parsed.records[0].blockId).toBeUndefined();
    expect(parsed.records[0].checklist).toHaveLength(1);
    expect(parsed.records[0].log).toHaveLength(1);
  });

  it('evaluates once, daily, weekly, monthly, and yearly occurrences', () => {
    expect(lifeRecordOccursOn(record(), '2026-09-03')).toBe(true);
    expect(lifeRecordOccursOn(record(), '2026-09-04')).toBe(false);
    expect(lifeRecordOccursOn(record({ recurrence: 'Daily' }), '2026-09-10')).toBe(true);
    expect(lifeRecordOccursOn(record({ recurrence: 'Weekly' }), '2026-09-17')).toBe(true);
    expect(lifeRecordOccursOn(record({ recurrence: 'Weekly' }), '2026-09-18')).toBe(false);
    expect(lifeRecordOccursOn(record({ recurrence: 'Monthly' }), '2026-10-03')).toBe(true);
    expect(lifeRecordOccursOn(record({ recurrence: 'Yearly' }), '2027-09-03')).toBe(true);
    expect(lifeRecordOccursOn(record({ recurrence: 'Daily', endDate: '2026-09-05' }), '2026-09-06')).toBe(false);
  });

  it('projects only scheduled records with planner blocks', () => {
    const data = emptyLifeCollection();
    data.records.push(record(), record({ id: 'unblocked', blockId: undefined }), record({ id: 'later', date: '2026-09-04' }));
    expect(lifeRecordsOn(data, '2026-09-03').map((item) => item.id)).toEqual(['record-1']);
  });

  it('tracks each recurring occurrence independently', () => {
    let data = emptyLifeCollection();
    data.records.push(record({ recurrence: 'Daily' }));
    data = setLifeOccurrenceDone(data, 'record-1', '2026-09-03', true);
    expect(lifeOccurrenceDone(data, 'record-1', '2026-09-03')).toBe(true);
    expect(lifeOccurrenceDone(data, 'record-1', '2026-09-04')).toBe(false);
    data = setLifeOccurrenceDone(data, 'record-1', '2026-09-03', false);
    expect(data.occurrenceCompletions).toEqual([]);
  });

  it('keeps plugin namespaces independent and recovers from corruption', () => {
    const home = emptyLifeCollection();
    home.records.push(record());
    expect(parseLifeCollection(JSON.parse(JSON.stringify(home))).records).toHaveLength(1);
    expect(lifeStoreKey('home-maintenance')).not.toBe(lifeStoreKey('personal-crm'));
    expect(parseLifeCollection('{bad')).toEqual(emptyLifeCollection());
  });
});

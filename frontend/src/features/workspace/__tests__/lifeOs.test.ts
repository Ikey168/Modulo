import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIFE_OS_BACKUP_FORMAT,
  LIFE_OS_DATA_STORE_KEYS,
  LIFE_OS_STORE_KEY,
  collectLifeOsEntities,
  collectLifeOsHealth,
  createLifeOsBackup,
  emptyLifeOsData,
  lifeOsEntitiesCsv,
  parseLifeOsBackup,
  planLifeOsRestore,
  parseLifeOsData,
  relationsFor,
} from '../lifeOs';
import { FOUNDATION_TOOL_DEFINITIONS } from '../foundationTools';
import { lifeStoreKey } from '../lifeStore';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
});

describe('Life OS integration and portability', () => {
  it('normalizes specialist records and notes into stable searchable entities', () => {
    const stores = { 'modulo-modified-para-v1': {
      projects: [{ id: 'p1', name: 'Ship Modulo', status: 'Active', nextAction: 'Test it' }],
      areas: [], resources: [], tasks: [], goals: [], inbox: [], reviews: [],
    } };
    const entities = collectLifeOsEntities([{ id: 7, title: 'Architecture', content: '# Index', tags: [{ id: 't', name: 'systems' }] }], stores);
    expect(entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ uid: 'modulo-modified-para-v1:projects:p1', title: 'Ship Modulo', source: 'PARA' }),
      expect.objectContaining({ uid: 'core:notes:7', title: 'Architecture', source: 'Notes', artifact: true }),
    ]));
    expect(new Set(entities.map((entity) => entity.uid)).size).toBe(entities.length);
  });

  it('reports broken cross-plugin links and duplicate titles', () => {
    const stores = {
      'modulo-media-library-v2': { items: [{ id: 'a', title: 'Dune' }, { id: 'b', title: 'Dune' }] },
    };
    const entities = collectLifeOsEntities([], stores);
    const health = collectLifeOsHealth(entities, { version: 1, reviews: [], relations: [{ id: 'r', fromUid: entities[0].uid, toUid: 'gone', type: 'Supports', label: 'Supports' }] }, stores);
    expect(health.map((issue) => issue.title)).toEqual(expect.arrayContaining(['Broken cross-plugin relation', 'Possible duplicate media']));
  });

  it('finds orphaned references inside specialist stores', () => {
    const stores = { 'modulo-education-v1': {
      nodes: [], sessions: [{ id: 's', nodeId: 'missing-course', date: '2026-09-04' }], assignments: [],
    } };
    const health = collectLifeOsHealth(collectLifeOsEntities([], stores), emptyLifeOsData(), stores);
    expect(health).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Orphaned specialist reference', source: 'Education', route: 'education-study' }),
    ]));
  });

  it('creates and validates a versioned provider-neutral backup', () => {
    const backup = createLifeOsBackup([{ id: 2, title: 'Portable', content: 'Markdown', tags: [] }], [], [], { 'modulo-workout-planner-v1': { version: 1, workouts: [] } });
    expect(backup).toMatchObject({ format: LIFE_OS_BACKUP_FORMAT, schemaVersion: 1 });
    expect(backup.stores).toHaveProperty('modulo-workout-planner-v1');
    expect(backup.notes[0]).toEqual(expect.objectContaining({ title: 'Portable', content: 'Markdown' }));
    expect(parseLifeOsBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
    expect(() => parseLifeOsBackup({ format: 'other', schemaVersion: 1 })).toThrow(/supported/);
  });

  it('restores only missing stores by default and requires opt-in to replace data', () => {
    const current = { [LIFE_OS_STORE_KEY]: { version: 1, relations: [], reviews: [{ id: 'current', date: '2026-09-04' }] } };
    const backup = parseLifeOsBackup({
      format: LIFE_OS_BACKUP_FORMAT, schemaVersion: 1, exportedAt: '2026-09-04T00:00:00Z', notes: [],
      stores: { [LIFE_OS_STORE_KEY]: { version: 1, relations: [], reviews: [{ id: 'backup', date: '2026-09-03' }] }, 'foreign-key': { secret: true } },
    });
    const safe = planLifeOsRestore(backup, current);
    expect(safe.result.skipped).toContain(LIFE_OS_STORE_KEY);
    expect(safe.result.unknown).toContain('foreign-key');
    expect(safe.planned.map((item) => item.key)).not.toContain(LIFE_OS_STORE_KEY);
    const replaced = planLifeOsRestore(backup, current, true);
    expect(JSON.stringify(replaced.planned.find((item) => item.key === LIFE_OS_STORE_KEY)?.value)).toContain('backup');
  });

  it('exports a quoted flat CSV index', () => {
    const csv = lifeOsEntitiesCsv([{ uid: 'a', source: 'PARA', kind: 'Project', title: 'Build, test', tags: ['x'], route: 'para-core', artifact: false }]);
    expect(csv).toContain('"Build, test"');
    expect(csv.split('\n')).toHaveLength(2);
    expect(emptyLifeOsData()).toEqual({ version: 1, relations: [], reviews: [] });
  });

  it('migrates legacy untyped relations and exposes directional backlinks', () => {
    const migrated = parseLifeOsData({ relations: [{ id: 'r1', fromUid: 'a', toUid: 'b', label: 'Inspired by' }], reviews: [] });
    expect(migrated.relations[0]).toEqual(expect.objectContaining({ type: 'Related', label: 'Inspired by' }));
    expect(relationsFor('b', migrated)).toEqual([{ relation: migrated.relations[0], direction: 'incoming' }]);
  });

  it('registers and round-trips every foundation store in backups', () => {
    const stores: Record<string, unknown> = {};
    for (const definition of FOUNDATION_TOOL_DEFINITIONS) {
      const key = lifeStoreKey(definition.config.id);
      expect(LIFE_OS_DATA_STORE_KEYS).toContain(key);
      stores[key] = { version: 1, records: [{ id: `${definition.pluginId}-1`, title: definition.label }], occurrenceCompletions: [] };
    }
    const backup = parseLifeOsBackup(JSON.parse(JSON.stringify(createLifeOsBackup([], [], [], stores))));
    for (const definition of FOUNDATION_TOOL_DEFINITIONS) expect(backup.stores).toHaveProperty(lifeStoreKey(definition.config.id));
    const planned = planLifeOsRestore(backup, {}).planned.map((item) => item.key);
    for (const definition of FOUNDATION_TOOL_DEFINITIONS) expect(planned).toContain(lifeStoreKey(definition.config.id));
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_PARA, mergePara, parsePara, reviewSignals, type ParaData } from '../para';
import { routeCapture } from '../paraRouting';
import { areaIconId } from '../paraAreaIcons';

beforeEach(() => localStorage.clear());

describe('Modified PARA store', () => {
  it('round-trips the canonical envelope', () => {
    const data: ParaData = { ...EMPTY_PARA, projects: [{ id: 'p1', name: 'Ship', outcome: 'Released', status: 'Active', areaIds: [], priority: 'P1' }] };
    expect(parsePara(JSON.parse(JSON.stringify(data))).projects[0]).toMatchObject(data.projects[0]);
  });

  it('survives invalid storage and normalizes imported values', () => {
    expect(parsePara('{')).toMatchObject(EMPTY_PARA);
    const parsed = parsePara({ tasks: [{ id: 't1', title: 'Act', priority: 'invalid', status: 'invalid' }] });
    expect(parsed.tasks[0]).toMatchObject({ priority: 'P3', status: 'Inbox', energy: 'Medium' });
  });

  it('merges repeat imports by source id', () => {
    const oldData = parsePara({ areas: [{ id: 'old', sourceId: 'notion-1', name: 'Old name' }] });
    const newData = parsePara({ areas: [{ id: 'new', sourceId: 'notion-1', name: 'New name' }] });
    expect(mergePara(oldData, newData).areas.map((area) => area.name)).toEqual(['New name']);
  });

  it('preserves chosen area icons and gives legacy areas a useful icon', () => {
    const data = parsePara({ areas: [
      { id: 'health', name: 'Health', category: 'Life' },
      { id: 'fitness', name: 'Strength training', category: 'Health', parentId: 'health', icon: 'fitness' },
    ] });
    expect(areaIconId(data.areas[0])).toBe('health');
    expect(areaIconId(data.areas[1])).toBe('fitness');
    expect(parsePara(JSON.parse(JSON.stringify(data))).areas[1]).toMatchObject({ parentId: 'health', icon: 'fitness' });
  });
});

describe('PARA behavior', () => {
  it('routes a capture into a task and removes it from inbox', () => {
    const data = parsePara({ inbox: [{ id: 'i1', title: 'Call dentist', kind: 'Task', capturedAt: '2026-09-03' }] });
    const routed = routeCapture(data, data.inbox[0], 'task');
    expect(routed.inbox).toEqual([]);
    expect(routed.tasks[0]).toMatchObject({ title: 'Call dentist', status: 'Inbox' });
  });

  it('detects structural review problems', () => {
    const data = parsePara({
      projects: [{ id: 'p1', name: 'Degree', status: 'Active' }],
      areas: [{ id: 'a1', name: 'Health', health: 'Messy' }],
      resources: [{ id: 'r1', title: 'Book notes' }],
      goals: [{ id: 'g1', title: 'Graduate', status: 'Active' }],
      inbox: [{ id: 'i1', title: 'Thought', capturedAt: '2026-09-03' }],
    });
    expect(reviewSignals(data)).toEqual(expect.arrayContaining([
      'Project without a next action: Degree',
      'Area needs attention: Health (Messy)',
      '1 unprocessed capture',
      '1 orphan resource',
      'Active arc without a subarea: Graduate',
    ]));
  });

  it('keeps arcs area-scoped and drops legacy project links', () => {
    const data = parsePara({
      goals: [{
        id: 'g1',
        title: 'Sustainable momentum',
        status: 'Active',
        projectIds: ['legacy-project'],
        areaIds: ['health', 'learning'],
      }],
    });
    expect(data.goals[0].areaIds).toEqual(['health', 'learning']);
    expect(data.goals[0]).not.toHaveProperty('projectIds');
  });
});

describe('PARA forward compatibility', () => {
  const stored = {
    version: 1,
    futureCollection: [{ id: 'x' }],
    projects: [{ id: 'p1', name: 'Vault', status: 'Planning', notes: 'details', laterField: { nested: true } }],
    areas: [{ id: 'a1', name: 'Records', futureFlag: 'keep' }],
    tasks: [{ id: 't1', title: 'Scan', estimate: 3 }],
    resources: [], goals: [], inbox: [], reviews: [],
  };

  it('keeps fields this version does not recognise', () => {
    const parsed = parsePara(stored) as ParaData & Record<string, unknown>;
    expect(parsed.futureCollection).toEqual([{ id: 'x' }]);
    expect(parsed.projects[0]).toMatchObject({ notes: 'details', laterField: { nested: true } });
    expect(parsed.areas[0]).toMatchObject({ futureFlag: 'keep' });
    expect(parsed.tasks[0]).toMatchObject({ estimate: 3 });
  });

  it('still validates known fields and survives a save round trip', () => {
    const parsed = parsePara({ ...stored, projects: [{ id: 'p1', name: 'Vault', status: 'Bogus', laterField: 1 }] });
    expect(parsed.projects[0].status).toBe('Idea');
    const again = parsePara(JSON.parse(JSON.stringify(parsed)));
    expect(again.projects[0]).toMatchObject({ laterField: 1 });
    expect((again as ParaData & Record<string, unknown>).futureCollection).toEqual([{ id: 'x' }]);
  });

  it('merges without dropping unknown top-level data', () => {
    const merged = mergePara(parsePara(stored), EMPTY_PARA) as ParaData & Record<string, unknown>;
    expect(merged.futureCollection).toEqual([{ id: 'x' }]);
    expect(merged.projects[0]).toMatchObject({ laterField: { nested: true } });
  });
});

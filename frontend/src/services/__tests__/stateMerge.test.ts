import { describe, expect, it } from 'vitest';
import { mergeState } from '../stateMerge';

const area = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, archived: false, ...extra });

describe('mergeState', () => {
  it('keeps both sides when different records change', () => {
    const base = { version: 1, areas: [area('home'), area('health')] };
    const local = { version: 1, areas: [area('home', { icon: 'house' }), area('health')] };
    const remote = { version: 1, areas: [area('home'), area('health', { archived: true })] };
    expect(mergeState(base, local, remote)).toEqual({ ok: true, value: {
      version: 1, areas: [area('home', { icon: 'house' }), area('health', { archived: true })] } });
  });

  it('merges different fields of one record and reports the same field as a conflict', () => {
    const base = { tasks: [{ id: 't1', title: 'Draft', done: false }] };
    expect(mergeState(base, { tasks: [{ id: 't1', title: 'Final draft', done: false }] },
      { tasks: [{ id: 't1', title: 'Draft', done: true }] }))
      .toEqual({ ok: true, value: { tasks: [{ id: 't1', title: 'Final draft', done: true }] } });
    expect(mergeState(base, { tasks: [{ id: 't1', title: 'Mine', done: false }] },
      { tasks: [{ id: 't1', title: 'Theirs', done: false }] }))
      .toEqual({ ok: false, path: '$.tasks[id=t1].title' });
  });

  it('applies additions and deletions from both sides and keeps local insert position', () => {
    const base = { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
    const local = { items: [{ id: 'a' }, { id: 'new-local' }, { id: 'c' }] }; // deleted b
    const remote = { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'new-remote' }] };
    expect(mergeState(base, local, remote)).toEqual({ ok: true, value: {
      items: [{ id: 'a' }, { id: 'new-local' }, { id: 'c' }, { id: 'new-remote' }] } });
  });

  it('refuses to silently drop an edit that the other side deleted', () => {
    const base = { items: [{ id: 'a', checked: false }] };
    expect(mergeState(base, { items: [] }, { items: [{ id: 'a', checked: true }] }))
      .toEqual({ ok: false, path: '$.items[id=a]' });
  });

  it('treats primitive lists as membership sets', () => {
    expect(mergeState(['x', 'y'], ['x', 'y', 'local'], ['y', 'remote']))
      .toEqual({ ok: true, value: ['y', 'remote', 'local'] });
  });

  it('merges a never-synchronized default with the server record instead of overwriting it', () => {
    const local = { version: 1, areas: [area('seeded'), area('added-offline')] };
    const remote = { version: 1, areas: [area('seeded'), area('from-desktop')] };
    expect(mergeState(undefined, local, remote)).toEqual({ ok: true, value: {
      version: 1, areas: [area('seeded'), area('added-offline'), area('from-desktop')] } });
  });

  it('reports scalar and shape changes on both sides as conflicts', () => {
    expect(mergeState(1, 2, 3)).toEqual({ ok: false, path: '$' });
    expect(mergeState({ a: 1 }, { a: [1] }, { a: { b: 1 } })).toEqual({ ok: false, path: '$.a' });
  });
});

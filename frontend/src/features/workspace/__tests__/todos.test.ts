import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyDueFilter,
  isDueThisWeek,
  isOverdue,
  listsOf,
  readTodos,
  sortTodos,
  todosForNote,
  writeTodos,
  type TodoItem,
} from '../todos';

const todo = (id: string, over: Partial<TodoItem> = {}): TodoItem => ({
  id,
  title: id,
  priority: 'MEDIUM',
  done: false,
  list: 'Inbox',
  ...over,
});

const TODAY = '2026-07-21';

beforeEach(() => localStorage.clear());

describe('due filters', () => {
  it('classifies overdue, today, and this week', () => {
    expect(isOverdue(todo('a', { dueDate: '2026-07-20' }), TODAY)).toBe(true);
    expect(isOverdue(todo('a', { dueDate: '2026-07-20', done: true }), TODAY)).toBe(false);
    expect(isDueThisWeek(todo('a', { dueDate: '2026-07-28' }), TODAY)).toBe(true);
    expect(isDueThisWeek(todo('a', { dueDate: '2026-07-29' }), TODAY)).toBe(false);
  });

  it('applyDueFilter selects the right subsets', () => {
    const items = [
      todo('open'),
      todo('today', { dueDate: TODAY }),
      todo('late', { dueDate: '2026-07-01' }),
      todo('done', { done: true }),
    ];
    expect(applyDueFilter(items, 'all', TODAY).map((t) => t.id)).toEqual(['open', 'today', 'late']);
    expect(applyDueFilter(items, 'today', TODAY).map((t) => t.id)).toEqual(['today']);
    expect(applyDueFilter(items, 'overdue', TODAY).map((t) => t.id)).toEqual(['late']);
    expect(applyDueFilter(items, 'done', TODAY).map((t) => t.id)).toEqual(['done']);
  });
});

describe('ordering and grouping', () => {
  it('sorts open before done, by due date then priority; no due date last', () => {
    const items = [
      todo('d', { done: true }),
      todo('nodue', { priority: 'URGENT' }),
      todo('late-low', { dueDate: '2026-07-01', priority: 'LOW' }),
      todo('late-urgent', { dueDate: '2026-07-01', priority: 'URGENT' }),
      todo('soon', { dueDate: '2026-07-22' }),
    ];
    expect(sortTodos(items).map((t) => t.id)).toEqual(['late-urgent', 'late-low', 'soon', 'nodue', 'd']);
  });

  it('groups by list and filters by note link', () => {
    const items = [todo('a', { list: 'Admin' }), todo('b'), todo('c', { noteId: 7 })];
    expect(listsOf(items)).toEqual(['Admin', 'Inbox']);
    expect(todosForNote(items, 7).map((t) => t.id)).toEqual(['c']);
  });
});

describe('persistence', () => {
  it('round-trips and tolerates corrupt storage', () => {
    writeTodos([todo('a')]);
    expect(readTodos()).toHaveLength(1);
    localStorage.setItem('modulo-todos', '???');
    expect(readTodos()).toEqual([]);
  });
});

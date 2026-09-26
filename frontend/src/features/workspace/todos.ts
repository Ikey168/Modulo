// Legacy storage adapters below support recovery and compatibility tests. Active views use synchronized operational state.
// Todo lists (#371) — task records with due dates, priorities, and note
// links. The model mirrors the orphaned features/tasks backend shape
// (priority values match its TaskPriority) so a later backend store can adopt
// these records; persistence is provided by the server-backed workspace state layer.

export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export const TODO_PRIORITIES: TodoPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export interface TodoItem {
  id: string;
  title: string;
  /** YYYY-MM-DD. */
  dueDate?: string;
  priority: TodoPriority;
  done: boolean;
  /** Grouping list, e.g. "Inbox", "Admin". */
  list: string;
  /** Linked note, if the task belongs to one. */
  noteId?: number;
}

export const DEFAULT_LIST = 'Inbox';

export const TODOS_STORE_KEY = 'modulo-todos';

export function parseTodos(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((todo): todo is TodoItem =>
    typeof todo === 'object' && todo !== null
    && typeof (todo as TodoItem).id === 'string'
    && typeof (todo as TodoItem).title === 'string'
    && TODO_PRIORITIES.includes((todo as TodoItem).priority)
    && typeof (todo as TodoItem).done === 'boolean'
    && typeof (todo as TodoItem).list === 'string',
  );
}

export function newTodoId(): string {
  return `td-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Filters & ordering ───────────────────────────────────────────────────────

export type DueFilter = 'all' | 'today' | 'week' | 'overdue' | 'done';

export function isOverdue(t: TodoItem, today: string): boolean {
  return !t.done && t.dueDate !== undefined && t.dueDate < today;
}

export function isDueToday(t: TodoItem, today: string): boolean {
  return t.dueDate === today;
}

export function isDueThisWeek(t: TodoItem, today: string): boolean {
  if (!t.dueDate) return false;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  const weekEnd = d.toISOString().slice(0, 10);
  return t.dueDate >= today && t.dueDate <= weekEnd;
}

export function applyDueFilter(todos: TodoItem[], filter: DueFilter, today: string): TodoItem[] {
  switch (filter) {
    case 'today':
      return todos.filter((t) => !t.done && isDueToday(t, today));
    case 'week':
      return todos.filter((t) => !t.done && isDueThisWeek(t, today));
    case 'overdue':
      return todos.filter((t) => isOverdue(t, today));
    case 'done':
      return todos.filter((t) => t.done);
    default:
      return todos.filter((t) => !t.done);
  }
}

const priorityRank = (p: TodoPriority): number => TODO_PRIORITIES.indexOf(p);

/** Open first by (due date, priority); no due date sorts last within priority. */
export function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const dueA = a.dueDate ?? '9999-99-99';
    const dueB = b.dueDate ?? '9999-99-99';
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return priorityRank(a.priority) - priorityRank(b.priority);
  });
}

export function todosForNote(todos: TodoItem[], noteId: number): TodoItem[] {
  return sortTodos(todos.filter((t) => t.noteId === noteId));
}

export function listsOf(todos: TodoItem[]): string[] {
  return [...new Set(todos.map((t) => t.list || DEFAULT_LIST))].sort();
}

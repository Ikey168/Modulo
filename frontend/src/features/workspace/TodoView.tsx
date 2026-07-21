// Todo view (#371): quick-add tasks with due date, priority and list; filter
// by due window; group by list; link tasks to notes. A tab in the
// Productivity hub. Persistence is client-side (backend adoption is the
// documented follow-up — the record shape mirrors the tasks backend).
import { useMemo, useState } from 'react';
import { CircleCheckBig, ListTodo, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, cn, EmptyState, Input, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import {
  applyDueFilter,
  DEFAULT_LIST,
  isOverdue,
  listsOf,
  newTodoId,
  readTodos,
  sortTodos,
  TODO_PRIORITIES,
  writeTodos,
  type DueFilter,
  type TodoItem,
  type TodoPriority,
} from './todos';

const PRIORITY_STYLE: Record<TodoPriority, string> = {
  URGENT: 'border-red-500/40 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/40 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-blue-500/40 text-blue-600 dark:text-blue-400',
  LOW: 'border-border text-muted-foreground',
};

const FILTERS: Array<{ id: DueFilter; label: string }> = [
  { id: 'all', label: 'open' },
  { id: 'today', label: 'today' },
  { id: 'week', label: 'this week' },
  { id: 'overdue', label: 'overdue' },
  { id: 'done', label: 'done' },
];

export function TodoView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const [todos, setTodos] = useState<TodoItem[]>(() => readTodos());
  const [filter, setFilter] = useState<DueFilter>('all');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');
  const [list, setList] = useState(DEFAULT_LIST);
  const [noteId, setNoteId] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const persist = (next: TodoItem[]) => {
    setTodos(next);
    writeTodos(next);
  };

  const add = () => {
    if (!title.trim()) return;
    const linkedNote = noteId ? Number(noteId) : undefined;
    persist([
      {
        id: newTodoId(),
        title: title.trim(),
        dueDate: due || undefined,
        priority,
        done: false,
        list: list.trim() || DEFAULT_LIST,
        noteId: linkedNote,
      },
      ...todos,
    ]);
    setTitle('');
    setDue('');
  };

  const toggle = (id: string) =>
    persist(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const remove = (id: string) => persist(todos.filter((t) => t.id !== id));

  const visible = useMemo(() => sortTodos(applyDueFilter(todos, filter, today)), [todos, filter, today]);
  const lists = useMemo(() => listsOf(visible), [visible]);
  const openCount = todos.filter((t) => !t.done).length;
  const overdueCount = todos.filter((t) => isOverdue(t, today)).length;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Todo</h2>
          <span className="text-xs text-muted-foreground">
            {openCount} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs',
                  filter === f.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add a task…"
            className="h-8 w-56 text-sm"
          />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="h-8 w-36 text-sm" />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
            aria-label="Priority"
            className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm"
          >
            {TODO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.toLowerCase()}
              </option>
            ))}
          </select>
          <Input value={list} onChange={(e) => setList(e.target.value)} aria-label="List" placeholder="List" className="h-8 w-28 text-sm" />
          <select
            value={noteId}
            onChange={(e) => setNoteId(e.target.value)}
            aria-label="Link to note"
            className="h-8 max-w-40 rounded-md border border-border bg-surface px-1.5 text-sm"
          >
            <option value="">No note</option>
            {data.notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={add}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={filter === 'done' ? <CircleCheckBig className="size-5" /> : <ListTodo className="size-5" />}
            title={todos.length === 0 ? 'No tasks yet' : 'Nothing here'}
            description={
              todos.length === 0
                ? 'Add tasks with due dates and priorities; link them to engagement or client notes.'
                : 'Try another filter.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {lists.map((l) => (
            <section key={l} className="rounded-md border border-border">
              <header className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-medium">{l}</header>
              <ul className="divide-y divide-border/60">
                {visible
                  .filter((t) => (t.list || DEFAULT_LIST) === l)
                  .map((t) => {
                    const note = t.noteId != null ? data.notes.find((n) => n.id === t.noteId) : undefined;
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                        <Checkbox
                          checked={t.done}
                          onCheckedChange={() => {
                            toggle(t.id);
                            if (!t.done) toast({ title: 'Done', description: t.title });
                          }}
                          aria-label={`Mark ${t.title} ${t.done ? 'open' : 'done'}`}
                        />
                        <span className={cn('min-w-0 flex-1 truncate', t.done && 'text-muted-foreground line-through')}>
                          {t.title}
                        </span>
                        {note && (
                          <button
                            type="button"
                            onClick={() => onOpenNote(note.id)}
                            className="max-w-32 truncate text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {note.title}
                          </button>
                        )}
                        {t.dueDate && (
                          <span
                            className={cn(
                              'font-mono text-xs',
                              isOverdue(t, today) ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                            )}
                          >
                            {t.dueDate}
                          </span>
                        )}
                        <span className={cn('rounded-full border px-1.5 text-xxs lowercase', PRIORITY_STYLE[t.priority])}>
                          {t.priority.toLowerCase()}
                        </span>
                        <button
                          type="button"
                          aria-label="Delete task"
                          onClick={() => remove(t.id)}
                          className="text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

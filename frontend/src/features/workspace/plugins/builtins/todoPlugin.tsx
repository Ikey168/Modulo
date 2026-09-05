import { useOperationalCollection } from '../../useOperationalCollection';
import { TODO_COLLECTION } from '../../operationalSchemas';
import { OperationalStateNotice } from '../OperationalStateNotice';
// Todo lists (#371) — tasks with due dates, priorities, lists, and note
// links; Productivity hub tab plus a note panel showing (and adding) the
// current note's tasks. Client-side persistence; the record shape mirrors the
// tasks backend so a server store can adopt it later.
import { useState } from 'react';
import { ListTodo } from 'lucide-react';
import { Checkbox, Input } from '@/ui';
import { TodoView } from '../../TodoView';
import {
  DEFAULT_LIST,
  newTodoId,
  todosForNote,
} from '../../todos';
import type { NotePanelProps, PluginModule, WorkspaceViewProps } from '../types';

function TodoSurface(p: WorkspaceViewProps) {
  return <TodoView {...p} />;
}

function NoteTasksPanel({ note }: NotePanelProps) {
  const synced = useOperationalCollection(TODO_COLLECTION);
  const [title, setTitle] = useState('');
  const todos = synced.value;
  const linked = todosForNote(todos, note.id);

  const add = () => {
    if (!synced.ready) return;
    if (!title.trim()) return;
    synced.set([
      { id: newTodoId(), title: title.trim(), priority: 'MEDIUM', done: false, list: DEFAULT_LIST, noteId: note.id },
      ...todos,
    ]);
    setTitle('');
  };

  const toggle = (id: string) => {
    synced.set(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <OperationalStateNotice label="Tasks" {...synced} />
      {linked.length === 0 && <p className="px-0.5 text-xs text-muted-foreground">No tasks for this note.</p>}
      {linked.map((t) => (
        <label key={t.id} className="flex items-center gap-1.5 text-xs">
          <Checkbox checked={t.done} onCheckedChange={() => toggle(t.id)} aria-label={t.title} />
          <span className={t.done ? 'text-muted-foreground line-through' : ''}>{t.title}</span>
          {t.dueDate && <span className="ml-auto font-mono text-xxs text-muted-foreground">{t.dueDate}</span>}
        </label>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add task…"
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

const todoPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'todo', label: 'Todo', icon: ListTodo, order: 65, mode: 'productivity', component: TodoSurface });
    ctx.addNotePanel({ id: 'note-tasks', title: 'Tasks', order: 30, component: NoteTasksPanel });
  },
};

export default todoPlugin;

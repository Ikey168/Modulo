import { useMemo, useState } from 'react';
import { Archive, CheckCircle2, ListTodo, Plus } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Textarea } from '@/ui';
import {
  Choice,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  ListRow,
  ListRows,
  Panel,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
  type StatusVariant,
} from './viewkit';
import { PopoverEditor } from './EntryPopover';
import {
  ENERGIES,
  PRIORITIES,
  TASK_STATUSES,
  isoDay,
  newParaId,
  type ParaArea,
  type ParaProject,
  type ParaTask,
} from './para';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { useParaStore } from './useParaStore';
import { DEVICE_TAG_OPTIONS, deviceTagLabel, parseTaskTags, serializeTaskTags, taskTagsInclude } from '../taskTags';

type Filter = 'open' | 'today' | 'overdue' | 'waiting' | 'done';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
];

/** "Inbox" and "Waiting" are holding states here, not failures. */
const TASK_TONE: Record<string, StatusVariant> = {
  inbox: 'outline',
  next: 'info',
  waiting: 'warning',
  scheduled: 'info',
  done: 'success',
};

const PRIORITY_TONE: Record<string, StatusVariant> = {
  p1: 'destructive',
  p2: 'warning',
  p3: 'outline',
  p4: 'outline',
};

const emptyTask = (): ParaTask => ({
  id: newParaId('task'),
  title: '',
  status: 'Next',
  priority: 'P3',
  energy: 'Medium',
});

const matchesFilter = (task: ParaTask, filter: Filter, today: string): boolean => {
  if (filter === 'open') return task.status !== 'Done';
  if (filter === 'today') return task.status !== 'Done' && task.doDate === today;
  if (filter === 'overdue') return task.status !== 'Done' && Boolean(task.deadline && task.deadline < today);
  if (filter === 'waiting') return task.status === 'Waiting';
  return task.status === 'Done';
};

/** Task fields shared by the create popover and the edit sheet. */
function TaskFields({
  draft,
  setDraft,
  projects,
  areas,
}: {
  draft: ParaTask;
  setDraft: (next: ParaTask) => void;
  projects: ParaProject[];
  areas: ParaArea[];
}) {
  const tags = parseTaskTags(draft.tags);
  const toggleDeviceTag = (tag: string) => {
    setDraft({
      ...draft,
      tags: tags.some(candidate => candidate.toLocaleLowerCase() === tag)
        ? tags.filter(candidate => candidate.toLocaleLowerCase() !== tag)
        : [...tags, tag],
    });
  };

  return (
    <div className="grid min-w-0 gap-4">
      <FieldGroup legend="Action" columns={2} contentClassName="gap-y-4">
        <Field label="Next action" hint="Concrete enough to start without deciding anything." className="sm:col-span-2" layout="stacked">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={TASK_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as ParaTask['status'] })}
          layout="stacked"
        />
        <Choice
          label="Priority"
          value={draft.priority}
          options={PRIORITIES}
          onChange={(priority) => setDraft({ ...draft, priority: priority as ParaTask['priority'] })}
          layout="stacked"
        />
        <Choice
          label="Energy"
          value={draft.energy}
          options={ENERGIES}
          onChange={(energy) => setDraft({ ...draft, energy: energy as ParaTask['energy'] })}
          layout="stacked"
        />
        <Field label="Context" hint="Where or with what this can be done." className="sm:col-span-2" layout="stacked">
          <Textarea
            rows={3}
            value={draft.context ?? ''}
            onChange={(event) => setDraft({ ...draft, context: event.target.value || undefined })}
          />
        </Field>
        <Field label="Tags" hint="Use device:desktop, device:pi5, device:netcup, or another comma-separated tag." className="sm:col-span-2" layout="stacked">
          <div className="grid gap-2">
            <Input
              value={serializeTaskTags(draft.tags)}
              onChange={(event) => setDraft({ ...draft, tags: parseTaskTags(event.target.value) })}
              placeholder="device:netcup, build"
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Device tags">
              {DEVICE_TAG_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={tags.includes(option.value)}
                  onClick={() => toggleDeviceTag(option.value)}
                  className={`rounded border px-1.5 py-1 text-xxs ${tags.includes(option.value) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border-strong'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </FieldGroup>
      <FieldGroup legend="When" columns={2} contentClassName="gap-y-4">
        <Field label="Do date" hint="An intention: the day you plan to work on it." layout="stacked">
          <Input
            type="date"
            value={draft.doDate ?? ''}
            onChange={(event) => setDraft({ ...draft, doDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Deadline" hint="A consequence: the day it is late." layout="stacked">
          <Input
            type="date"
            value={draft.deadline ?? ''}
            onChange={(event) => setDraft({ ...draft, deadline: event.target.value || undefined })}
          />
        </Field>
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="No block"
          placeholder="No block"
          options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as DayBlockId | undefined })}
          className="sm:col-span-2"
          layout="stacked"
        />
      </FieldGroup>
      <FieldGroup legend="Belongs to" columns={2} contentClassName="gap-y-4">
        <Choice
          label="Project"
          value={draft.projectId ?? ''}
          clearable
          clearLabel="No project"
          placeholder="No project"
          options={projects.map((project) => ({ value: project.id, label: project.name || 'Untitled project' }))}
          onChange={(projectId) => setDraft({ ...draft, projectId: projectId || undefined })}
          layout="stacked"
        />
        <Choice
          label="Area"
          value={draft.areaId ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={areas.map((area) => ({ value: area.id, label: area.name || 'Untitled area' }))}
          onChange={(areaId) => setDraft({ ...draft, areaId: areaId || undefined })}
          layout="stacked"
        />
      </FieldGroup>
    </div>
  );
}

export function ParaTasksView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyTask);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [tagFilter, setTagFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const today = isoDay();

  const projects = data.projects.filter((project) => !project.archivedAt);
  const areas = data.areas.filter((area) => !area.archivedAt);
  const live = useMemo(() => data.tasks.filter((task) => !task.archivedAt), [data.tasks]);
  const tagFilterOptions = useMemo(() => {
    const counts = new Map<string, { tag: string; count: number }>();
    for (const task of live) {
      for (const tag of parseTaskTags(task.tags)) {
        const key = tag.toLocaleLowerCase();
        const current = counts.get(key);
        if (current) current.count += 1;
        else counts.set(key, { tag, count: 1 });
      }
    }
    const deviceOrder = new Map(DEVICE_TAG_OPTIONS.map((option, index) => [option.value, index]));
    const tags = [...counts.values()].sort((left, right) => {
      const leftDevice = deviceOrder.get(left.tag.toLocaleLowerCase());
      const rightDevice = deviceOrder.get(right.tag.toLocaleLowerCase());
      if (leftDevice !== undefined || rightDevice !== undefined) {
        if (leftDevice === undefined) return 1;
        if (rightDevice === undefined) return -1;
        return leftDevice - rightDevice;
      }
      return left.tag.localeCompare(right.tag);
    });
    return [
      { value: '', label: 'All tags', count: live.length },
      ...tags.map(({ tag, count }) => ({
        value: tag,
        label: tag.toLocaleLowerCase().startsWith('device:') ? deviceTagLabel(tag.toLocaleLowerCase()) : tag,
        count,
      })),
    ];
  }, [live]);
  const tagFilteredLive = useMemo(
    () => tagFilter ? live.filter((task) => taskTagsInclude(task.tags, tagFilter)) : live,
    [live, tagFilter],
  );

  const add = () => {
    if (!draft.title.trim()) return;
    persist((current) => ({ ...current, tasks: [{ ...draft, title: draft.title.trim() }, ...current.tasks] }));
    setDraft(emptyTask());
  };

  const patch = (id: string, update: Partial<ParaTask>) =>
    persist((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...update } : task)),
    }));

  const save = (next: ParaTask) =>
    persist((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === next.id ? next : task)),
    }));

  const archive = (id: string) => {
    patch(id, { archivedAt: new Date().toISOString() });
    setOpenId(null);
  };

  const projectName = (id: string | undefined) => projects.find((project) => project.id === id)?.name;
  const areaName = (id: string | undefined) => areas.find((area) => area.id === id)?.name;
  const blockLabel = (id: DayBlockId | undefined) => DAY_BLOCKS.find((block) => block.id === id)?.label;

  const tasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return live
      .filter((task) => {
        if (!matchesFilter(task, filter, today)) return false;
        if (tagFilter && !taskTagsInclude(task.tags, tagFilter)) return false;
        if (!needle) return true;
        return `${task.title} ${task.context ?? ''} ${task.tags?.join(' ') ?? ''} ${task.status} ${task.priority}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.priority.localeCompare(b.priority) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  }, [live, filter, query, tagFilter, today]);

  const open = live.find((task) => task.id === openId) ?? null;

  return (
    <ViewShell
      title="Tasks & Next Actions"
      icon={ListTodo}
      subtitle="Do dates are intentional; deadlines are consequences."
      actions={
        <PopoverEditor title="Add task">
          <TaskFields draft={draft} setDraft={setDraft} projects={projects} areas={areas} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add task
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search tasks…" label="Search tasks" />
          <FilterChips
            label="Filter tasks"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((item) => ({
              ...item,
              count: tagFilteredLive.filter((task) => matchesFilter(task, item.value, today)).length,
            }))}
          />
          <FilterChips
            label="Filter by tag"
            value={tagFilter}
            onChange={setTagFilter}
            options={tagFilterOptions}
          />
        </Toolbar>
      }
    >
      <Panel title="Actions" icon={ListTodo} bodyClassName="p-0">
        {tasks.length === 0 ? (
          <EmptyPanel
            icon={filter === 'done' ? CheckCircle2 : ListTodo}
            title={live.length === 0 ? 'No tasks yet' : 'Nothing in this view'}
            description={
              live.length === 0
                ? 'Capture a concrete next action to get started.'
                : 'Try another search or filter.'
            }
          />
        ) : (
          <ListRows>
            {tasks.map((task) => {
              const overdue = Boolean(task.deadline && task.deadline < today && task.status !== 'Done');
              return (
                <ListRow
                  key={task.id}
                  title={task.title}
                  muted={task.status === 'Done'}
                  onOpen={() => setOpenId(task.id)}
                  leading={
                    <Checkbox
                      checked={task.status === 'Done'}
                      onCheckedChange={(checked) => patch(task.id, { status: checked ? 'Done' : 'Next' })}
                      aria-label={task.status === 'Done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    />
                  }
                  detail={
                    <>
                      {task.priority} · {task.energy} energy
                      {projectName(task.projectId) ? ` · ${projectName(task.projectId)}` : ''}
                      {blockLabel(task.blockId) ? ` · ${blockLabel(task.blockId)}` : ''}
                      {task.doDate ? ` · do ${task.doDate}` : ''}
                    </>
                  }
                  meta={
                    <>
                      {parseTaskTags(task.tags).map(tag => (
                        <Badge key={tag} variant="outline" className="rounded-sm">
                          {tag.startsWith('device:') ? deviceTagLabel(tag) : tag}
                        </Badge>
                      ))}
                      {task.deadline && (
                        <Badge variant={overdue ? 'destructive' : 'outline'}>
                          {overdue ? `Overdue ${task.deadline}` : `Due ${task.deadline}`}
                        </Badge>
                      )}
                      <StatusBadge status={task.status} overrides={TASK_TONE} />
                    </>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        contentClassName="sm:w-[min(94vw,760px)]"
        title={open?.title ?? ''}
        editTitle="Edit task"
        subtitle={open ? `${open.status} · ${open.priority} · ${open.energy} energy` : undefined}
        badges={
          open && (
            <>
              <StatusBadge status={open.status} overrides={TASK_TONE} />
              <StatusBadge status={open.priority} overrides={PRIORITY_TONE} />
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <TaskFields draft={current} setDraft={setCurrent} projects={projects} areas={areas} />
        )}
        onSave={save}
        actions={
          open && (
            <Button size="sm" variant="outline" onClick={() => archive(open.id)}>
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </Button>
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Do date" value={open.doDate} placeholder="No do date" emphasis />
            <Fact
              label="Deadline"
              value={open.deadline}
              placeholder="No deadline"
              emphasis={Boolean(open.deadline && open.deadline < today)}
            />
            <Fact label="Energy" value={`${open.energy} energy`} />
            <Fact label="Day block" value={blockLabel(open.blockId)} placeholder="Unblocked" />
            <Fact label="Project" value={projectName(open.projectId)} placeholder="No project" />
            <Fact label="Area" value={areaName(open.areaId)} placeholder="No area" />
            <Fact label="Tags" value={serializeTaskTags(open.tags)} placeholder="No tags" wide />
            <Fact label="Context" value={open.context} wide placeholder="No context recorded" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

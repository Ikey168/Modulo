import { useMemo, useState } from 'react';
import { Archive, Plus, Target } from 'lucide-react';
import { Badge, Button, Input, Progress, Textarea } from '@/ui';
import {
  CardGrid,
  Choice,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  RecordCard,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
  type StatusVariant,
} from './viewkit';
import { PopoverEditor } from './EntryPopover';
import {
  GOAL_LEVELS,
  GOAL_STATUSES,
  newParaId,
  type ParaArea,
  type ParaGoal,
  type ParaProject,
} from './para';
import { useParaStore } from './useParaStore';

/** "Emerging" and "Closing" are lifecycle stages here, not warnings or successes. */
const GOAL_TONE: Record<string, StatusVariant> = {
  emerging: 'outline',
  active: 'info',
  closing: 'warning',
  archived: 'secondary',
};

const emptyGoal = (): ParaGoal => ({
  id: newParaId('goal'),
  title: '',
  level: 'Goal',
  status: 'Active',
  progress: 0,
  projectIds: [],
  areaIds: [],
});

const arcLevelLabel = (level: ParaGoal['level']): string => level === 'Goal' ? 'Arc' : level;

/** Goal fields shared by the create popover and the edit sheet. */
function GoalFields({
  draft,
  setDraft,
  projects,
  areas,
}: {
  draft: ParaGoal;
  setDraft: (next: ParaGoal) => void;
  projects: ParaProject[];
  areas: ParaArea[];
}) {
  return (
    <>
      <FieldGroup legend="Direction" columns={2}>
        <Field label="Title" hint="An outcome or direction, not a task." className="sm:col-span-2">
          <Textarea
            rows={2}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>
        <Choice
          label="Level"
          value={draft.level}
          options={GOAL_LEVELS.map((level) => ({ value: level, label: arcLevelLabel(level) }))}
          onChange={(level) => setDraft({ ...draft, level: level as ParaGoal['level'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={GOAL_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as ParaGoal['status'] })}
        />
        <Field label="Horizon" hint="The window this arc lives in, e.g. “2026 H1”.">
          <Input
            value={draft.horizon ?? ''}
            onChange={(event) => setDraft({ ...draft, horizon: event.target.value || undefined })}
          />
        </Field>
        <Field label="Progress" hint="Percent complete, 0–100.">
          <Input
            type="number"
            min={0}
            max={100}
            value={draft.progress}
            onChange={(event) =>
              setDraft({ ...draft, progress: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })
            }
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Realized by" columns={2}>
        <Choice
          label="Project"
          value={draft.projectIds[0] ?? ''}
          clearable
          clearLabel="No project"
          placeholder="No project"
          options={projects.map((project) => ({ value: project.id, label: project.name || 'Untitled project' }))}
          onChange={(projectId) => setDraft({ ...draft, projectIds: projectId ? [projectId] : [] })}
        />
        <Choice
          label="Area"
          value={draft.areaIds[0] ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={areas.map((area) => ({ value: area.id, label: area.name || 'Untitled area' }))}
          onChange={(areaId) => setDraft({ ...draft, areaIds: areaId ? [areaId] : [] })}
        />
      </FieldGroup>
    </>
  );
}

export function ParaGoalsView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyGoal);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const projects = data.projects.filter((project) => !project.archivedAt);
  const areas = data.areas.filter((area) => !area.archivedAt);
  const goals = useMemo(() => data.goals.filter((goal) => !goal.archivedAt), [data.goals]);

  const add = () => {
    if (!draft.title.trim()) return;
    persist((current) => ({ ...current, goals: [{ ...draft, title: draft.title.trim() }, ...current.goals] }));
    setDraft(emptyGoal());
  };

  const save = (next: ParaGoal) =>
    persist((current) => ({
      ...current,
      goals: current.goals.map((goal) => (goal.id === next.id ? next : goal)),
    }));

  const archive = (id: string) => {
    persist((current) => ({
      ...current,
      goals: current.goals.map((goal) =>
        goal.id === id ? { ...goal, archivedAt: new Date().toISOString(), status: 'Archived' } : goal,
      ),
    }));
    setOpenId(null);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return goals
      .filter((goal) => {
        if (status !== 'all' && goal.status !== status) return false;
        if (!needle) return true;
        return `${goal.title} ${goal.level} ${goal.horizon ?? ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.progress - a.progress);
  }, [goals, query, status]);

  const open = goals.find((goal) => goal.id === openId) ?? null;
  const projectName = (id: string | undefined) => projects.find((project) => project.id === id)?.name;
  const areaName = (id: string | undefined) => areas.find((area) => area.id === id)?.name;

  return (
    <ViewShell
      title="Arcs"
      icon={Target}
      subtitle="Long-range direction across Projects and Areas — not another task list."
      actions={
        <PopoverEditor title="Add arc">
          <GoalFields draft={draft} setDraft={setDraft} projects={projects} areas={areas} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add arc
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search arcs…" label="Search arcs" />
          <FilterChips
            label="Filter arcs by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: goals.length },
              ...GOAL_STATUSES.map((value) => ({
                value,
                label: value,
                count: goals.filter((goal) => goal.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={Target}
          size="page"
          title={goals.length === 0 ? 'No arcs' : 'No arcs match'}
          description={
            goals.length === 0
              ? 'Add an arc, then connect the Projects that realize it.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((goal) => (
            <RecordCard
              key={goal.id}
              title={goal.title}
              onOpen={() => setOpenId(goal.id)}
              badges={
                <>
                  <StatusBadge status={goal.status} overrides={GOAL_TONE} />
                  <Badge variant="secondary">{arcLevelLabel(goal.level)}</Badge>
                </>
              }
              detail={
                <p>
                  {goal.horizon || 'No horizon set'}
                  {projectName(goal.projectIds[0]) ? ` · ${projectName(goal.projectIds[0])}` : ''}
                </p>
              }
              footer={
                <div className="flex items-center gap-2">
                  <Progress value={goal.progress} className="h-1.5 flex-1" />
                  <span className="tabular-nums">{goal.progress}%</span>
                </div>
              }
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${open.level} · ${open.status}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={GOAL_TONE} />}
        renderEdit={(current, setCurrent) => (
          <GoalFields draft={current} setDraft={setCurrent} projects={projects} areas={areas} />
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
            <Fact
              label="Progress"
              wide
              emphasis
              value={
                <span className="flex items-center gap-2">
                  <Progress value={open.progress} className="h-1.5 flex-1" />
                  <span className="tabular-nums">{open.progress}%</span>
                </span>
              }
            />
            <Fact label="Level" value={arcLevelLabel(open.level)} />
            <Fact label="Horizon" value={open.horizon} placeholder="No horizon set" />
            <Fact label="Project" value={projectName(open.projectIds[0])} placeholder="No project connected" />
            <Fact label="Area" value={areaName(open.areaIds[0])} placeholder="No area connected" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

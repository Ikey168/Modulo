import { useMemo, useState } from 'react';
import { Archive, Check, ChevronsUpDown, Plus, Target } from 'lucide-react';
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Textarea,
  cn,
} from '@/ui';
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
  areaIds: [],
});

const arcLevelLabel = (level: ParaGoal['level']): string => level === 'Goal' ? 'Arc' : level;

function SubareaPicker({
  id,
  value,
  onChange,
  areas,
  areaNames,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  areas: ParaArea[];
  areaNames: ReadonlyMap<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const selected = areas.filter((area) => value.includes(area.id));
  const summary = selected.length === 0
    ? 'Select subareas…'
    : selected.length === 1
      ? selected[0].name
      : `${selected.length} subareas selected`;
  const toggle = (areaId: string) => onChange(
    value.includes(areaId) ? value.filter((id) => id !== areaId) : [...value, areaId],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>{summary}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,28rem)] p-0">
        <Command>
          <CommandInput placeholder="Search subareas…" />
          <CommandList>
            <CommandEmpty>No matching subareas.</CommandEmpty>
            <CommandGroup>
              {areas.map((area) => {
                const checked = value.includes(area.id);
                return (
                  <CommandItem
                    key={area.id}
                    value={`${area.name} ${area.parentId ? areaNames.get(area.parentId) ?? '' : ''}`}
                    onSelect={() => toggle(area.id)}
                  >
                    <Check className={cn('size-4', checked ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{area.name}</span>
                    {area.parentId && areaNames.get(area.parentId) && (
                      <span className="truncate text-xs text-muted-foreground">{areaNames.get(area.parentId)}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Goal fields shared by the create popover and the edit sheet. */
function GoalFields({
  draft,
  setDraft,
  areas,
  areaNames,
}: {
  draft: ParaGoal;
  setDraft: (next: ParaGoal) => void;
  areas: ParaArea[];
  areaNames: ReadonlyMap<string, string>;
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
        <Field label="Horizon" hint="The quarter this arc lives in, e.g. “2026 Q4”.">
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
      <FieldGroup legend="Scope" columns={1}>
        <Field label="Subareas" hint="Choose every responsibility this Arc should guide.">
          <SubareaPicker
            value={draft.areaIds}
            onChange={(areaIds) => setDraft({ ...draft, areaIds })}
            areas={areas}
            areaNames={areaNames}
          />
        </Field>
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

  const areas = useMemo(
    () => data.areas
      .filter((area) => !area.archivedAt && area.parentId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data.areas],
  );
  const areaNamesById = useMemo(
    () => new Map(data.areas.map((area) => [area.id, area.name])),
    [data.areas],
  );
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
  const selectedAreaNames = (ids: string[]) => ids
    .map((id) => areaNamesById.get(id))
    .filter((name): name is string => Boolean(name));

  return (
    <ViewShell
      title="Arcs"
      icon={Target}
      subtitle="Quarterly direction across several subareas — not another task list."
      actions={
        <PopoverEditor title="Add arc">
          <GoalFields draft={draft} setDraft={setDraft} areas={areas} areaNames={areaNamesById} />
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
              ? 'Add an arc, then choose the subareas it should guide.'
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
                  {goal.areaIds.length > 0 ? ` · ${goal.areaIds.length} subarea${goal.areaIds.length === 1 ? '' : 's'}` : ''}
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
          <GoalFields draft={current} setDraft={setCurrent} areas={areas} areaNames={areaNamesById} />
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
            <Fact
              label="Subareas"
              wide
              value={selectedAreaNames(open.areaIds).join(', ')}
              placeholder="No subareas connected"
            />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

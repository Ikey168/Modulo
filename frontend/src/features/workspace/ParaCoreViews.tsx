import { useMemo, useState } from 'react';
import { ArchiveRestore, Box, ChevronDown, ChevronRight, FolderKanban, Map as MapIcon, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Textarea } from '@/ui';
import {
  CardGrid,
  Choice,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  LinkOut,
  ListRow,
  ListRows,
  Panel,
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
  AREA_FOCUS,
  AREA_HEALTH,
  PRIORITIES,
  PROJECT_STATUSES,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  newParaId,
  projectsForArea,
  type ParaArea,
  type ParaProject,
  type ParaResource,
} from './para';
import { AREA_CHECKLIST_HEALTH, newRequirement, requirementsFor, withRequirements } from './areaRequirements';
import { useParaStore } from './useParaStore';
import { AREA_ICON_OPTIONS } from './paraAreaIcons';
import { AreaIcon } from './AreaIcon';
import { NoteMarkdown } from '../notes/rendering/NoteMarkdown';

const archiveNow = () => new Date().toISOString();

/**
 * Domain vocabulary the shared tone table cannot infer: an *Active* PARA
 * project is in flight, not finished, so it must not read as success green.
 */
const PROJECT_TONE: Record<string, StatusVariant> = {
  idea: 'outline',
  planning: 'warning',
  active: 'info',
  'on hold': 'warning',
  done: 'success',
};

const AREA_TONE: Record<string, StatusVariant> = {
  'on fire': 'destructive',
  rebuilding: 'warning',
  messy: 'warning',
  growing: 'info',
  'under control': 'success',
  optimal: 'success',
};

const RESOURCE_TONE: Record<string, StatusVariant> = {
  inbox: 'warning',
  queued: 'info',
  'in progress': 'info',
  evergreen: 'success',
};

const emptyProject = (): ParaProject => ({
  id: newParaId('project'),
  name: '',
  outcome: '',
  status: 'Active',
  areaIds: [],
  priority: 'P3',
});

const emptyArea = (): ParaArea => ({
  id: newParaId('area'),
  name: '',
  category: 'Uncategorized',
  focus: 'Maintain',
  health: 'Growing',
  vision: '',
});

const emptyResource = (): ParaResource => ({
  id: newParaId('resource'),
  title: '',
  type: 'Note',
  status: 'Inbox',
  projectIds: [],
  areaIds: [],
});

const areaOptions = (areas: ParaArea[]) =>
  areas.map((area) => ({ value: area.id, label: area.name || 'Untitled area' }));

const projectOptions = (projects: ParaProject[]) =>
  projects.map((project) => ({ value: project.id, label: project.name || 'Untitled project' }));

/** Project fields shared by the create popover and the edit sheet. */
function ProjectFields({
  draft,
  setDraft,
  areas,
}: {
  draft: ParaProject;
  setDraft: (next: ParaProject) => void;
  areas: ParaArea[];
}) {
  return (
    <>
      <FieldGroup legend="Outcome" columns={1}>
        <Field label="Name">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field label="Definition of done" hint="What must be true for this project to be finished?">
          <Textarea
            rows={3}
            value={draft.outcome}
            onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}
          />
        </Field>
        <Field label="Notes" hint="Context, plans, specs and reference material for this project.">
          <Textarea
            rows={8}
            value={draft.notes ?? ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
            className="font-mono text-xs"
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Commitment" columns={2}>
        <Choice
          label="Status"
          value={draft.status}
          options={PROJECT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as ParaProject['status'] })}
        />
        <Choice
          label="Priority"
          value={draft.priority}
          options={PRIORITIES}
          onChange={(priority) => setDraft({ ...draft, priority: priority as ParaProject['priority'] })}
        />
        <Choice
          label="Area"
          value={draft.areaIds[0] ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={areaOptions(areas)}
          onChange={(areaId) => setDraft({ ...draft, areaIds: areaId ? [areaId] : [] })}
        />
        <Field label="Deadline" hint="A consequence date, not a wish.">
          <Input
            type="date"
            value={draft.deadline ?? ''}
            onChange={(event) => setDraft({ ...draft, deadline: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function ParaProjectsView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyProject);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const areas = data.areas.filter((area) => !area.archivedAt);
  const projects = useMemo(() => data.projects.filter((project) => !project.archivedAt), [data.projects]);

  const add = () => {
    if (!draft.name.trim()) return;
    persist((current) => ({ ...current, projects: [{ ...draft, name: draft.name.trim() }, ...current.projects] }));
    setDraft(emptyProject());
  };

  const save = (next: ParaProject) =>
    persist((current) => ({
      ...current,
      projects: current.projects.map((project) => (project.id === next.id ? next : project)),
    }));

  const archive = (id: string) => {
    persist((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? { ...project, archivedAt: archiveNow() } : project,
      ),
    }));
    setOpenId(null);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== 'all' && project.status !== status) return false;
      if (!needle) return true;
      return `${project.name} ${project.outcome} ${project.priority}`.toLowerCase().includes(needle);
    });
  }, [projects, query, status]);

  const open = projects.find((project) => project.id === openId) ?? null;
  const areaName = (id: string | undefined) => areas.find((area) => area.id === id)?.name;
  const hasNextAction = (id: string) =>
    data.tasks.some((task) => !task.archivedAt && task.projectId === id && task.status === 'Next');

  return (
    <ViewShell
      title="Projects"
      icon={FolderKanban}
      subtitle="Finite outcomes with a finish line."
      actions={
        <PopoverEditor title="Add project">
          <ProjectFields draft={draft} setDraft={setDraft} areas={areas} />
          <Button onClick={add} disabled={!draft.name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add project
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects…" label="Search projects" />
          <FilterChips
            label="Filter projects by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: projects.length },
              ...PROJECT_STATUSES.map((value) => ({
                value,
                label: value,
                count: projects.filter((project) => project.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={FolderKanban}
          size="page"
          title={projects.length === 0 ? 'No active projects' : 'No projects match'}
          description={
            projects.length === 0
              ? 'Create an outcome you can finish, pause, or archive.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((project) => (
            <RecordCard
              key={project.id}
              title={project.name}
              onOpen={() => setOpenId(project.id)}
              badges={
                <>
                  <StatusBadge status={project.status} overrides={PROJECT_TONE} />
                  <Badge variant="secondary">{project.priority}</Badge>
                  {project.status === 'Active' && !hasNextAction(project.id) && (
                    <Badge variant="warning">Needs next action</Badge>
                  )}
                </>
              }
              detail={
                <>
                  <p className="line-clamp-2">{project.outcome || 'Outcome not defined yet.'}</p>
                  <p>
                    {areaName(project.areaIds[0]) ?? 'No area'}
                    {project.deadline ? ` · due ${project.deadline}` : ''}
                  </p>
                </>
              }
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        subtitle={open ? `${open.status} · ${open.priority}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={PROJECT_TONE} />}
        renderEdit={(current, setCurrent) => (
          <ProjectFields draft={current} setDraft={setCurrent} areas={areas} />
        )}
        onSave={save}
        actions={
          open && (
            <Button size="sm" variant="outline" onClick={() => archive(open.id)}>
              <Box className="size-4" aria-hidden="true" />
              Archive
            </Button>
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Definition of done" value={open.outcome} wide emphasis />
            <Fact label="Priority" value={open.priority} />
            <Fact label="Deadline" value={open.deadline} placeholder="No deadline" />
            <Fact label="Area" value={areaName(open.areaIds[0])} placeholder="No area" />
            <Fact
              label="Next action"
              value={hasNextAction(open.id) ? 'Ready' : undefined}
              placeholder="None — this project is stalled"
            />
          </FactGrid>
        )}
        {open?.notes && (
          <section className="mt-5 border-t border-border pt-4" aria-label="Project notes">
            <h3 className="text-sm font-semibold">Notes</h3>
            <NoteMarkdown content={open.notes} className="mt-2 break-words" />
          </section>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Area fields shared by the create popover and the edit sheet. */
function AreaFields({
  draft,
  setDraft,
  areas,
}: {
  draft: ParaArea;
  setDraft: (next: ParaArea) => void;
  areas: ParaArea[];
}) {
  return (
    <>
      <FieldGroup legend="Responsibility" columns={2}>
        <Field label="Name" className="sm:col-span-2">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Choice
          label="Icon"
          value={draft.icon ?? ''}
          clearable
          clearLabel="Automatic"
          placeholder="Automatic"
          options={AREA_ICON_OPTIONS}
          onChange={(icon) => setDraft({ ...draft, icon: icon ? icon as ParaArea['icon'] : undefined })}
        />
        <Field label="Category" hint="Health, Career, Money, Home…">
          <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        </Field>
        <Choice
          label="Main area"
          value={draft.parentId ?? ''}
          clearable
          clearLabel="No main area"
          placeholder="No main area"
          hint="Leave blank to make this a main area."
          options={areaOptions(areas.filter((area) => !area.parentId && area.id !== draft.id))}
          disabled={areas.some((area) => area.parentId === draft.id)}
          onChange={(parentId) => setDraft({ ...draft, parentId: parentId || undefined })}
        />
      </FieldGroup>
      <FieldGroup legend="Standard" columns={2}>
        <Choice
          label="Focus"
          value={draft.focus}
          options={AREA_FOCUS}
          onChange={(focus) => setDraft({ ...draft, focus: focus as ParaArea['focus'] })}
        />
        <Choice
          label="Health"
          value={draft.health}
          options={AREA_HEALTH}
          onChange={(health) => setDraft({ ...draft, health: health as ParaArea['health'] })}
        />
        <Field label="Vision" hint="What does “under control” look like?" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={draft.vision}
            onChange={(event) => setDraft({ ...draft, vision: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

function AreaRequirements({ area, onChange }: { area: ParaArea; onChange: (next: ParaArea) => void }) {
  const [newText, setNewText] = useState<Record<string, string>>({});
  return (
    <section className="border-t border-border pt-4" aria-label="Health requirements">
      <h3 className="text-sm font-medium">Health requirements</h3>
      <p className="mt-1 text-xs text-muted-foreground">Check what is true for this area. Set its health separately with Edit.</p>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {AREA_CHECKLIST_HEALTH.map((health) => {
          const items = requirementsFor(area, health);
          const done = items.filter((item) => item.done).length;
          const update = (next: typeof items) => onChange(withRequirements(area, health, next));
          return (
            <div key={health} className="py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">{health}</h4>
                <span className="text-xs tabular-nums text-muted-foreground">{done}/{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-foreground"
                      checked={item.done}
                      onChange={(event) => update(items.map((current) => current.id === item.id ? { ...current, done: event.target.checked } : current))}
                      aria-label={`${health}: ${item.text}`}
                    />
                    <span className="min-w-0 flex-1">{item.text}</span>
                    <button
                      type="button"
                      className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${health} requirement: ${item.text}`}
                      onClick={() => update(items.filter((current) => current.id !== item.id))}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newText[health] ?? ''}
                  onChange={(event) => setNewText((current) => ({ ...current, [health]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const text = newText[health]?.trim();
                    if (!text) return;
                    update([...items, newRequirement(text)]);
                    setNewText((current) => ({ ...current, [health]: '' }));
                  }}
                  placeholder="Add a requirement"
                  aria-label={`New ${health} requirement`}
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" disabled={!newText[health]?.trim()} onClick={() => {
                  const text = newText[health]?.trim();
                  if (!text) return;
                  update([...items, newRequirement(text)]);
                  setNewText((current) => ({ ...current, [health]: '' }));
                }}>Add</Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ParaAreasView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyArea);
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const areas = useMemo(() => data.areas.filter((area) => !area.archivedAt), [data.areas]);

  const add = () => {
    if (!draft.name.trim()) return;
    persist((current) => ({ ...current, areas: [...current.areas, { ...draft, name: draft.name.trim() }] }));
    setDraft(emptyArea());
  };

  const save = (next: ParaArea) =>
    persist((current) => ({
      ...current,
      areas: current.areas.map((area) => (area.id === next.id ? next : area)),
    }));

  const saveRequirements = (next: ParaArea) =>
    persist((current) => ({
      ...current,
      areas: current.areas.map((area) => area.id === next.id ? { ...area, requirements: next.requirements, requirementsRevision: next.requirementsRevision } : area),
    }));

  const archive = (id: string) => {
    persist((current) => ({
      ...current,
      areas: current.areas.map((area) => (area.id === id ? { ...area, archivedAt: archiveNow() } : area)),
    }));
    setOpenId(null);
  };

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return new Set(areas.filter((area) => {
      if (health !== 'all' && area.health !== health) return false;
      if (!needle) return true;
      return `${area.name} ${area.category} ${area.focus} ${area.vision}`.toLowerCase().includes(needle);
    }).map((area) => area.id));
  }, [areas, query, health]);

  const groups = useMemo(() => {
    const byId = new Map(areas.map((area) => [area.id, area]));
    const rootOf = (area: ParaArea): ParaArea => {
      let current = area;
      const seen = new Set([area.id]);
      while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        current = byId.get(current.parentId)!;
      }
      return current;
    };
    const grouped = new Map<string, { main: ParaArea; subareas: ParaArea[] }>();
    for (const area of areas) {
      const main = rootOf(area);
      if (!grouped.has(main.id)) grouped.set(main.id, { main, subareas: [] });
      if (area.id !== main.id) grouped.get(main.id)!.subareas.push(area);
    }
    return [...grouped.values()].map((group) => {
      const mainMatches = matches.has(group.main.id);
      const showAll = health === 'all' && Boolean(query.trim()) && mainMatches;
      const visibleSubareas = showAll ? group.subareas : group.subareas.filter((area) => matches.has(area.id));
      return { ...group, visibleSubareas, visible: mainMatches || visibleSubareas.length > 0 };
    }).filter((group) => group.visible);
  }, [areas, matches, query, health]);

  const filtering = Boolean(query.trim()) || health !== 'all';
  const toggleExpanded = (id: string, expanded: boolean) =>
    setExpandedById((current) => ({ ...current, [id]: !expanded }));

  const open = areas.find((area) => area.id === openId) ?? null;
  const areaName = (id: string | undefined) => areas.find((area) => area.id === id)?.name;
  const assignedProjects = open ? projectsForArea(data, open.id) : [];

  return (
    <ViewShell
      title="Areas"
      icon={MapIcon}
      subtitle="Main areas and their ongoing subareas."
      actions={
        <PopoverEditor title="Add main area or subarea">
          <AreaFields draft={draft} setDraft={setDraft} areas={areas} />
          <Button onClick={add} disabled={!draft.name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add area
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={(value) => { setQuery(value); setExpandedById({}); }} placeholder="Search areas…" label="Search areas" />
          <FilterChips
            label="Filter areas by health"
            value={health}
            onChange={(value) => { setHealth(value); setExpandedById({}); }}
            options={[
              { value: 'all', label: 'All', count: areas.length },
              ...AREA_HEALTH.map((value) => ({
                value,
                label: value,
                count: areas.filter((area) => area.health === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {groups.length === 0 ? (
        <EmptyPanel
          icon={MapIcon}
          size="page"
          title={areas.length === 0 ? 'No areas yet' : 'No areas match'}
          description={
            areas.length === 0
              ? 'Start with responsibilities such as Health, Career, Relationships, Money, or Home.'
              : 'Try another search or health filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map(({ main, subareas, visibleSubareas }) => {
            const expanded = expandedById[main.id] ?? filtering;
            return (
              <section key={main.id} className="min-w-0 rounded-sm border border-border">
                <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                  {subareas.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(main.id, expanded)}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} subareas of ${main.name}`}
                      aria-expanded={expanded}
                      className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  ) : <span className="w-6 shrink-0" aria-hidden="true" />}
                  <AreaIcon area={main} className="size-4 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setOpenId(main.id)}
                    className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-sm font-medium">{main.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {main.category} · {subareas.length} subarea{subareas.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <StatusBadge status={main.health} overrides={AREA_TONE} />
                    <Badge variant="secondary">{main.focus}</Badge>
                  </div>
                </div>
                {expanded && visibleSubareas.length > 0 && (
                  <ListRows className="border-t border-border">
                    {visibleSubareas.map((area) => (
                      <ListRow
                        key={area.id}
                        title={area.name}
                        detail={area.vision || area.category}
                        leading={<AreaIcon area={area} className="size-4 text-muted-foreground" />}
                        onOpen={() => setOpenId(area.id)}
                        className="pl-10"
                        meta={
                          <>
                            <StatusBadge status={area.health} overrides={AREA_TONE} />
                            <Badge variant="secondary">{area.focus}</Badge>
                          </>
                        }
                      />
                    ))}
                  </ListRows>
                )}
              </section>
            );
          })}
        </div>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        subtitle={open && <span className="inline-flex items-center gap-1.5"><AreaIcon area={open} className="size-4" />{open.category} · {open.focus}</span>}
        badges={open && <StatusBadge status={open.health} overrides={AREA_TONE} />}
        renderEdit={(current, setCurrent) => <AreaFields draft={current} setDraft={setCurrent} areas={areas} />}
        onSave={save}
        actions={
          open && (
            <Button size="sm" variant="outline" onClick={() => archive(open.id)}>
              <Box className="size-4" aria-hidden="true" />
              Archive
            </Button>
          )
        }
      >
        {open && (
          <div className="space-y-4">
            <FactGrid>
              <Fact label="Vision" value={open.vision} wide emphasis placeholder="Standard not defined yet" />
              <Fact label="Category" value={open.category} />
              <Fact label="Focus" value={open.focus} />
              <Fact label="Health" value={open.health} />
              <Fact label="Main area" value={areaName(open.parentId)} placeholder="This is a main area" />
            </FactGrid>
            <AreaRequirements key={open.id} area={open} onChange={saveRequirements} />
            <Panel title={`Projects (${assignedProjects.length})`} icon={FolderKanban} bodyClassName={assignedProjects.length ? 'p-0' : undefined}>
              {assignedProjects.length ? (
                <ListRows>
                  {assignedProjects.map((project) => {
                    const subareaNames = project.areaIds
                      .filter((id) => id !== open.id)
                      .map((id) => areaName(id))
                      .filter((name): name is string => Boolean(name));
                    return (
                      <ListRow
                        key={project.id}
                        title={project.name}
                        detail={`${subareaNames.length ? `${subareaNames.join(', ')} · ` : ''}${project.outcome || 'Outcome not defined yet.'}`}
                        meta={
                          <>
                            <StatusBadge status={project.status} overrides={PROJECT_TONE} />
                            <Badge variant="secondary">{project.priority}</Badge>
                          </>
                        }
                      />
                    );
                  })}
                </ListRows>
              ) : (
                <p className="text-xs text-muted-foreground">No projects assigned to this area.</p>
              )}
            </Panel>
          </div>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Resource fields shared by the create popover and the edit sheet. */
function ResourceFields({
  draft,
  setDraft,
  projects,
  areas,
}: {
  draft: ParaResource;
  setDraft: (next: ParaResource) => void;
  projects: ParaProject[];
  areas: ParaArea[];
}) {
  return (
    <>
      <FieldGroup legend="Material" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={RESOURCE_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as ParaResource['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={RESOURCE_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as ParaResource['status'] })}
        />
        <Field label="Source URL" className="sm:col-span-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={draft.url ?? ''}
            onChange={(event) => setDraft({ ...draft, url: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Attachment" columns={2}>
        <Choice
          label="Project"
          value={draft.projectIds[0] ?? ''}
          clearable
          clearLabel="No project"
          placeholder="No project"
          options={projectOptions(projects)}
          onChange={(projectId) => setDraft({ ...draft, projectIds: projectId ? [projectId] : [] })}
        />
        <Choice
          label="Area"
          value={draft.areaIds[0] ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={areaOptions(areas)}
          onChange={(areaId) => setDraft({ ...draft, areaIds: areaId ? [areaId] : [] })}
        />
      </FieldGroup>
    </>
  );
}

export function ParaResourcesView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyResource);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const projects = data.projects.filter((project) => !project.archivedAt);
  const areas = data.areas.filter((area) => !area.archivedAt);
  const resources = useMemo(() => data.resources.filter((item) => !item.archivedAt), [data.resources]);

  const add = () => {
    if (!draft.title.trim()) return;
    persist((current) => ({
      ...current,
      resources: [{ ...draft, title: draft.title.trim() }, ...current.resources],
    }));
    setDraft(emptyResource());
  };

  const save = (next: ParaResource) =>
    persist((current) => ({
      ...current,
      resources: current.resources.map((item) => (item.id === next.id ? next : item)),
    }));

  const archive = (id: string) => {
    persist((current) => ({
      ...current,
      resources: current.resources.map((item) => (item.id === id ? { ...item, archivedAt: archiveNow() } : item)),
    }));
    setOpenId(null);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      if (status !== 'all' && resource.status !== status) return false;
      if (!needle) return true;
      return `${resource.title} ${resource.type} ${resource.url ?? ''}`.toLowerCase().includes(needle);
    });
  }, [resources, query, status]);

  const open = resources.find((resource) => resource.id === openId) ?? null;

  return (
    <ViewShell
      title="Resources"
      icon={Box}
      subtitle="Useful knowledge without an active commitment."
      actions={
        <PopoverEditor title="Add resource">
          <ResourceFields draft={draft} setDraft={setDraft} projects={projects} areas={areas} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add resource
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search resources…" label="Search resources" />
          <FilterChips
            label="Filter resources by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: resources.length },
              ...RESOURCE_STATUSES.map((value) => ({
                value,
                label: value,
                count: resources.filter((resource) => resource.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={Box}
          size="page"
          title={resources.length === 0 ? 'No resources yet' : 'No resources match'}
          description={
            resources.length === 0
              ? 'Capture notes, sources, ideas, and references here.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((resource) => (
            <RecordCard
              key={resource.id}
              title={resource.title}
              onOpen={() => setOpenId(resource.id)}
              badges={
                <>
                  <StatusBadge status={resource.status} overrides={RESOURCE_TONE} />
                  <Badge variant="secondary">{resource.type}</Badge>
                </>
              }
              detail={resource.url ? <LinkOut url={resource.url} /> : <p>No source URL.</p>}
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${open.type} · ${open.status}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={RESOURCE_TONE} />}
        renderEdit={(current, setCurrent) => (
          <ResourceFields draft={current} setDraft={setCurrent} projects={projects} areas={areas} />
        )}
        onSave={save}
        actions={
          open && (
            <Button size="sm" variant="outline" onClick={() => archive(open.id)}>
              <Box className="size-4" aria-hidden="true" />
              Archive
            </Button>
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact
              label="Source"
              value={open.url ? <LinkOut url={open.url} /> : undefined}
              placeholder="No source URL"
              wide
            />
            <Fact
              label="Project"
              value={projects.find((project) => project.id === open.projectIds[0])?.name}
              placeholder="Unattached"
            />
            <Fact
              label="Area"
              value={areas.find((area) => area.id === open.areaIds[0])?.name}
              placeholder="Unattached"
            />
            <Fact
              label="Linked note"
              value={open.noteId ? `Note #${open.noteId}` : undefined}
              placeholder="No linked note"
            />
            <Fact label="Captured content" value={open.content} wide placeholder="No inline content" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

type ArchiveKind = 'Project' | 'Area' | 'Resource' | 'Task' | 'Goal';
const ARCHIVE_KINDS: ArchiveKind[] = ['Project', 'Area', 'Resource', 'Task', 'Goal'];

export function ParaArchiveView() {
  const [data, persist] = useParaStore();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string>('all');

  const rows = useMemo(() => {
    const archived = (
      [
        ...data.projects.filter((row) => row.archivedAt).map((row) => ({ type: 'Project' as const, id: row.id, title: row.name, archivedAt: row.archivedAt! })),
        ...data.areas.filter((row) => row.archivedAt).map((row) => ({ type: 'Area' as const, id: row.id, title: row.name, archivedAt: row.archivedAt! })),
        ...data.resources.filter((row) => row.archivedAt).map((row) => ({ type: 'Resource' as const, id: row.id, title: row.title, archivedAt: row.archivedAt! })),
        ...data.tasks.filter((row) => row.archivedAt).map((row) => ({ type: 'Task' as const, id: row.id, title: row.title, archivedAt: row.archivedAt! })),
        ...data.goals.filter((row) => row.archivedAt).map((row) => ({ type: 'Goal' as const, id: row.id, title: row.title, archivedAt: row.archivedAt! })),
      ]
    );
    return archived.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }, [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== 'all' && row.type !== kind) return false;
      return !needle || row.title.toLowerCase().includes(needle);
    });
  }, [rows, query, kind]);

  const restore = (type: ArchiveKind, id: string) =>
    persist((current) => {
      const clear = <T extends { id: string; archivedAt?: string }>(items: T[]) =>
        items.map((item) => (item.id === id ? { ...item, archivedAt: undefined } : item));
      if (type === 'Project') return { ...current, projects: clear(current.projects) };
      if (type === 'Area') return { ...current, areas: clear(current.areas) };
      if (type === 'Resource') return { ...current, resources: clear(current.resources) };
      if (type === 'Task') return { ...current, tasks: clear(current.tasks) };
      return {
        ...current,
        goals: current.goals.map((goal) =>
          goal.id === id
            ? { ...goal, archivedAt: undefined, status: goal.status === 'Archived' ? 'Emerging' : goal.status }
            : goal,
        ),
      };
    });

  return (
    <ViewShell
      title="Archive"
      icon={ArchiveRestore}
      subtitle="A lifecycle view across every PARA entity. Nothing here is deleted — restore returns a record to its list."
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search the archive…" label="Search the archive" />
          <FilterChips
            label="Filter the archive by entity type"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'All', count: rows.length },
              ...ARCHIVE_KINDS.map((value) => ({
                value,
                label: value === 'Goal' ? 'Arc' : value,
                count: rows.filter((row) => row.type === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      <Panel title="Archived records" icon={ArchiveRestore} bodyClassName="p-0">
        {filtered.length === 0 ? (
          <EmptyPanel
            icon={ArchiveRestore}
            title={rows.length === 0 ? 'Archive is empty' : 'Nothing matches'}
            description={
              rows.length === 0
                ? 'Completed and inactive material will remain recoverable here.'
                : 'Try another search or entity filter.'
            }
          />
        ) : (
          <ListRows>
            {filtered.map((row) => (
              <ListRow
                key={`${row.type}-${row.id}`}
                title={row.title}
                detail={`Archived ${row.archivedAt.slice(0, 10)}`}
                meta={<Badge variant="secondary">{row.type === 'Goal' ? 'Arc' : row.type}</Badge>}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => restore(row.type, row.id)}>
                    <ArchiveRestore className="size-3.5" aria-hidden="true" />
                    Restore
                  </Button>
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>
    </ViewShell>
  );
}

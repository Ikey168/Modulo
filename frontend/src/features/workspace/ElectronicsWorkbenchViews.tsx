import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CircuitBoard, FlaskConical, Minus, PackagePlus, Plus, Wrench } from 'lucide-react';
import { Badge, Button, Input, Progress, Textarea, cn } from '@/ui';
import {
  CardGrid,
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  DashboardEmpty,
  DashboardGrid,
  HealthSummary,
  LinkOut,
  ListRow,
  ListRows,
  Metric,
  MetricRow,
  Panel,
  RecordCard,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
} from './viewkit';
import { PopoverEditor } from './EntryPopover';
import { DAY_BLOCKS } from './dayBlocks';
import {
  BOM_STATUSES,
  ELECTRONICS_PROJECT_STATUSES,
  ELECTRONICS_PROJECT_TYPES,
  LAB_ENTRY_TYPES,
  LAB_STATUSES,
  PART_CATEGORIES,
  blockedBom,
  lowStockParts,
  newElectronicsId,
  type BomItem,
  type ElectronicsPart,
  type ElectronicsProject,
  type LabEntry,
} from './electronicsWorkbench';
import { isoDay } from './para';
import type { WorkspaceViewProps } from './plugins/types';
import { useElectronicsStore } from './useElectronicsStore';

const PROJECT_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  idea: 'outline',
  specification: 'info',
  research: 'info',
  prototype: 'info',
  schematic: 'info',
  pcb: 'info',
  assembly: 'info',
  'bring-up': 'info',
  testing: 'info',
  enclosure: 'info',
  done: 'success',
  archived: 'outline',
};

const BOM_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  need: 'warning',
  ordered: 'info',
  'in stock': 'success',
  placed: 'success',
  substituted: 'outline',
};

/** Procurement moves in one direction; `Substituted` is a side branch, not a step. */
const BOM_FLOW = ['Need', 'Ordered', 'In stock', 'Placed'] as const;

const nextBomStatus = (status: BomItem['status']): BomItem['status'] | undefined => {
  const index = BOM_FLOW.indexOf(status as (typeof BOM_FLOW)[number]);
  return index >= 0 && index < BOM_FLOW.length - 1 ? BOM_FLOW[index + 1] : undefined;
};

const bomOrder = (status: BomItem['status']) => {
  const index = BOM_STATUSES.indexOf(status);
  return index < 0 ? BOM_STATUSES.length : index;
};

const blankProject = (): ElectronicsProject => ({
  id: newElectronicsId('project'),
  title: '',
  type: 'Circuit',
  status: 'Idea',
  revision: 'A',
  nextAction: '',
  definitionOfDone: '',
});

const blankPart = (): ElectronicsPart => ({
  id: newElectronicsId('part'),
  name: '',
  category: 'Other',
  quantity: 0,
  reorderAt: 0,
  location: '',
  notes: '',
});

const blankBom = (): BomItem => ({
  id: newElectronicsId('bom'),
  projectId: '',
  description: '',
  quantity: 1,
  status: 'Need',
});

const blankLab = (): LabEntry => ({
  id: newElectronicsId('lab'),
  projectId: '',
  type: 'Prototype',
  title: '',
  date: isoDay(),
  status: 'Planned',
  minutes: 90,
  expected: '',
  observed: '',
  notes: '',
});

/** Project fields shared by the create form and the edit sheet. */
function ProjectFields({ draft, setDraft }: { draft: ElectronicsProject; setDraft: (next: ElectronicsProject) => void }) {
  return (
    <>
      <FieldGroup legend="Build" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={ELECTRONICS_PROJECT_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as ElectronicsProject['type'] })}
        />
        <Choice
          label="Stage"
          value={draft.status}
          options={ELECTRONICS_PROJECT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as ElectronicsProject['status'] })}
        />
        <Field label="Revision">
          <Input value={draft.revision} onChange={(event) => setDraft({ ...draft, revision: event.target.value })} />
        </Field>
        <Field label="Target date">
          <Input
            type="date"
            value={draft.targetDate ?? ''}
            onChange={(event) => setDraft({ ...draft, targetDate: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Finish line" columns={1}>
        <Field label="Next action">
          <Input value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} />
        </Field>
        <Field label="Definition of done">
          <Textarea
            rows={2}
            value={draft.definitionOfDone}
            onChange={(event) => setDraft({ ...draft, definitionOfDone: event.target.value })}
          />
        </Field>
        <Field label="Repository" hint="Rendered as a link on the project.">
          <Input
            type="url"
            placeholder="https://"
            value={draft.repository ?? ''}
            onChange={(event) => setDraft({ ...draft, repository: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function ElectronicsProjectsView() {
  const [data, setData] = useElectronicsStore();
  const [draft, setDraft] = useState(blankProject);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.title.trim()) return;
    setData((current) => ({ ...current, projects: [...current.projects, { ...draft, title: draft.title.trim() }] }));
    setDraft(blankProject());
  };

  const removeProject = (id: string) =>
    setData((current) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== id),
      bom: current.bom.filter((line) => line.projectId !== id),
      lab: current.lab.filter((entry) => entry.projectId !== id),
    }));

  const blockedFor = (id: string) =>
    data.bom.filter((line) => line.projectId === id && ['Need', 'Ordered'].includes(line.status)).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.projects.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;
      return [item.title, item.type, item.revision, item.nextAction, item.definitionOfDone, item.repository]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [data.projects, query, status]);

  const open = data.projects.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Electronics Projects"
      icon={CircuitBoard}
      subtitle="Idea → specification → prototype → PCB → assembly → bring-up → test → enclosure → finished artifact."
      actions={
        <PopoverEditor title="Add project">
          <ProjectFields draft={draft} setDraft={setDraft} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add project
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects…" label="Search projects" />
          <FilterChips
            label="Filter projects by stage"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.projects.length },
              ...ELECTRONICS_PROJECT_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.projects.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={CircuitBoard}
          size="page"
          title={data.projects.length === 0 ? 'No electronics projects yet' : 'No project matches'}
          description={
            data.projects.length === 0
              ? 'Start a circuit, module or repair and give it a revision and a next bench action.'
              : 'Try another search or stage filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => {
            const blocked = blockedFor(item.id);
            return (
              <RecordCard
                key={item.id}
                title={item.title}
                onOpen={() => setOpenId(item.id)}
                badges={
                  <>
                    <Badge variant="secondary">{item.type}</Badge>
                    <StatusBadge status={item.status} overrides={PROJECT_TONE} />
                    <Badge variant="outline">rev {item.revision}</Badge>
                    {blocked > 0 && (
                      <Badge variant="warning">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {blocked} BOM line{blocked === 1 ? '' : 's'} blocking
                      </Badge>
                    )}
                  </>
                }
                detail={
                  <>
                    <p>Next: {item.nextAction || 'Define the next bench action.'}</p>
                    {item.targetDate && <p>Target {item.targetDate}</p>}
                    {item.repository ? <LinkOut url={item.repository} /> : null}
                  </>
                }
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="project"
                    onDelete={() => removeProject(item.id)}
                    consequence="Its BOM lines and every bench entry logged against it are deleted too."
                  />
                }
              />
            );
          })}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${open.type} · rev ${open.revision}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={PROJECT_TONE} />}
        renderEdit={(current, setCurrent) => <ProjectFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            projects: current.projects.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="project"
              onDelete={() => {
                removeProject(open.id);
                setOpenId(null);
              }}
              consequence="Its BOM lines and every bench entry logged against it are deleted too."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Next action" value={open.nextAction} wide emphasis placeholder="No next bench action" />
            <Fact label="Target date" value={open.targetDate} placeholder="No target date" />
            <Fact label="Revision" value={open.revision} />
            <Fact label="Repository" value={open.repository ? <LinkOut url={open.repository} /> : ''} placeholder="Not linked" wide />
            <Fact label="Definition of done" value={open.definitionOfDone} wide />
            <Fact label="Open BOM lines" value={blockedFor(open.id)} />
            <Fact label="Bench entries" value={data.lab.filter((entry) => entry.projectId === open.id).length} />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Component fields shared by the create form and the edit sheet. */
function PartFields({ draft, setDraft }: { draft: ElectronicsPart; setDraft: (next: ElectronicsPart) => void }) {
  return (
    <>
      <FieldGroup legend="Component" columns={2}>
        <Field label="Name" className="sm:col-span-2">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Choice
          label="Category"
          value={draft.category}
          options={PART_CATEGORIES}
          onChange={(category) => setDraft({ ...draft, category: category as ElectronicsPart['category'] })}
        />
        <Field label="MPN" hint="Manufacturer part number.">
          <Input
            value={draft.manufacturerPart ?? ''}
            onChange={(event) => setDraft({ ...draft, manufacturerPart: event.target.value || undefined })}
          />
        </Field>
        <Field label="Footprint">
          <Input
            value={draft.footprint ?? ''}
            onChange={(event) => setDraft({ ...draft, footprint: event.target.value || undefined })}
          />
        </Field>
        <Field label="Location">
          <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Stock" columns={2}>
        <Field label="Quantity in stock">
          <Input
            type="number"
            min={0}
            value={draft.quantity}
            onChange={(event) => setDraft({ ...draft, quantity: Math.max(0, Number(event.target.value)) })}
          />
        </Field>
        <Field label="Reorder at" hint="At or below this level the part counts as low stock.">
          <Input
            type="number"
            min={0}
            value={draft.reorderAt}
            onChange={(event) => setDraft({ ...draft, reorderAt: Math.max(0, Number(event.target.value)) })}
          />
        </Field>
        <Field label="Unit cost">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.unitCost ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, unitCost: event.target.value ? Number(event.target.value) : undefined })
            }
          />
        </Field>
        <Field label="Datasheet" hint="Rendered as a link on the component.">
          <Input
            type="url"
            placeholder="https://"
            value={draft.datasheet ?? ''}
            onChange={(event) => setDraft({ ...draft, datasheet: event.target.value || undefined })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

/** BOM fields shared by the create form and the edit sheet. */
function BomFields({
  draft,
  setDraft,
  projects,
  parts,
}: {
  draft: BomItem;
  setDraft: (next: BomItem) => void;
  projects: ElectronicsProject[];
  parts: ElectronicsPart[];
}) {
  return (
    <FieldGroup legend="BOM line" columns={2}>
      <Choice
        label="Project"
        value={draft.projectId}
        placeholder="Select project"
        options={projects.map((item) => ({ value: item.id, label: item.title || 'Untitled project' }))}
        onChange={(projectId) => setDraft({ ...draft, projectId })}
        className="sm:col-span-2"
      />
      <Choice
        label="Known component"
        value={draft.partId ?? ''}
        clearable
        clearLabel="Not from the library"
        placeholder="Not from the library"
        options={parts.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(partId) => {
          const selected = parts.find((item) => item.id === partId);
          setDraft({ ...draft, partId: partId || undefined, description: selected?.name ?? draft.description });
        }}
        className="sm:col-span-2"
      />
      <Field label="Description" className="sm:col-span-2">
        <Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </Field>
      <Field label="Quantity">
        <Input
          type="number"
          min={1}
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: Math.max(1, Number(event.target.value)) })}
        />
      </Field>
      <Choice
        label="Status"
        value={draft.status}
        options={BOM_STATUSES}
        onChange={(status) => setDraft({ ...draft, status: status as BomItem['status'] })}
      />
      <Field label="Vendor">
        <Input
          value={draft.vendor ?? ''}
          onChange={(event) => setDraft({ ...draft, vendor: event.target.value || undefined })}
        />
      </Field>
      <Field label="Order reference">
        <Input
          value={draft.orderReference ?? ''}
          onChange={(event) => setDraft({ ...draft, orderReference: event.target.value || undefined })}
        />
      </Field>
    </FieldGroup>
  );
}

export function ElectronicsPartsView() {
  const [data, setData] = useElectronicsStore();
  const [part, setPart] = useState(blankPart);
  const [bom, setBom] = useState(blankBom);
  const [partQuery, setPartQuery] = useState('');
  const [stock, setStock] = useState<'all' | 'low'>('all');
  const [bomQuery, setBomQuery] = useState('');
  const [bomStatus, setBomStatus] = useState<string>('all');
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const [openBomId, setOpenBomId] = useState<string | null>(null);

  const addPart = () => {
    if (!part.name.trim()) return;
    setData((current) => ({ ...current, parts: [...current.parts, { ...part, name: part.name.trim() }] }));
    setPart(blankPart());
  };

  const addBom = () => {
    if (!bom.projectId || !bom.description.trim()) return;
    setData((current) => ({ ...current, bom: [...current.bom, { ...bom, description: bom.description.trim() }] }));
    setBom(blankBom());
  };

  const adjustStock = (id: string, delta: number) =>
    setData((current) => ({
      ...current,
      parts: current.parts.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
      ),
    }));

  const removePart = (id: string) =>
    setData((current) => ({
      ...current,
      parts: current.parts.filter((item) => item.id !== id),
      bom: current.bom.map((line) => (line.partId === id ? { ...line, partId: undefined } : line)),
    }));

  const projectTitle = (id: string) => data.projects.find((item) => item.id === id)?.title ?? 'Missing project';

  const lowCount = data.parts.filter((item) => item.quantity <= item.reorderAt).length;

  const parts = useMemo(() => {
    const needle = partQuery.trim().toLowerCase();
    return [...data.parts]
      .filter((item) => {
        if (stock === 'low' && item.quantity > item.reorderAt) return false;
        if (!needle) return true;
        return [item.name, item.category, item.manufacturerPart, item.footprint, item.location, item.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.parts, partQuery, stock]);

  /** BOM lines were an unsorted flat list; group them by the build that needs them. */
  const bomGroups = useMemo(() => {
    const needle = bomQuery.trim().toLowerCase();
    const matching = data.bom.filter((item) => {
      if (bomStatus !== 'all' && item.status !== bomStatus) return false;
      if (!needle) return true;
      return [item.description, item.vendor, item.orderReference, projectTitle(item.projectId)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    const buckets = new Map<string, BomItem[]>();
    matching.forEach((item) => buckets.set(item.projectId, [...(buckets.get(item.projectId) ?? []), item]));
    return [...buckets.entries()]
      .map(([projectId, lines]) => ({
        projectId,
        title: projectTitle(projectId),
        lines: [...lines].sort(
          (a, b) => bomOrder(a.status) - bomOrder(b.status) || a.description.localeCompare(b.description),
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bom, data.projects, bomQuery, bomStatus]);

  const openPart = data.parts.find((item) => item.id === openPartId) ?? null;
  const openBom = data.bom.find((item) => item.id === openBomId) ?? null;

  return (
    <ViewShell
      title="Components & Procurement"
      icon={PackagePlus}
      subtitle="Parts, footprints, storage, datasheets, stock thresholds, BOM revisions, vendors, orders, and substitutions."
      actions={
        <>
          <PopoverEditor title="Add component">
            <PartFields draft={part} setDraft={setPart} />
            <Button onClick={addPart} disabled={!part.name.trim()}>
              <PackagePlus className="size-4" aria-hidden="true" />
              Add component
            </Button>
          </PopoverEditor>
          <PopoverEditor title="Add BOM line">
            <BomFields draft={bom} setDraft={setBom} projects={data.projects} parts={data.parts} />
            <Button onClick={addBom} disabled={!bom.projectId || !bom.description.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Add BOM line
            </Button>
          </PopoverEditor>
        </>
      }
      bodyClassName="space-y-4 p-4"
    >
      <Panel
        title="Component library"
        icon={PackagePlus}
        description="Stock levels, reorder thresholds, storage locations and datasheets."
        bodyClassName="p-0"
        actions={
          <SearchInput
            value={partQuery}
            onChange={setPartQuery}
            placeholder="Search components…"
            label="Search components"
            className="w-40 flex-none sm:max-w-none"
          />
        }
      >
        <div className="border-b border-border px-3 py-2">
          <FilterChips
            label="Filter components by stock level"
            value={stock}
            onChange={setStock}
            options={[
              { value: 'all', label: 'All', count: data.parts.length },
              { value: 'low', label: 'Low stock only', count: lowCount },
            ]}
          />
        </div>
        {parts.length === 0 ? (
          <EmptyPanel
            icon={PackagePlus}
            title={data.parts.length === 0 ? 'No components yet' : 'No component matches'}
            description={
              data.parts.length === 0
                ? 'Record components and bench equipment with a reorder threshold so low stock surfaces itself.'
                : 'Try another search, or clear the low-stock filter.'
            }
          />
        ) : (
          <ListRows>
            {parts.map((item) => {
              const low = item.quantity <= item.reorderAt;
              return (
                <ListRow
                  key={item.id}
                  title={item.name}
                  onOpen={() => setOpenPartId(item.id)}
                  detail={
                    <>
                      {[item.category, item.manufacturerPart, item.footprint, item.location].filter(Boolean).join(' · ')}
                      {item.datasheet ? (
                        <>
                          {' · '}
                          <LinkOut url={item.datasheet} label="Datasheet" />
                        </>
                      ) : null}
                    </>
                  }
                  meta={
                    low ? (
                      <Badge variant="warning">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        Low stock · {item.quantity} of {item.reorderAt}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{item.quantity} in stock</Badge>
                    )
                  }
                  actions={
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove one ${item.name} from stock`}
                        disabled={item.quantity === 0}
                        onClick={() => adjustStock(item.id, -1)}
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Add one ${item.name} to stock`}
                        onClick={() => adjustStock(item.id, 1)}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <ConfirmDelete
                        itemName={item.name}
                        itemLabel="component"
                        onDelete={() => removePart(item.id)}
                        consequence="BOM lines that referenced it keep their description but lose the library link."
                      />
                    </>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </Panel>

      <Panel
        title="Project BOM"
        icon={CircuitBoard}
        description="Grouped by build, ordered by procurement stage."
        bodyClassName="p-0"
        actions={
          <SearchInput
            value={bomQuery}
            onChange={setBomQuery}
            placeholder="Search BOM…"
            label="Search BOM lines"
            className="w-40 flex-none sm:max-w-none"
          />
        }
      >
        <div className="border-b border-border px-3 py-2">
          <FilterChips
            label="Filter BOM lines by status"
            value={bomStatus}
            onChange={setBomStatus}
            options={[
              { value: 'all', label: 'All', count: data.bom.length },
              ...BOM_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.bom.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </div>
        {bomGroups.length === 0 ? (
          <EmptyPanel
            icon={CircuitBoard}
            title={data.bom.length === 0 ? 'No BOM lines' : 'Nothing matches'}
            description={
              data.bom.length === 0
                ? 'Add the parts a build needs so procurement blockers become visible.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          bomGroups.map((group) => (
            <section key={group.projectId} className="border-b border-border last:border-b-0">
              <h4 className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {group.title} · {group.lines.length} line{group.lines.length === 1 ? '' : 's'}
              </h4>
              <ListRows>
                {group.lines.map((item) => {
                  const next = nextBomStatus(item.status);
                  return (
                    <ListRow
                      key={item.id}
                      title={`${item.quantity}× ${item.description}`}
                      onOpen={() => setOpenBomId(item.id)}
                      detail={
                        [item.vendor, item.orderReference].filter(Boolean).join(' · ') || 'No vendor or order reference'
                      }
                      meta={<StatusBadge status={item.status} overrides={BOM_TONE} />}
                      actions={
                        <>
                          {next && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setData((current) => ({
                                  ...current,
                                  bom: current.bom.map((line) =>
                                    line.id === item.id ? { ...line, status: next } : line,
                                  ),
                                }))
                              }
                            >
                              Mark {next.toLowerCase()}
                            </Button>
                          )}
                          <ConfirmDelete
                            itemName={item.description}
                            itemLabel="BOM line"
                            onDelete={() =>
                              setData((current) => ({
                                ...current,
                                bom: current.bom.filter((line) => line.id !== item.id),
                              }))
                            }
                          />
                        </>
                      }
                    />
                  );
                })}
              </ListRows>
            </section>
          ))
        )}
      </Panel>

      <RecordSheet
        record={openPart}
        onClose={() => setOpenPartId(null)}
        title={openPart?.name ?? ''}
        subtitle={openPart?.category}
        badges={
          openPart &&
          (openPart.quantity <= openPart.reorderAt ? (
            <Badge variant="warning">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Low stock
            </Badge>
          ) : (
            <Badge variant="outline">{openPart.quantity} in stock</Badge>
          ))
        }
        renderEdit={(current, setCurrent) => <PartFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            parts: current.parts.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openPart && (
            <ConfirmDelete
              itemName={openPart.name}
              itemLabel="component"
              onDelete={() => {
                removePart(openPart.id);
                setOpenPartId(null);
              }}
              consequence="BOM lines that referenced it keep their description but lose the library link."
            />
          )
        }
      >
        {openPart && (
          <FactGrid>
            <Fact label="In stock" value={openPart.quantity} emphasis />
            <Fact label="Reorder at" value={openPart.reorderAt} />
            <Fact label="MPN" value={openPart.manufacturerPart} />
            <Fact label="Footprint" value={openPart.footprint} />
            <Fact label="Location" value={openPart.location} />
            <Fact label="Unit cost" value={openPart.unitCost === undefined ? '' : openPart.unitCost} />
            <Fact
              label="Datasheet"
              value={openPart.datasheet ? <LinkOut url={openPart.datasheet} /> : ''}
              placeholder="Not linked"
              wide
            />
            <Fact label="Notes" value={openPart.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>

      <RecordSheet
        record={openBom}
        onClose={() => setOpenBomId(null)}
        title={openBom ? `${openBom.quantity}× ${openBom.description}` : ''}
        subtitle={openBom ? projectTitle(openBom.projectId) : undefined}
        badges={openBom && <StatusBadge status={openBom.status} overrides={BOM_TONE} />}
        renderEdit={(current, setCurrent) => (
          <BomFields draft={current} setDraft={setCurrent} projects={data.projects} parts={data.parts} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            bom: current.bom.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openBom && (
            <ConfirmDelete
              itemName={openBom.description}
              itemLabel="BOM line"
              onDelete={() => {
                setData((current) => ({ ...current, bom: current.bom.filter((item) => item.id !== openBom.id) }));
                setOpenBomId(null);
              }}
            />
          )
        }
      >
        {openBom && (
          <FactGrid>
            <Fact label="Quantity" value={openBom.quantity} />
            <Fact
              label="Library component"
              value={data.parts.find((item) => item.id === openBom.partId)?.name}
              placeholder="Not from the library"
            />
            <Fact label="Vendor" value={openBom.vendor} />
            <Fact label="Order reference" value={openBom.orderReference} />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/**
 * Expected vs observed as an actual comparison. The kit has no paired-value
 * control, so it is composed here: the observed side takes the entry's result
 * tone, which is the whole point of recording both.
 */
function Comparison({ expected, observed, status }: { expected: string; observed: string; status: LabEntry['status'] }) {
  if (!expected.trim() && !observed.trim()) return null;
  const tone =
    status === 'Failed'
      ? 'border-destructive/40 bg-destructive/5'
      : status === 'Passed'
        ? 'border-success/40 bg-success/5'
        : 'border-border bg-surface-2/40';
  return (
    <dl className="grid border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
      <div className="min-w-0 px-2.5 py-1.5">
        <dt className="text-xs font-medium text-muted-foreground">Expected</dt>
        <dd className="mt-0.5 break-words text-[13px] text-foreground">{expected.trim() || 'Not stated'}</dd>
      </div>
      <div className={cn('min-w-0 border-t px-2.5 py-1.5 sm:border-t-0', tone)}>
        <dt className="text-xs font-medium text-muted-foreground">
          Observed · {status.toLowerCase()}
        </dt>
        <dd className="mt-0.5 break-words text-[13px] text-foreground">{observed.trim() || 'Not measured yet'}</dd>
      </div>
    </dl>
  );
}

/** Bench-entry fields shared by the create form and the edit sheet. */
function LabFields({
  draft,
  setDraft,
  projects,
}: {
  draft: LabEntry;
  setDraft: (next: LabEntry) => void;
  projects: ElectronicsProject[];
}) {
  return (
    <>
      <FieldGroup legend="Bench entry" columns={2}>
        <Choice
          label="Project"
          value={draft.projectId}
          placeholder="Select project"
          options={projects.map((item) => ({ value: item.id, label: item.title || 'Untitled project' }))}
          onChange={(projectId) => setDraft({ ...draft, projectId })}
          className="sm:col-span-2"
        />
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Entry type"
          value={draft.type}
          options={LAB_ENTRY_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as LabEntry['type'] })}
        />
        <Choice
          label="Result"
          value={draft.status}
          options={LAB_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as LabEntry['status'] })}
        />
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </Field>
        <Field label="Minutes">
          <Input
            type="number"
            min={5}
            value={draft.minutes}
            onChange={(event) => setDraft({ ...draft, minutes: Number(event.target.value) })}
          />
        </Field>
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          placeholder="Unblocked"
          options={DAY_BLOCKS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as LabEntry['blockId'] })}
          className="sm:col-span-2"
        />
      </FieldGroup>
      <FieldGroup legend="Expected vs observed" columns={1}>
        <Field label="Expected" hint="What the circuit should do.">
          <Input value={draft.expected} onChange={(event) => setDraft({ ...draft, expected: event.target.value })} />
        </Field>
        <Field label="Observed" hint="What it actually did — the pair is what makes the entry useful.">
          <Input value={draft.observed} onChange={(event) => setDraft({ ...draft, observed: event.target.value })} />
        </Field>
        <Field label="Notes, measurements, links">
          <Textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function ElectronicsLabView() {
  const [data, setData] = useElectronicsStore();
  const [draft, setDraft] = useState(blankLab);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.projectId || !draft.title.trim()) return;
    setData((current) => ({ ...current, lab: [...current.lab, { ...draft, title: draft.title.trim() }] }));
    setDraft(blankLab());
  };

  const projectTitle = (id: string) => data.projects.find((item) => item.id === id)?.title ?? 'Missing project';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.lab]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [item.title, item.type, item.expected, item.observed, item.notes, projectTitle(item.projectId)]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lab, data.projects, query, status]);

  const open = data.lab.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Prototype, Build & Test Lab"
      icon={FlaskConical}
      subtitle="Circuit notes, prototypes, PCB revisions, assembly, measurements, firmware, enclosures, repairs, and reusable knowledge."
      actions={
        <PopoverEditor title="Add bench entry">
          <LabFields draft={draft} setDraft={setDraft} projects={data.projects} />
          <Button onClick={add} disabled={!draft.projectId || !draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add entry
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search bench entries…" label="Search bench entries" />
          <FilterChips
            label="Filter bench entries by result"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.lab.length },
              ...LAB_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.lab.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {data.projects.length === 0 ? (
        <EmptyPanel
          icon={CircuitBoard}
          size="page"
          title="Add a project first"
          description="Bench entries belong to a build, so create one before logging measurements."
        />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={FlaskConical}
          size="page"
          title={data.lab.length === 0 ? 'No bench entries' : 'Nothing matches'}
          description={
            data.lab.length === 0
              ? 'Log what you expected and what you observed so a failed test is diagnosable later.'
              : 'Try another search or result filter.'
          }
        />
      ) : (
        <CardGrid className="xl:grid-cols-2">
          {filtered.map((item) => (
            <RecordCard
              key={item.id}
              title={item.title}
              onOpen={() => setOpenId(item.id)}
              badges={
                <>
                  <Badge variant="secondary">{item.type}</Badge>
                  <StatusBadge status={item.status} />
                </>
              }
              detail={
                <p>
                  {projectTitle(item.projectId)} · {item.date} · {item.minutes}m
                </p>
              }
              footer={<Comparison expected={item.expected} observed={item.observed} status={item.status} />}
              actions={
                <ConfirmDelete
                  itemName={item.title}
                  itemLabel="bench entry"
                  onDelete={() =>
                    setData((current) => ({ ...current, lab: current.lab.filter((row) => row.id !== item.id) }))
                  }
                />
              }
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${projectTitle(open.projectId)} · ${open.type} · ${open.date}` : undefined}
        badges={open && <StatusBadge status={open.status} />}
        renderEdit={(current, setCurrent) => (
          <LabFields draft={current} setDraft={setCurrent} projects={data.projects} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            lab: current.lab.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="bench entry"
              onDelete={() => {
                setData((current) => ({ ...current, lab: current.lab.filter((item) => item.id !== open.id) }));
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <div className="grid gap-2">
            <Comparison expected={open.expected} observed={open.observed} status={open.status} />
            <FactGrid>
              <Fact label="Duration" value={`${open.minutes} minutes`} />
              <Fact
                label="Day block"
                value={DAY_BLOCKS.find((block) => block.id === open.blockId)?.label}
                placeholder="Unblocked"
              />
              <Fact label="Notes, measurements, links" value={open.notes} wide />
            </FactGrid>
          </div>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

export function ElectronicsDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useElectronicsStore();
  const active = data.projects.filter((item) => !['Done', 'Archived'].includes(item.status));
  const missingNext = active.filter((item) => !item.nextAction.trim());
  const blocked = blockedBom(data);
  const low = lowStockParts(data);
  const failed = data.lab.filter((item) => item.status === 'Failed');
  const passed = data.lab.filter((item) => item.status === 'Passed').length;

  const goTo = (view: string, label: string) => (
    <Button size="sm" variant="ghost" onClick={() => navigateView(view)}>
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );

  if (data.projects.length === 0 && data.parts.length === 0) {
    return (
      <ViewShell
        title="Electronics overview"
        icon={Wrench}
        subtitle="Active builds, blocked parts, low stock, failed tests, open revisions, and finished artifacts."
      >
        <DashboardEmpty
          icon={CircuitBoard}
          title="The bench is empty"
          description="Add a project or a component and this overview will track builds, stock and test results."
          action={
            <Button size="sm" onClick={() => navigateView('electronics-projects')}>
              Start a project
            </Button>
          }
        />
      </ViewShell>
    );
  }

  /** Only the stages that actually hold work: an all-zero ladder is noise. */
  const pipeline = ELECTRONICS_PROJECT_STATUSES.filter((status) => status !== 'Archived')
    .map((status) => ({ status, count: data.projects.filter((item) => item.status === status).length }))
    .filter((stage) => stage.count > 0);

  const recentLab = [...data.lab].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const projectTitle = (id?: string) => data.projects.find((item) => item.id === id)?.title;

  return (
    <ViewShell
      title="Electronics overview"
      icon={Wrench}
      subtitle="Active builds, blocked parts, low stock, failed tests, open revisions, and finished artifacts."
      actions={goTo('electronics-projects', 'Projects')}
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="xl:grid-cols-6">
        <Metric
          label="Active builds"
          value={active.length}
          detail={missingNext.length ? `${missingNext.length} without a next action` : 'all have a next action'}
          tone={missingNext.length ? 'warning' : 'default'}
          onOpen={() => navigateView('electronics-projects')}
        />
        <Metric
          label="Blocked BOM"
          value={blocked.length}
          tone={blocked.length ? 'warning' : 'success'}
          detail={blocked.length ? 'waiting on parts' : 'nothing blocked'}
          onOpen={() => navigateView('electronics-parts')}
        />
        <Metric
          label="Low stock"
          value={low.length}
          tone={low.length ? 'warning' : 'success'}
          detail={low.length ? low.map((item) => item.name).join(', ') : 'stock is healthy'}
          onOpen={() => navigateView('electronics-parts')}
        />
        <Metric
          label="Failed tests"
          value={failed.length}
          tone={failed.length ? 'danger' : 'success'}
          detail={failed.length ? 'need diagnosis' : 'none open'}
          onOpen={() => navigateView('electronics-lab')}
        />
        <Metric label="Passed tests" value={passed} detail="verified on the bench" />
        <Metric
          label="Finished"
          value={data.projects.filter((item) => item.status === 'Done').length}
          detail="shipped builds"
        />
      </MetricRow>

      <DashboardGrid>
        <Panel
          title="Build pipeline"
          icon={CircuitBoard}
          description={pipeline.length ? undefined : 'No projects in flight.'}
          actions={goTo('electronics-projects', 'Projects')}
          className="xl:col-span-2"
        >
          {pipeline.length === 0 ? (
            <EmptyPanel
              icon={CircuitBoard}
              title="Nothing in the pipeline"
              description="Projects appear here as they move from idea to done."
            />
          ) : (
            <ul className="space-y-2.5">
              {pipeline.map(({ status, count }) => (
                <li key={status}>
                  <div className="mb-1 flex items-baseline gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">{status}</span>
                    <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <Progress
                    value={data.projects.length ? (count / data.projects.length) * 100 : 0}
                    aria-label={`${status}: ${count} project${count === 1 ? '' : 's'}`}
                    className="h-1.5"
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bench health" icon={Wrench}>
          <HealthSummary
            allClear="Every build has a next action, nothing is blocked, and stock is healthy."
            checks={[
              {
                okay: missingNext.length === 0,
                message: `${missingNext.length} active project${missingNext.length === 1 ? '' : 's'} need a next action.`,
                action: goTo('electronics-projects', 'Open'),
              },
              {
                okay: blocked.length === 0,
                message: `${blocked.length} BOM line${blocked.length === 1 ? '' : 's'} still need parts.`,
                action: goTo('electronics-parts', 'Order'),
              },
              {
                okay: failed.length === 0,
                message: `${failed.length} failed test${failed.length === 1 ? '' : 's'} need diagnosis.`,
                action: goTo('electronics-lab', 'Lab'),
              },
              {
                okay: low.length === 0,
                message: `${low.length} component${low.length === 1 ? '' : 's'} at or below the reorder threshold.`,
                action: goTo('electronics-parts', 'Restock'),
              },
            ]}
          />
        </Panel>

        <Panel
          title="Recent bench work"
          icon={FlaskConical}
          actions={goTo('electronics-lab', 'Build & test')}
          bodyClassName="p-0"
          className="xl:col-span-3"
        >
          {recentLab.length === 0 ? (
            <EmptyPanel
              icon={FlaskConical}
              title="Nothing tested yet"
              description="Log a bring-up or a test and the result shows up here."
            />
          ) : (
            <ListRows>
              {recentLab.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={entry.title}
                  detail={[projectTitle(entry.projectId), entry.observed || entry.expected].filter(Boolean).join(' · ')}
                  meta={
                    <>
                      <span className="font-mono">{entry.date}</span>
                      <StatusBadge status={entry.status} overrides={{ passed: 'success', failed: 'destructive' }} />
                    </>
                  }
                  onOpen={() => navigateView('electronics-lab')}
                />
              ))}
            </ListRows>
          )}
        </Panel>
      </DashboardGrid>
    </ViewShell>
  );
}

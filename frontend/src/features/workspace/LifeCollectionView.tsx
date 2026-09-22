import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  FolderKanban,
  History,
  LayoutGrid,
  Plus,
  Repeat2,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Progress,
  ScrollArea,
  Textarea,
  cn,
} from '@/ui';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import type { LifeField, LifePluginConfig } from './lifeConfigs';
import {
  LIFE_RECURRENCES,
  SECURITY_SECRET_REJECTED_EVENT,
  lifeStoreKey,
  newLifeId,
  type LifeRecord,
} from './lifeStore';
import { isoDate } from './planner';
import { useLifeCollection, useLifeCollections } from './useLifeCollection';
import { useParaStore } from './useParaStore';
import { EntryPopover } from './EntryPopover';
import {
  Choice,
  ChoiceInline,
  ConfirmDelete,
  EmptyPanel,
  Field,
  FieldGroup,
  SearchInput,
  StatusBadge,
} from './viewkit';
import { useEducationStore } from './useEducationStore';
import { useMediaLibraryStore } from './usePluginDataStores';
import { useRemoveLifeOsRelations } from './useLifeOsRelations';
import { CrossPluginLinks } from './CrossPluginLinks';

export function LifeCollectionView({ config }: { config: LifePluginConfig }) {

  const removeRelations = useRemoveLifeOsRelations();  const [data, persist] = useLifeCollection(config.id);
  const [para] = useParaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newRecord, setNewRecord] = useState<LifeRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [secretRejected, setSecretRejected] = useState(false);

  useEffect(() => {
    if (!config.securityMetadataOnly) return;
    const rejected = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === config.id)
        setSecretRejected(true);
    };
    window.addEventListener(SECURITY_SECRET_REJECTED_EVENT, rejected);
    return () =>
      window.removeEventListener(SECURITY_SECRET_REJECTED_EVENT, rejected);
  }, [config.id, config.securityMetadataOnly]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return data.records.filter(
      (record) =>
        (statusFilter === 'All' || record.status === statusFilter) &&
        (!needle ||
          record.title.toLocaleLowerCase().includes(needle) ||
          record.category.toLocaleLowerCase().includes(needle) ||
          record.tags.some((tag) => tag.toLocaleLowerCase().includes(needle)) ||
          Object.values(record.values).some((value) =>
            value.toLocaleLowerCase().includes(needle),
          )),
    );
  }, [data.records, query, statusFilter]);

  const selected =
    data.records.find((record) => record.id === selectedId) ?? newRecord;
  const patch = (id: string, update: Partial<LifeRecord>) => {
    const saved = persist((current) => ({
      ...current,
      records: current.records.some((record) => record.id === id)
        ? current.records.map((record) =>
            record.id === id ? { ...record, ...update } : record,
          )
        : newRecord?.id === id
          ? [{ ...newRecord, ...update }, ...current.records]
          : current.records,
    }));
    if (saved) setNewRecord(null);
    return saved;
  };
  const open = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setSecretRejected(false);
  };
  const close = () => {
    setSelectedId(null);
    setNewRecord(null);
    setEditing(false);
    setSecretRejected(false);
  };
  const create = () => {
    const record: LifeRecord = {
      id: newLifeId('record'),
      title: `Untitled ${config.singular}`,
      status: config.statuses[0],
      category: config.categories[0],
      date: config.schedule ? isoDate(new Date()) : undefined,
      recurrence: 'Once',
      blockId: config.schedule ? 'ops-people' : undefined,
      favorite: false,
      tags: [],
      values: {},
      checklist: [],
      log: [],
    };
    setNewRecord(record);
    setSelectedId(record.id);
    setEditing(true);
  };
  const remove = (id: string) => {
    if (newRecord?.id === id) {
      close();
      return;
    }
    if (
      !persist((current) => ({
        ...current,
        records: current.records.filter((record) => record.id !== id),
        occurrenceCompletions: current.occurrenceCompletions.filter(
          (item) => item.recordId !== id,
        ),
      }))
    )
      return;
    removeRelations(`${lifeStoreKey(config.id)}:records:${id}`);
    close();
  };

  return (
    <>
      <LifeCollectionOverview
        config={config}
        records={visible}
        allRecords={data.records}
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        open={open}
        create={create}
      />
      <EntryPopover
        open={Boolean(selected)}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        title={selected?.title ?? config.title}
        description={`View or edit ${config.singular}`}
      >
        {selected && (
          <LifeRecordPage
            isNew={newRecord?.id === selected.id}
            key={selected.id}
            config={config}
            record={selected}
            para={para}
            editing={editing}
            setEditing={setEditing}
            patch={patch}
            remove={remove}
            close={close}
            secretRejected={secretRejected}
          />
        )}
      </EntryPopover>
    </>
  );
}

function LifeCollectionOverview({
  config,
  records,
  allRecords,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  open,
  create,
}: {
  config: LifePluginConfig;
  records: LifeRecord[];
  allRecords: LifeRecord[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  open: (id: string) => void;
  create: () => void;
}) {
  const Icon = config.icon;
  const today = isoDate(new Date());
  const completed = allRecords.filter((record) =>
    config.completedStatuses.includes(record.status),
  ).length;
  const attention = allRecords.filter((record) =>
    needsAttention(record, today, config),
  ).length;
  const upcoming = allRecords
    .filter(
      (record) =>
        record.date &&
        record.date >= today &&
        !config.completedStatuses.includes(record.status),
    )
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 3);
  const favorites = allRecords.filter((record) => record.favorite).length;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {config.title}
          </h2>
          <span className="sr-only">{config.description}</span>
          <Button size="sm" onClick={create}>
            <Plus />
            Add {config.singular}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            label={`Search ${config.title.toLocaleLowerCase()}`}
          />
          <ChoiceInline
            label="Filter by status"
            value={statusFilter === 'All' ? '' : statusFilter}
            onChange={(value) => setStatusFilter(value || 'All')}
            options={config.statuses}
            clearable
            clearLabel="All statuses"
            className="min-w-48"
          />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-7xl space-y-5 p-5">
          <section className="flex flex-wrap border-y border-border py-2">
            <SummaryTile
              label="Total"
              value={allRecords.length}
              icon={<LayoutGrid />}
            />
            <SummaryTile
              label="Needs attention"
              value={attention}
              icon={<AlertTriangle />}
              warning={attention > 0}
            />
            <SummaryTile
              label="Completed"
              value={completed}
              icon={<CheckCircle2 />}
            />
            <SummaryTile label="Favorites" value={favorites} icon={<Star />} />
          </section>
          {config.securityMetadataOnly && (
            <div className="flex gap-2 rounded-lg border border-warning/35 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span>
                <strong>Metadata only.</strong> Keep credentials and recovery
                secrets in your dedicated secret manager. Secret-looking values
                are rejected here.
              </span>
            </div>
          )}
          {upcoming.length > 0 && statusFilter === 'All' && !query && (
            <section>
              <SectionHeading title="Coming up" />
              <div className="divide-y divide-border border-y border-border">
                {upcoming.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => open(record.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/20"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                      {month(record.date)} {day(record.date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {record.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {record.category} · {record.status}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionHeading
              title={
                query || statusFilter !== 'All'
                  ? 'Filtered records'
                  : 'Everything'
              }
              subtitle={`${records.length} ${records.length === 1 ? 'record' : 'records'}`}
            />
            {records.length === 0 ? (
              <div className="border-y border-dashed border-border">
                <EmptyPanel
                  icon={Icon}
                  title={
                    allRecords.length
                      ? 'Nothing matches'
                      : `No ${config.title.toLocaleLowerCase()} yet`
                  }
                  description={
                    allRecords.length
                      ? 'Try another search or status.'
                      : `Add your first ${config.singular} to begin.`
                  }
                  onReset={
                    allRecords.length
                      ? () => {
                          setQuery('');
                          setStatusFilter('All');
                        }
                      : undefined
                  }
                  action={
                    !allRecords.length ? (
                      <Button size="sm" onClick={create}>
                        <Plus />
                        Add {config.singular}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="border-y border-border">
                {records.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    config={config}
                    open={open}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function RecordCard({
  record,
  config,
  open,
}: {
  record: LifeRecord;
  config: LifePluginConfig;
  open: (id: string) => void;
}) {
  const Icon = config.icon;
  const progress = record.checklist.length
    ? (record.checklist.filter((item) => item.done).length /
        record.checklist.length) *
      100
    : null;
  const facts = config.fields
    .map((field) => ({ label: field.label, value: record.values[field.key] }))
    .filter((fact) => fact.value)
    .slice(0, 2);
  return (
    <button
      type="button"
      onClick={() => open(record.id)}
      className="group flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-medium">{record.title}</h3>
          {record.favorite && (
            <Star className="size-3 fill-warning text-warning" />
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {record.category}
        </p>
      </div>
      <div className="hidden min-w-0 items-center gap-4 lg:flex">
        {record.date && (
          <TinyFact
            icon={<CalendarClock />}
            label={config.dateLabel ?? 'Date'}
            value={friendlyDate(record.date)}
          />
        )}{' '}
        {record.amount != null && (
          <TinyFact
            icon={<CircleDollarSign />}
            label={config.amountLabel ?? 'Amount'}
            value={record.amount.toLocaleString()}
          />
        )}{' '}
        {facts.map((fact) => (
          <TinyFact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>
      <StatusPill value={record.status} config={config} />
      <div className="w-20 shrink-0">
        {progress != null ? (
          <Progress value={progress} className="h-1" />
        ) : (
          <span className="block truncate text-right text-xxs text-muted-foreground">
            {record.tags
              .slice(0, 2)
              .map((tag) => `#${tag}`)
              .join(' ')}
          </span>
        )}
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LifeRecordPage({
  isNew,
  config,
  record,
  para,
  editing,
  setEditing,
  patch,
  remove,
  close,
  secretRejected,
}: {
  isNew: boolean;
  config: LifePluginConfig;
  record: LifeRecord;
  para: ReturnType<typeof useParaStore>[0];
  editing: boolean;
  setEditing: (value: boolean) => void;
  patch: (id: string, update: Partial<LifeRecord>) => boolean;
  remove: (id: string) => void;
  close: () => void;
  secretRejected: boolean;
}) {
  const Icon = config.icon;
  const [draft, setDraft] = useState(record);
  const [saveError, setSaveError] = useState('');
  const patchDraft = (_id: string, update: Partial<LifeRecord>) => {
    setDraft((current) => ({ ...current, ...update }));
    return true;
  };
  const save = () => {
    if (!draft.title.trim()) {
      setSaveError('Enter a title before saving.');
      return;
    }
    if (!patch(record.id, { ...draft, title: draft.title.trim() })) {
      setSaveError(
        config.securityMetadataOnly
          ? 'Couldn’t save. Remove any secret material, or check device storage, then try again.'
          : 'Couldn’t save changes. Your draft is still here; try saving again.',
      );
      return;
    }
    setSaveError('');
    setEditing(false);
  };
  const project = para.projects.find((item) => item.id === record.projectId);
  const area = para.areas.find((item) => item.id === record.areaId);
  const populatedFields = config.fields.filter(
    (field) => record.values[field.key],
  );

  return (
    <div
      className="flex h-[min(88vh,780px)] min-w-0 flex-col overflow-hidden"
      onKeyDown={(event) => {
        if (
          editing &&
          !event.nativeEvent.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          event.key === 'Enter'
        ) {
          event.preventDefault();
          save();
        }
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={close}
          aria-label={`Back to ${config.title}`}
        >
          <ArrowLeft />
        </Button>
        <span className="text-xs text-muted-foreground">{config.title}</span>
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className="min-w-0 truncate text-xs font-medium">
          {record.title}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => editing
              ? patchDraft(record.id, { favorite: !draft.favorite })
              : patch(record.id, { favorite: !record.favorite })}
            aria-label={(editing ? draft : record).favorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Star
              className={cn((editing ? draft : record).favorite && 'fill-warning text-warning')}
            />
          </Button>
          {editing ? (
            <>
              <Button size="sm" onClick={save}>
                <Check />
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (isNew) close();
                  else {
                    setDraft(record);
                    setSaveError('');
                    setEditing(false);
                  }
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(record);
                setEditing(true);
              }}
            >
              <Edit3 />
              Edit
            </Button>
          )}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto max-w-5xl space-y-5 p-5 sm:p-7">
          {config.securityMetadataOnly && (
            <div className="flex gap-2 rounded-lg border border-warning/35 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <div>
                <strong>Metadata only.</strong> This record must contain
                references, never passwords, passphrases, seed phrases,
                mnemonics, or private keys.
                {secretRejected && (
                  <p className="mt-1 font-medium text-destructive">
                    The last edit was rejected because it looked like secret
                    material.
                  </p>
                )}
              </div>
            </div>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          {editing ? (
            <LifeRecordEditor
              config={config}
              record={draft}
              para={para}
              patch={patchDraft}
              remove={remove}
            />
          ) : (
            <>
              <section className="flex items-start gap-3 border-b border-border pb-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{record.title}</h2>
                    <StatusPill value={record.status} config={config} />
                    <Badge
                      variant="outline"
                      className="rounded-sm bg-transparent"
                    >
                      {record.category}
                    </Badge>
                  </div>
                  {record.notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {record.notes}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(record);
                        setEditing(true);
                      }}
                      className="mt-2 text-xs text-muted-foreground hover:text-primary"
                    >
                      Add notes or context…
                    </button>
                  )}
                </div>
              </section>
              <section>
                <SectionHeading title="At a glance" />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {config.schedule && (
                    <FactCard
                      icon={<CalendarClock />}
                      label={config.dateLabel ?? 'Date'}
                      value={
                        record.date
                          ? friendlyDate(record.date)
                          : 'Not scheduled'
                      }
                    />
                  )}{' '}
                  {config.schedule && (
                    <FactCard
                      icon={<Repeat2 />}
                      label="Schedule"
                      value={
                        record.recurrence === 'Once'
                          ? (DAY_BLOCKS.find(
                              (block) => block.id === record.blockId,
                            )?.label ?? 'One time')
                          : `${record.recurrence} · ${DAY_BLOCKS.find((block) => block.id === record.blockId)?.label ?? 'No block'}`
                      }
                    />
                  )}{' '}
                  {config.amountLabel && (
                    <FactCard
                      icon={<CircleDollarSign />}
                      label={config.amountLabel}
                      value={
                        record.amount != null
                          ? record.amount.toLocaleString()
                          : 'Not set'
                      }
                    />
                  )}{' '}
                  {config.ratingLabel && (
                    <FactCard
                      icon={<Star />}
                      label={config.ratingLabel}
                      value={
                        record.rating
                          ? `${'★'.repeat(record.rating)}${'☆'.repeat(5 - record.rating)}`
                          : 'Not rated'
                      }
                    />
                  )}{' '}
                  {(project || area) && (
                    <FactCard
                      icon={<FolderKanban />}
                      label="PARA"
                      value={[project?.name, area?.name]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  )}{' '}
                  {record.tags.length > 0 && (
                    <FactCard
                      icon={<Tag />}
                      label="Tags"
                      value={record.tags.map((tag) => `#${tag}`).join(' ')}
                    />
                  )}
                </div>
              </section>
              {populatedFields.length > 0 && (
                <section>
                  <SectionHeading title="Details" />
                  <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
                    {populatedFields.map((field) => (
                      <ReadField
                        key={field.key}
                        field={field}
                        value={record.values[field.key]}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {config.checklistLabel && (
            <ChecklistSection
              label={config.checklistLabel}
              record={editing ? draft : record}
              patch={editing ? patchDraft : patch}
            />
          )}{' '}
          {config.logLabel && (
            <LogSection
              label={config.logLabel}
              record={editing ? draft : record}
              patch={editing ? patchDraft : patch}
            />
          )}
          <CrossPluginLinks
            uid={`${lifeStoreKey(config.id)}:records:${record.id}`}
          />
        </main>
      </ScrollArea>
    </div>
  );
}

function LifeRecordEditor({
  config,
  record,
  para,
  patch,
  remove,
}: {
  config: LifePluginConfig;
  record: LifeRecord;
  para: ReturnType<typeof useParaStore>[0];
  patch: (id: string, update: Partial<LifeRecord>) => boolean;
  remove: (id: string) => void;
}) {
  return (
    <section>
      <div className="space-y-4 px-0 py-4 sm:px-5">
        <FieldGroup legend="Identity">
          <Field label="Title">
            <Input
              value={record.title}
              onChange={(event) =>
                patch(record.id, { title: event.target.value })
              }
              className="h-9 font-medium"
            />
          </Field>
          <Choice
            label="Status"
            value={record.status}
            onChange={(value) => patch(record.id, { status: value })}
            options={config.statuses}
          />
          <Choice
            label="Category"
            value={record.category}
            onChange={(value) => patch(record.id, { category: value })}
            options={config.categories}
          />
          <Field label="Notes">
            <Textarea
              value={record.notes ?? ''}
              onChange={(event) =>
                patch(record.id, { notes: event.target.value || undefined })
              }
              rows={3}
              placeholder="Context that helps you use this record"
            />
          </Field>
        </FieldGroup>
        {config.schedule && (
          <FieldGroup legend="Schedule">
            <Field label={config.dateLabel ?? 'Date'}>
              <Input
                type="date"
                value={record.date ?? ''}
                onChange={(event) =>
                  patch(record.id, { date: event.target.value || undefined })
                }
                className="h-9"
              />
            </Field>
            <Field label={config.endDateLabel ?? 'End date'}>
              <Input
                type="date"
                value={record.endDate ?? ''}
                onChange={(event) =>
                  patch(record.id, { endDate: event.target.value || undefined })
                }
                className="h-9"
              />
            </Field>
            <Choice
              label="Repeats"
              value={record.recurrence}
              onChange={(value) =>
                patch(record.id, {
                  recurrence: value as LifeRecord['recurrence'],
                })
              }
              options={LIFE_RECURRENCES}
            />
            <Choice
              label="Planner block"
              value={record.blockId}
              onChange={(value) =>
                patch(record.id, {
                  blockId: (value as DayBlockId) || undefined,
                })
              }
              options={DAY_BLOCKS.map((block) => ({
                value: block.id,
                label: block.label,
              }))}
              clearable
              clearLabel="No block"
            />
          </FieldGroup>
        )}
        <FieldGroup legend="Details">
          {config.amountLabel && (
            <Field label={config.amountLabel}>
              <Input
                type="number"
                min={0}
                step="any"
                value={record.amount ?? ''}
                onChange={(event) =>
                  patch(record.id, {
                    amount:
                      event.target.value === ''
                        ? undefined
                        : Math.max(0, Number(event.target.value) || 0),
                  })
                }
                className="h-9"
              />
            </Field>
          )}
          {config.ratingLabel && (
            <Choice
              label={config.ratingLabel}
              value={record.rating ? String(record.rating) : undefined}
              onChange={(value) =>
                patch(record.id, { rating: value ? Number(value) : undefined })
              }
              options={[1, 2, 3, 4, 5].map((rating) => ({
                value: String(rating),
                label: `${rating} / 5`,
              }))}
              clearable
              clearLabel="Unrated"
            />
          )}
          {config.fields.map((field) => (
            <DynamicField
              key={field.key}
              field={field}
              value={record.values[field.key] ?? ''}
              onChange={(value) =>
                patch(record.id, {
                  values: { ...record.values, [field.key]: value },
                })
              }
            />
          ))}
        </FieldGroup>
        <FieldGroup legend="Connections">
          <Choice
            label="PARA Project"
            value={record.projectId}
            onChange={(value) =>
              patch(record.id, { projectId: value || undefined })
            }
            options={para.projects
              .filter((project) => !project.archivedAt)
              .map((project) => ({ value: project.id, label: project.name }))}
            clearable
            clearLabel="No project"
          />
          <Choice
            label="PARA Area"
            value={record.areaId}
            onChange={(value) =>
              patch(record.id, { areaId: value || undefined })
            }
            options={para.areas
              .filter((area) => !area.archivedAt)
              .map((area) => ({ value: area.id, label: area.name }))}
            clearable
            clearLabel="No area"
          />
          <Field label="Tags">
            <Input
              value={record.tags.join(', ')}
              onChange={(event) =>
                patch(record.id, {
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              className="h-9"
              placeholder="Comma-separated"
            />
          </Field>
        </FieldGroup>
      </div>
      <div className="flex items-center border-t border-border px-5 py-2">
        <span className="text-xs text-muted-foreground">
          Save changes to apply your edits
        </span>
        <div className="ml-auto">
          <ConfirmDelete
            itemName={record.title}
            itemLabel={config.singular}
            consequence="Its checklist, history, scheduled completions, and cross-plugin links will also be removed."
            onDelete={() => remove(record.id)}
          />
        </div>
      </div>
    </section>
  );
}

function ChecklistSection({
  label,
  record,
  patch,
}: {
  label: string;
  record: LifeRecord;
  patch: (id: string, update: Partial<LifeRecord>) => boolean;
}) {
  const [draft, setDraft] = useState('');
  const done = record.checklist.filter((item) => item.done).length;
  const add = () => {
    if (!draft.trim()) return;
    if (
      patch(record.id, {
        checklist: [
          ...record.checklist,
          { id: newLifeId('check'), title: draft.trim(), done: false },
        ],
      })
    )
      setDraft('');
  };
  return (
    <section className="overflow-hidden rounded-sm border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <CheckSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {done} of {record.checklist.length}
        </span>
      </header>
      {record.checklist.length > 0 && (
        <Progress
          value={(done / record.checklist.length) * 100}
          className="h-1 rounded-none"
        />
      )}
      <ul className="divide-y divide-border">
        {record.checklist.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 px-4 py-3">
            <Checkbox
              aria-label={`Complete ${item.title}`}
              checked={item.done}
              onCheckedChange={(checked) =>
                patch(record.id, {
                  checklist: record.checklist.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, done: checked === true }
                      : entry,
                  ),
                })
              }
            />
            <span
              className={cn(
                'min-w-0 flex-1 text-sm',
                item.done && 'text-muted-foreground line-through',
              )}
            >
              {item.title}
            </span>
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              className="opacity-0 text-muted-foreground transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              onClick={() =>
                patch(record.id, {
                  checklist: record.checklist.filter(
                    (entry) => entry.id !== item.id,
                  ),
                })
              }
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-border bg-muted/10 p-3">
        <Input
          aria-label={`Add to ${label.toLocaleLowerCase()}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) =>
            event.key === 'Enter' && !event.nativeEvent.isComposing && add()
          }
          placeholder={`Add to ${label.toLocaleLowerCase()}`}
          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus />
          Add
        </Button>
      </div>
    </section>
  );
}

function LogSection({
  label,
  record,
  patch,
}: {
  label: string;
  record: LifeRecord;
  patch: (id: string, update: Partial<LifeRecord>) => boolean;
}) {
  const [draft, setDraft] = useState('');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const add = () => {
    if (!draft.trim()) return;
    if (
      patch(record.id, {
        log: [
          { id: newLifeId('log'), date, title: draft.trim() },
          ...record.log,
        ],
      })
    )
      setDraft('');
  };
  return (
    <section className="overflow-hidden rounded-sm border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="outline" className="ml-auto rounded-sm bg-transparent">
          {record.log.length}
        </Badge>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border bg-muted/10 p-3">
        <Input
          aria-label="History date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-8 w-36 bg-background"
        />
        <Input
          aria-label={`Add to ${label.toLocaleLowerCase()}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) =>
            event.key === 'Enter' && !event.nativeEvent.isComposing && add()
          }
          placeholder={`Record something in ${label.toLocaleLowerCase()}`}
          className="h-8 min-w-48 flex-1 bg-background"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus />
          Add
        </Button>
      </div>
      {record.log.length === 0 ? (
        <p className="p-6 text-xs text-muted-foreground">
          History will appear here.
        </p>
      ) : (
        <ol className="relative divide-y divide-border">
          {record.log.map((entry) => (
            <li key={entry.id} className="group flex gap-3 px-4 py-3">
              <div className="mt-1 size-2 shrink-0 rounded-sm bg-primary/60" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{entry.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {friendlyDate(entry.date)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${entry.title}`}
                className="opacity-0 text-muted-foreground transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                onClick={() =>
                  patch(record.id, {
                    log: record.log.filter((item) => item.id !== entry.id),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: LifeField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [media] = useMediaLibraryStore();
  const [education] = useEducationStore();
  const linkedLife = useLifeCollections(field.sourcePluginId ? [field.sourcePluginId] : []);
  if (field.type === 'textarea')
    return (
      <Field label={field.label} className="md:col-span-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={field.placeholder}
        />
      </Field>
    );
  if (field.type === 'select')
    return (
      <Choice
        label={field.label}
        value={value || undefined}
        onChange={onChange}
        options={field.options ?? []}
        clearable
        clearLabel="Choose…"
      />
    );
  if (field.type === 'media')
    return (
      <Choice
        label={field.label}
        value={value || undefined}
        onChange={onChange}
        options={media.items.map((item) => ({
          value: item.id,
          label: `${item.title} · ${item.type}`,
        }))}
        clearable
        clearLabel="No media item"
        placeholder="Choose from Media Library"
      />
    );
  if (field.type === 'education')
    return (
      <Choice
        label={field.label}
        value={value || undefined}
        onChange={onChange}
        options={education.nodes.map((item) => ({
          value: item.id,
          label: `${item.title} · ${item.type}`,
        }))}
        clearable
        clearLabel="No course or program"
        placeholder="Choose from Learning Core"
      />
    );
  if (field.type === 'life')
    return (
      <Choice
        label={field.label}
        value={value || undefined}
        onChange={onChange}
        options={
          field.sourcePluginId
            ? (linkedLife[field.sourcePluginId]?.records ?? []).map((item) => ({
                value: item.id,
                label: `${item.title} · ${item.status}`,
              }))
            : []
        }
        clearable
        clearLabel="No linked record"
        placeholder="Choose a record"
      />
    );
  return (
    <Field label={field.label}>
      <Input
        type={field.type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
        placeholder={field.placeholder}
      />
    </Field>
  );
}

function ReadField({ field, value }: { field: LifeField; value: string }) {
  const [media] = useMediaLibraryStore();
  const [education] = useEducationStore();
  const linkedLife = useLifeCollections(field.sourcePluginId ? [field.sourcePluginId] : []);
  const isUrl = field.type === 'url' && /^https?:\/\//i.test(value);
  const linked =
    field.type === 'media'
      ? media.items.find((item) => item.id === value)?.title
      : field.type === 'education'
        ? education.nodes.find((item) => item.id === value)?.title
        : field.type === 'life' && field.sourcePluginId
          ? (linkedLife[field.sourcePluginId]?.records ?? []).find(
              (item) => item.id === value,
            )?.title
          : undefined;
  return (
    <div className="min-h-20 bg-surface p-4">
      <p className="text-xs text-muted-foreground">{field.label}</p>
      {isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 block truncate text-sm text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
          {linked ?? (field.type === 'date' ? friendlyDate(value) : value)}
        </p>
      )}
    </div>
  );
}
function SummaryTile({
  label,
  value,
  icon,
  warning,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-40 flex-1 border-l-2 px-3 py-2',
        warning ? 'border-warning' : 'border-border-strong',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('[&>svg]:size-3.5', warning && 'text-warning')}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function FactCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-border px-1 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </div>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
function TinyFact({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xxs text-muted-foreground">
        <span className="[&>svg]:size-3">{icon}</span>
        {label}
      </p>
      <p className="mt-0.5 max-w-32 truncate text-xs">{value}</p>
    </div>
  );
}
/**
 * Colour comes from the collection's own `completedStatuses`, not from sniffing
 * the status text. The previous regex matched substrings, so `/valid/` rendered
 * "Invalid" as complete.
 */
function StatusPill({
  value,
  config,
}: {
  value: string;
  config: LifePluginConfig;
}) {
  return (
    <StatusBadge status={value} completedStatuses={config.completedStatuses} />
  );
}
function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
function friendlyDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}
function month(value?: string) {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(parsed);
}
function day(value?: string) {
  return value ? String(Number(value.slice(8, 10))) : '';
}
function needsAttention(
  record: LifeRecord,
  today: string,
  config: LifePluginConfig,
) {
  return (
    !config.completedStatuses.includes(record.status) &&
    (/due|risk|fail|blocked|expired|overdue|waiting|repair/i.test(
      record.status,
    ) ||
      Boolean(record.date && record.date < today))
  );
}

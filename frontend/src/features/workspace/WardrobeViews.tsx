import { useMemo, useState } from 'react';
import { Plus, Shirt, Sparkles, Star } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Textarea } from '@/ui';
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
  HealthSummary,
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
  ViewColumns,
  ViewShell,
} from './viewkit';
import type { WorkspaceViewProps } from './plugins/types';
import { PopoverEditor } from './EntryPopover';
import { DAY_BLOCKS } from './dayBlocks';
import {
  GARMENT_CATEGORIES,
  GARMENT_STATUSES,
  STYLE_LOG_TYPES,
  newWardrobeId,
  type Garment,
  type Outfit,
  type StyleLog,
} from './wardrobe';
import { isoDay } from './para';
import { useWardrobeStore } from './useWardrobeStore';

const split = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const listOrEmpty = (values: string[]) => (values.length ? values.join(', ') : '');

const garment = (): Garment => ({
  id: newWardrobeId('garment'),
  name: '',
  category: 'Other',
  status: 'Active',
  brand: '',
  size: '',
  color: '',
  seasons: [],
  storage: '',
  notes: '',
});

const outfit = (): Outfit => ({
  id: newWardrobeId('outfit'),
  title: '',
  garmentIds: [],
  silhouette: '',
  archetype: '',
  occasion: '',
  season: '',
  notes: '',
});

const log = (): StyleLog => ({
  id: newWardrobeId('log'),
  type: 'Experiment',
  title: '',
  date: isoDay(),
  done: false,
  notes: '',
});

/** `Archived` is a wardrobe end-state, not a success — and care states are warnings. */
const GARMENT_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  active: 'success',
  seasonal: 'info',
  repair: 'warning',
  alteration: 'warning',
  sell: 'warning',
  donate: 'warning',
  archived: 'outline',
};

const RATINGS = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `${value} / 5`,
}));

const ratingOf = (value: string) => (value ? Number(value) : undefined);

/** Garment fields shared by the create form and the edit sheet. */
function GarmentFields({ draft, setDraft }: { draft: Garment; setDraft: (next: Garment) => void }) {
  return (
    <>
      <FieldGroup legend="Garment" columns={2}>
        <Field label="Name" className="sm:col-span-2">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Choice
          label="Category"
          value={draft.category}
          options={GARMENT_CATEGORIES}
          onChange={(category) => setDraft({ ...draft, category: category as Garment['category'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={GARMENT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as Garment['status'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Details" columns={2}>
        <Field label="Brand">
          <Input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} />
        </Field>
        <Field label="Size">
          <Input value={draft.size} onChange={(event) => setDraft({ ...draft, size: event.target.value })} />
        </Field>
        <Field label="Colour">
          <Input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
        </Field>
        <Field label="Storage" hint="Where the piece physically lives.">
          <Input value={draft.storage} onChange={(event) => setDraft({ ...draft, storage: event.target.value })} />
        </Field>
        <Field label="Seasons" hint="Comma separated." className="sm:col-span-2">
          <Input
            value={draft.seasons.join(', ')}
            onChange={(event) => setDraft({ ...draft, seasons: split(event.target.value) })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
      <FieldGroup legend="External references" columns={2}>
        <Field label="Inventory record key" hint="Optional key from the household inventory pack. Leave blank unless you are linking one.">
          <Input
            value={draft.inventoryId ?? ''}
            onChange={(event) => setDraft({ ...draft, inventoryId: event.target.value || undefined })}
          />
        </Field>
        <Field label="Wishlist record key" hint="Optional key from the wishlist pack. Leave blank unless you are linking one.">
          <Input
            value={draft.wishlistId ?? ''}
            onChange={(event) => setDraft({ ...draft, wishlistId: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function WardrobeClosetView() {
  const [data, setData] = useWardrobeStore();
  const [draft, setDraft] = useState(garment);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.name.trim()) return;
    setData((current) => ({ ...current, garments: [...current.garments, { ...draft, name: draft.name.trim() }] }));
    setDraft(garment());
  };

  const removeGarment = (id: string) =>
    setData((current) => ({
      ...current,
      garments: current.garments.filter((item) => item.id !== id),
      outfits: current.outfits.map((item) => ({
        ...item,
        garmentIds: item.garmentIds.filter((garmentId) => garmentId !== id),
      })),
    }));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.garments]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [item.name, item.brand, item.size, item.color, item.storage, item.category, ...item.seasons]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.garments, query, status]);

  const open = data.garments.find((item) => item.id === openId) ?? null;
  const looksWith = (id: string) => data.outfits.filter((item) => item.garmentIds.includes(id)).length;

  return (
    <ViewShell
      title="Wardrobe"
      icon={Shirt}
      subtitle="Garments, seasons, fit, storage, repairs, alterations, decluttering, inventory, and wishlist references."
      actions={
        <PopoverEditor title="Add garment">
          <GarmentFields draft={draft} setDraft={setDraft} />
          <Button onClick={add} disabled={!draft.name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add garment
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search garments…" label="Search garments" />
          <FilterChips
            label="Filter garments by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.garments.length },
              ...GARMENT_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.garments.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={Shirt}
          size="page"
          title={data.garments.length === 0 ? 'No garments yet' : 'No garments match'}
          description={
            data.garments.length === 0
              ? 'Add a piece to track its category, fit, storage and care state.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => {
            const looks = looksWith(item.id);
            return (
              <RecordCard
                key={item.id}
                title={item.name}
                onOpen={() => setOpenId(item.id)}
                badges={
                  <>
                    <Badge variant="secondary">{item.category}</Badge>
                    <StatusBadge status={item.status} overrides={GARMENT_TONE} />
                  </>
                }
                detail={
                  <>
                    <p>{[item.brand, item.size, item.color].filter(Boolean).join(' · ') || 'No fit details'}</p>
                    <p>
                      {item.storage || 'No storage recorded'}
                      {item.seasons.length ? ` · ${item.seasons.join(', ')}` : ''}
                    </p>
                  </>
                }
                footer={looks === 0 ? 'Not in any saved look' : `In ${looks} saved look${looks === 1 ? '' : 's'}`}
                actions={
                  <ConfirmDelete
                    itemName={item.name}
                    itemLabel="garment"
                    onDelete={() => removeGarment(item.id)}
                    consequence="It is also removed from every saved look that uses it."
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
        title={open?.name ?? ''}
        subtitle={open?.category}
        badges={open && <StatusBadge status={open.status} overrides={GARMENT_TONE} />}
        renderEdit={(current, setCurrent) => <GarmentFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            garments: current.garments.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.name}
              itemLabel="garment"
              onDelete={() => {
                removeGarment(open.id);
                setOpenId(null);
              }}
              consequence="It is also removed from every saved look that uses it."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Brand" value={open.brand} />
            <Fact label="Size" value={open.size} />
            <Fact label="Colour" value={open.color} />
            <Fact label="Storage" value={open.storage} />
            <Fact label="Seasons" value={listOrEmpty(open.seasons)} placeholder="All year" />
            <Fact label="Saved looks" value={looksWith(open.id)} />
            <Fact label="Inventory record key" value={open.inventoryId} placeholder="Not linked" />
            <Fact label="Wishlist record key" value={open.wishlistId} placeholder="Not linked" />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/**
 * Searchable garment multi-select. The kit has no multi-select control, so this
 * is composed locally — the previous version was an unsearchable `max-h-28`
 * scroll well that became unusable past a dozen garments.
 */
function GarmentPicker({
  garments,
  selected,
  onToggle,
}: {
  garments: Garment[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = garments.filter(
    (item) => !needle || `${item.name} ${item.brand} ${item.category} ${item.color}`.toLowerCase().includes(needle),
  );
  return (
    <FieldGroup legend={`Garments — ${selected.length} selected`} columns={1}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Filter garments…"
        label="Filter garments"
        className="sm:max-w-none"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {garments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Add garments to the wardrobe first.</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No garment matches “{query.trim()}”.</p>
        ) : (
          shown.map((item) => (
            <label key={item.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-surface-2">
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => onToggle(item.id)}
                aria-label={item.name}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-xxs text-muted-foreground">{item.category}</span>
            </label>
          ))
        )}
      </div>
    </FieldGroup>
  );
}

/** Outfit fields shared by the create form and the edit sheet. */
function OutfitFields({
  draft,
  setDraft,
  garments,
}: {
  draft: Outfit;
  setDraft: (next: Outfit) => void;
  garments: Garment[];
}) {
  return (
    <>
      <FieldGroup legend="Look" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="Silhouette">
          <Input value={draft.silhouette} onChange={(event) => setDraft({ ...draft, silhouette: event.target.value })} />
        </Field>
        <Field label="Archetype">
          <Input value={draft.archetype} onChange={(event) => setDraft({ ...draft, archetype: event.target.value })} />
        </Field>
        <Field label="Occasion">
          <Input value={draft.occasion} onChange={(event) => setDraft({ ...draft, occasion: event.target.value })} />
        </Field>
        <Field label="Season">
          <Input value={draft.season} onChange={(event) => setDraft({ ...draft, season: event.target.value })} />
        </Field>
        <Choice
          label="Rating"
          value={draft.rating ? String(draft.rating) : ''}
          options={RATINGS}
          clearable
          clearLabel="Not rated"
          placeholder="Not rated"
          onChange={(value) => setDraft({ ...draft, rating: ratingOf(value) })}
        />
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
      <GarmentPicker
        garments={garments}
        selected={draft.garmentIds}
        onToggle={(id) =>
          setDraft({
            ...draft,
            garmentIds: draft.garmentIds.includes(id)
              ? draft.garmentIds.filter((value) => value !== id)
              : [...draft.garmentIds, id],
          })
        }
      />
    </>
  );
}

/** Style-log fields shared by the create form and the edit sheet. */
function StyleLogFields({
  draft,
  setDraft,
  outfits,
}: {
  draft: StyleLog;
  setDraft: (next: StyleLog) => void;
  outfits: Outfit[];
}) {
  return (
    <>
      <FieldGroup legend="Entry" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={STYLE_LOG_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as StyleLog['type'] })}
        />
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </Field>
        <Choice
          label="Outfit"
          value={draft.outfitId ?? ''}
          clearable
          clearLabel="General style work"
          placeholder="General style work"
          options={outfits.map((item) => ({ value: item.id, label: item.title || 'Untitled look' }))}
          onChange={(outfitId) => setDraft({ ...draft, outfitId: outfitId || undefined })}
        />
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          placeholder="Unblocked"
          options={DAY_BLOCKS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as StyleLog['blockId'] })}
        />
        <Choice
          label="Rating"
          value={draft.rating ? String(draft.rating) : ''}
          options={RATINGS}
          clearable
          clearLabel="Not rated"
          placeholder="Not rated"
          onChange={(value) => setDraft({ ...draft, rating: ratingOf(value) })}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-subtle-foreground">
          <Checkbox
            checked={draft.done}
            onCheckedChange={(checked) => setDraft({ ...draft, done: checked === true })}
            aria-label="Completed"
          />
          Completed
        </label>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function StyleStudioView() {
  const [data, setData] = useWardrobeStore();
  const [outfitDraft, setOutfitDraft] = useState(outfit);
  const [logDraft, setLogDraft] = useState(log);
  const [outfitQuery, setOutfitQuery] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [logType, setLogType] = useState<string>('all');
  const [openOutfitId, setOpenOutfitId] = useState<string | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  const addOutfit = () => {
    if (!outfitDraft.title.trim()) return;
    setData((current) => ({ ...current, outfits: [...current.outfits, { ...outfitDraft, title: outfitDraft.title.trim() }] }));
    setOutfitDraft(outfit());
  };

  const addLog = () => {
    if (!logDraft.title.trim()) return;
    setData((current) => ({ ...current, logs: [...current.logs, { ...logDraft, title: logDraft.title.trim() }] }));
    setLogDraft(log());
  };

  const removeOutfit = (id: string) =>
    setData((current) => ({
      ...current,
      outfits: current.outfits.filter((item) => item.id !== id),
      logs: current.logs.map((item) => (item.outfitId === id ? { ...item, outfitId: undefined } : item)),
    }));

  const garmentName = (id: string) => data.garments.find((item) => item.id === id)?.name ?? 'Removed garment';
  const outfitTitle = (id?: string) =>
    id ? data.outfits.find((item) => item.id === id)?.title ?? 'Removed look' : 'General style work';

  const outfits = useMemo(() => {
    const needle = outfitQuery.trim().toLowerCase();
    return data.outfits.filter((item) => {
      if (!needle) return true;
      return [item.title, item.silhouette, item.archetype, item.occasion, item.season, ...item.garmentIds.map(garmentName)]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.outfits, data.garments, outfitQuery]);

  const logs = useMemo(() => {
    const needle = logQuery.trim().toLowerCase();
    return [...data.logs]
      .filter((item) => {
        if (logType !== 'all' && item.type !== logType) return false;
        if (!needle) return true;
        return [item.title, item.type, item.notes, outfitTitle(item.outfitId)].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.logs, data.outfits, logQuery, logType]);

  const openOutfit = data.outfits.find((item) => item.id === openOutfitId) ?? null;
  const openLog = data.logs.find((item) => item.id === openLogId) ?? null;

  return (
    <ViewShell
      title="Style Studio"
      icon={Sparkles}
      subtitle="Outfits, capsules, silhouettes, archetypes, occasions, wears, experiments, repairs, and seasonal reviews."
      actions={
        <>
          <PopoverEditor title="Save a look">
            <OutfitFields draft={outfitDraft} setDraft={setOutfitDraft} garments={data.garments} />
            <Button onClick={addOutfit} disabled={!outfitDraft.title.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Save look
            </Button>
          </PopoverEditor>
          <PopoverEditor title="Log style work">
            <StyleLogFields draft={logDraft} setDraft={setLogDraft} outfits={data.outfits} />
            <Button onClick={addLog} disabled={!logDraft.title.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Add log
            </Button>
          </PopoverEditor>
        </>
      }
    >
      <ViewColumns
        rail={
          <Panel
            title="Style log"
            description="Wears, experiments, repairs and capsule reviews."
            bodyClassName="p-0"
            actions={
              <SearchInput
                value={logQuery}
                onChange={setLogQuery}
                placeholder="Search log…"
                label="Search style log"
                className="w-36 flex-none sm:max-w-none"
              />
            }
          >
            <div className="border-b border-border px-3 py-2">
              <FilterChips
                label="Filter style log by type"
                value={logType}
                onChange={setLogType}
                options={[
                  { value: 'all', label: 'All', count: data.logs.length },
                  ...STYLE_LOG_TYPES.map((value) => ({
                    value,
                    label: value,
                    count: data.logs.filter((item) => item.type === value).length,
                  })),
                ]}
              />
            </div>
            {logs.length === 0 ? (
              <EmptyPanel
                icon={Star}
                title={data.logs.length === 0 ? 'Nothing logged' : 'Nothing matches'}
                description={
                  data.logs.length === 0
                    ? 'Log a wear, an experiment or a repair to build the style record.'
                    : 'Try another search or type filter.'
                }
              />
            ) : (
              <ListRows>
                {logs.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.title}
                    muted={item.done}
                    onOpen={() => setOpenLogId(item.id)}
                    leading={
                      <Checkbox
                        checked={item.done}
                        aria-label={item.done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`}
                        onCheckedChange={(checked) =>
                          setData((current) => ({
                            ...current,
                            logs: current.logs.map((row) => (row.id === item.id ? { ...row, done: checked === true } : row)),
                          }))
                        }
                      />
                    }
                    detail={
                      <>
                        {item.type} · {item.date}
                        {item.rating ? ` · rated ${item.rating}/5` : ''}
                      </>
                    }
                    actions={
                      <ConfirmDelete
                        itemName={item.title}
                        itemLabel="log entry"
                        onDelete={() =>
                          setData((current) => ({ ...current, logs: current.logs.filter((row) => row.id !== item.id) }))
                        }
                      />
                    }
                  />
                ))}
              </ListRows>
            )}
          </Panel>
        }
      >
        <Panel
          title="Outfits & capsules"
          description="Saved looks and the garments they are built from."
          actions={
            <SearchInput
              value={outfitQuery}
              onChange={setOutfitQuery}
              placeholder="Search looks…"
              label="Search saved looks"
              className="w-40 flex-none sm:max-w-none"
            />
          }
        >
          {outfits.length === 0 ? (
            <EmptyPanel
              icon={Sparkles}
              title={data.outfits.length === 0 ? 'No saved looks' : 'No look matches'}
              description={
                data.outfits.length === 0
                  ? 'Combine garments into a look to reuse silhouettes and archetypes.'
                  : 'Try another search.'
              }
            />
          ) : (
            <CardGrid className="xl:grid-cols-2">
              {outfits.map((item) => (
                <RecordCard
                  key={item.id}
                  title={item.title}
                  onOpen={() => setOpenOutfitId(item.id)}
                  badges={
                    <>
                      {item.archetype && <Badge variant="secondary">{item.archetype}</Badge>}
                      {item.rating && <Badge variant="outline">{item.rating} / 5</Badge>}
                    </>
                  }
                  detail={
                    <p>{[item.silhouette, item.occasion, item.season].filter(Boolean).join(' · ') || 'No styling details'}</p>
                  }
                  footer={
                    item.garmentIds.length === 0
                      ? 'No garments attached'
                      : item.garmentIds.map(garmentName).join(' · ')
                  }
                  actions={
                    <ConfirmDelete
                      itemName={item.title}
                      itemLabel="look"
                      onDelete={() => removeOutfit(item.id)}
                      consequence="Style-log entries that referenced it become general style work; the garments themselves are kept."
                    />
                  }
                />
              ))}
            </CardGrid>
          )}
        </Panel>
      </ViewColumns>

      <RecordSheet
        record={openOutfit}
        onClose={() => setOpenOutfitId(null)}
        title={openOutfit?.title ?? ''}
        subtitle={openOutfit?.archetype || undefined}
        badges={openOutfit?.rating ? <Badge variant="outline">{openOutfit.rating} / 5</Badge> : null}
        renderEdit={(current, setCurrent) => (
          <OutfitFields draft={current} setDraft={setCurrent} garments={data.garments} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            outfits: current.outfits.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openOutfit && (
            <ConfirmDelete
              itemName={openOutfit.title}
              itemLabel="look"
              onDelete={() => {
                removeOutfit(openOutfit.id);
                setOpenOutfitId(null);
              }}
              consequence="Style-log entries that referenced it become general style work; the garments themselves are kept."
            />
          )
        }
      >
        {openOutfit && (
          <FactGrid>
            <Fact label="Silhouette" value={openOutfit.silhouette} />
            <Fact label="Occasion" value={openOutfit.occasion} />
            <Fact label="Season" value={openOutfit.season} />
            <Fact label="Rating" value={openOutfit.rating ? `${openOutfit.rating} / 5` : ''} placeholder="Not rated" />
            <Fact
              label="Garments"
              value={openOutfit.garmentIds.map(garmentName).join(', ')}
              placeholder="No garments attached"
              wide
              emphasis
            />
            <Fact label="Notes" value={openOutfit.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>

      <RecordSheet
        record={openLog}
        onClose={() => setOpenLogId(null)}
        title={openLog?.title ?? ''}
        subtitle={openLog ? `${openLog.type} · ${openLog.date}` : undefined}
        badges={openLog && <StatusBadge status={openLog.done ? 'Done' : 'Planned'} />}
        renderEdit={(current, setCurrent) => (
          <StyleLogFields draft={current} setDraft={setCurrent} outfits={data.outfits} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            logs: current.logs.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openLog && (
            <ConfirmDelete
              itemName={openLog.title}
              itemLabel="log entry"
              onDelete={() => {
                setData((current) => ({ ...current, logs: current.logs.filter((item) => item.id !== openLog.id) }));
                setOpenLogId(null);
              }}
            />
          )
        }
      >
        {openLog && (
          <FactGrid>
            <Fact label="Outfit" value={outfitTitle(openLog.outfitId)} />
            <Fact
              label="Day block"
              value={DAY_BLOCKS.find((block) => block.id === openLog.blockId)?.label}
              placeholder="Unblocked"
            />
            <Fact label="Rating" value={openLog.rating ? `${openLog.rating} / 5` : ''} placeholder="Not rated" />
            <Fact label="Done" value={openLog.done ? 'Yes' : 'No'} />
            <Fact label="Notes" value={openLog.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

export function WardrobeDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useWardrobeStore();
  const active = data.garments.filter((item) => item.status === 'Active');
  const care = data.garments.filter((item) => ['Repair', 'Alteration'].includes(item.status));
  const unused = active.filter((item) => !data.outfits.some((look) => look.garmentIds.includes(item.id)));
  const experiments = data.logs.filter((item) => item.type === 'Experiment' && item.done).length;
  const reviewed = data.logs.some((item) => item.type === 'Capsule Review');

  if (data.garments.length === 0 && data.outfits.length === 0 && data.logs.length === 0) {
    return (
      <ViewShell title="Style overview" icon={Shirt} subtitle="Garment care, saved looks, seasonal coverage, and capsule reviews.">
        <DashboardEmpty
          icon={Shirt}
          title="Nothing in the wardrobe yet"
          description="Add garments and the looks you build from them, and this overview will track care, use and review."
          action={
            <Button size="sm" onClick={() => navigateView('wardrobe-closet')}>
              Add a garment
            </Button>
          }
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Style overview"
      icon={Sparkles}
      subtitle="Capsule coverage, garment care, outfit reuse, silhouette experiments, and wardrobe gaps."
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="lg:grid-cols-5">
        <Metric label="Active garments" value={active.length} />
        <Metric label="Saved looks" value={data.outfits.length} />
        <Metric label="Care queue" value={care.length} tone={care.length ? 'warning' : 'default'} />
        <Metric label="Outside saved looks" value={unused.length} tone={unused.length ? 'warning' : 'default'} />
        <Metric label="Experiments completed" value={experiments} />
      </MetricRow>

      <Panel title="Wardrobe health" icon={Shirt}>
        <HealthSummary
          allClear="No care waiting, every active garment is in a look, and a capsule review exists."
          checks={[
            {
              okay: care.length === 0,
              message: `${care.length} garment${care.length === 1 ? ' needs' : 's need'} repair or alteration.`,
            },
            {
              okay: unused.length === 0,
              message: `${unused.length} active garment${unused.length === 1 ? ' is' : 's are'} not used in a saved look.`,
            },
            { okay: reviewed, message: 'Schedule a capsule review for the current season.' },
          ]}
        />
      </Panel>
    </ViewShell>
  );
}

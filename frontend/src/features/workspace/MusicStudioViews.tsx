import { useMemo, useState } from 'react';
import { Disc3, Gauge, Music2, PackagePlus, Plus } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Progress, Textarea } from '@/ui';
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
import type { WorkspaceViewProps } from './plugins/types';
import { PopoverEditor } from './EntryPopover';
import { DAY_BLOCKS } from './dayBlocks';
import {
  MUSIC_ASSET_TYPES,
  MUSIC_PRACTICE_STATUSES,
  MUSIC_PROJECT_STATUSES,
  MUSIC_PROJECT_TYPES,
  completedMusicMinutes,
  newMusicId,
  unfinishedMusicProjects,
  type MusicAsset,
  type MusicPractice,
  type MusicProject,
} from './musicStudio';
import { isoDay } from './para';
import { weekOf } from './planner';
import { useMusicStore } from './useMusicStore';

const split = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** The default vocabulary reads `Archived` as a success; here it is an end-state. */
const PROJECT_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  idea: 'outline',
  sketch: 'outline',
  arrangement: 'info',
  recording: 'info',
  mixing: 'info',
  mastering: 'info',
  ready: 'warning',
  released: 'success',
  archived: 'outline',
};

const PRACTICE_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  planned: 'info',
  done: 'success',
  skipped: 'outline',
};

const blankProject = (): MusicProject => ({
  id: newMusicId('project'),
  title: '',
  type: 'Track',
  status: 'Idea',
  nextAction: '',
  definitionOfDone: '',
  releaseNotes: '',
  collaborators: [],
});

const blankPractice = (): MusicPractice => ({
  id: newMusicId('practice'),
  date: isoDay(),
  instrument: '',
  focus: '',
  piece: '',
  minutes: 30,
  status: 'Planned',
  notes: '',
});

const blankAsset = (): MusicAsset => ({ id: newMusicId('asset'), type: 'Sample', title: '', tags: [], notes: '' });

/** Project fields shared by the create form and the edit sheet. */
function ProjectFields({ draft, setDraft }: { draft: MusicProject; setDraft: (next: MusicProject) => void }) {
  return (
    <>
      <FieldGroup legend="Project" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={MUSIC_PROJECT_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as MusicProject['type'] })}
        />
        <Choice
          label="Stage"
          value={draft.status}
          options={MUSIC_PROJECT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as MusicProject['status'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Musical detail" columns={2}>
        <Field label="BPM">
          <Input
            type="number"
            min={20}
            value={draft.bpm ?? ''}
            onChange={(event) => setDraft({ ...draft, bpm: event.target.value ? Number(event.target.value) : undefined })}
          />
        </Field>
        <Field label="Key">
          <Input
            value={draft.musicalKey ?? ''}
            onChange={(event) => setDraft({ ...draft, musicalKey: event.target.value || undefined })}
          />
        </Field>
        <Field label="Target date" hint="Shown on the project card and detail.">
          <Input
            type="date"
            value={draft.targetDate ?? ''}
            onChange={(event) => setDraft({ ...draft, targetDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Collaborators" hint="Comma separated.">
          <Input
            value={draft.collaborators.join(', ')}
            onChange={(event) => setDraft({ ...draft, collaborators: split(event.target.value) })}
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
        <Field label="Release notes">
          <Textarea
            rows={2}
            value={draft.releaseNotes}
            onChange={(event) => setDraft({ ...draft, releaseNotes: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function MusicProjectsView() {
  const [data, setData] = useMusicStore();
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
      assets: current.assets.map((asset) => (asset.projectId === id ? { ...asset, projectId: undefined } : asset)),
    }));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.projects.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;
      return [item.title, item.type, item.nextAction, item.definitionOfDone, item.musicalKey, ...item.collaborators]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [data.projects, query, status]);

  const open = data.projects.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Track Lab"
      icon={Disc3}
      subtitle="Move music from sketch to released artifact, with an explicit next action and finish line."
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
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects…" label="Search music projects" />
          <FilterChips
            label="Filter projects by stage"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.projects.length },
              ...MUSIC_PROJECT_STATUSES.map((value) => ({
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
          icon={Disc3}
          size="page"
          title={data.projects.length === 0 ? 'No music projects yet' : 'No project matches'}
          description={
            data.projects.length === 0
              ? 'Start a track, EP or set and give it an explicit next action.'
              : 'Try another search or stage filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => {
            const assets = data.assets.filter((asset) => asset.projectId === item.id).length;
            return (
              <RecordCard
                key={item.id}
                title={item.title}
                onOpen={() => setOpenId(item.id)}
                badges={
                  <>
                    <Badge variant="secondary">{item.type}</Badge>
                    <StatusBadge status={item.status} overrides={PROJECT_TONE} />
                  </>
                }
                detail={
                  <>
                    <p>Next: {item.nextAction || 'Choose the next concrete production step.'}</p>
                    <p>
                      {[
                        item.bpm ? `${item.bpm} BPM` : '',
                        item.musicalKey,
                        item.targetDate ? `target ${item.targetDate}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No tempo, key or target date'}
                    </p>
                  </>
                }
                footer={assets === 0 ? 'No linked assets' : `${assets} linked asset${assets === 1 ? '' : 's'}`}
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="project"
                    onDelete={() => removeProject(item.id)}
                    consequence="Assets linked to it become shared assets; the assets themselves are kept."
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
        subtitle={open?.type}
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
              consequence="Assets linked to it become shared assets; the assets themselves are kept."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Next action" value={open.nextAction} wide emphasis placeholder="No next action — the project is stalled" />
            <Fact label="Target date" value={open.targetDate} placeholder="No target date" />
            <Fact label="Tempo" value={open.bpm ? `${open.bpm} BPM` : ''} />
            <Fact label="Key" value={open.musicalKey} />
            <Fact label="Collaborators" value={open.collaborators.join(', ')} placeholder="Solo" />
            <Fact label="Definition of done" value={open.definitionOfDone} wide />
            <Fact label="Release notes" value={open.releaseNotes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Practice fields shared by the create form and the edit sheet. */
function PracticeFields({ draft, setDraft }: { draft: MusicPractice; setDraft: (next: MusicPractice) => void }) {
  return (
    <>
      <FieldGroup legend="Session" columns={2}>
        <Field label="Instrument">
          <Input value={draft.instrument} onChange={(event) => setDraft({ ...draft, instrument: event.target.value })} />
        </Field>
        <Field label="Focus">
          <Input value={draft.focus} onChange={(event) => setDraft({ ...draft, focus: event.target.value })} />
        </Field>
        <Field label="Piece / exercise" className="sm:col-span-2">
          <Input value={draft.piece} onChange={(event) => setDraft({ ...draft, piece: event.target.value })} />
        </Field>
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
        <Field label="BPM">
          <Input
            type="number"
            min={20}
            value={draft.bpm ?? ''}
            onChange={(event) => setDraft({ ...draft, bpm: event.target.value ? Number(event.target.value) : undefined })}
          />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={MUSIC_PRACTICE_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as MusicPractice['status'] })}
        />
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          placeholder="Unblocked"
          options={DAY_BLOCKS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as MusicPractice['blockId'] })}
          className="sm:col-span-2"
        />
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function MusicPracticeView() {
  const [data, setData] = useMusicStore();
  const [draft, setDraft] = useState(blankPractice);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.instrument.trim() || !draft.focus.trim()) return;
    setData((current) => ({ ...current, practice: [...current.practice, draft] }));
    setDraft(blankPractice());
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.practice]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [item.instrument, item.focus, item.piece, item.notes].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.practice, query, status]);

  const open = data.practice.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Instrument Practice"
      icon={Music2}
      subtitle="Guitar, piano, theory, ear training, repertoire, rehearsals, and tempo progression in shared day blocks."
      actions={
        <PopoverEditor title="Plan or log practice">
          <PracticeFields draft={draft} setDraft={setDraft} />
          <Button onClick={add} disabled={!draft.instrument.trim() || !draft.focus.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add session
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search practice…" label="Search practice sessions" />
          <FilterChips
            label="Filter practice by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.practice.length },
              ...MUSIC_PRACTICE_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.practice.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      <Panel title="Practice log" icon={Music2} bodyClassName="p-0">
        {filtered.length === 0 ? (
          <EmptyPanel
            icon={Music2}
            title={data.practice.length === 0 ? 'No practice sessions yet' : 'Nothing matches'}
            description={
              data.practice.length === 0
                ? 'Plan a session or log one you have played to build the practice record.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows>
            {filtered.map((item) => (
              <ListRow
                key={item.id}
                title={`${item.instrument} · ${item.focus}`}
                muted={item.status === 'Done'}
                onOpen={() => setOpenId(item.id)}
                openLabel={`Open ${item.instrument} ${item.focus} session`}
                leading={
                  <Checkbox
                    checked={item.status === 'Done'}
                    aria-label={
                      item.status === 'Done'
                        ? `Reopen ${item.instrument} ${item.focus} session`
                        : `Mark ${item.instrument} ${item.focus} session done`
                    }
                    onCheckedChange={(checked) =>
                      setData((current) => ({
                        ...current,
                        practice: current.practice.map((row) =>
                          row.id === item.id ? { ...row, status: checked === true ? 'Done' : 'Planned' } : row,
                        ),
                      }))
                    }
                  />
                }
                detail={
                  <>
                    {item.piece || 'No piece'} · {item.date} · {item.minutes}m
                    {item.bpm ? ` · ${item.bpm} BPM` : ''}
                  </>
                }
                meta={<StatusBadge status={item.status} overrides={PRACTICE_TONE} />}
                actions={
                  <ConfirmDelete
                    itemName={`${item.instrument} · ${item.focus}`}
                    itemLabel="practice session"
                    onDelete={() =>
                      setData((current) => ({
                        ...current,
                        practice: current.practice.filter((row) => row.id !== item.id),
                      }))
                    }
                  />
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open ? `${open.instrument} · ${open.focus}` : ''}
        subtitle={open?.date}
        badges={open && <StatusBadge status={open.status} overrides={PRACTICE_TONE} />}
        renderEdit={(current, setCurrent) => <PracticeFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            practice: current.practice.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={`${open.instrument} · ${open.focus}`}
              itemLabel="practice session"
              onDelete={() => {
                setData((current) => ({ ...current, practice: current.practice.filter((item) => item.id !== open.id) }));
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Piece / exercise" value={open.piece} />
            <Fact label="Duration" value={`${open.minutes} minutes`} />
            <Fact label="Tempo" value={open.bpm ? `${open.bpm} BPM` : ''} />
            <Fact
              label="Day block"
              value={DAY_BLOCKS.find((block) => block.id === open.blockId)?.label}
              placeholder="Unblocked"
            />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Asset fields shared by the create form and the edit sheet. */
function AssetFields({
  draft,
  setDraft,
  projects,
}: {
  draft: MusicAsset;
  setDraft: (next: MusicAsset) => void;
  projects: MusicProject[];
}) {
  return (
    <>
      <FieldGroup legend="Asset" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={MUSIC_ASSET_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as MusicAsset['type'] })}
        />
        <Choice
          label="Project"
          value={draft.projectId ?? ''}
          clearable
          clearLabel="Shared asset"
          placeholder="Shared asset"
          options={projects.map((item) => ({ value: item.id, label: item.title || 'Untitled project' }))}
          onChange={(projectId) => setDraft({ ...draft, projectId: projectId || undefined })}
        />
      </FieldGroup>
      <FieldGroup legend="Provenance" columns={2}>
        <Field label="Path / file" className="sm:col-span-2">
          <Input
            value={draft.path ?? ''}
            onChange={(event) => setDraft({ ...draft, path: event.target.value || undefined })}
          />
        </Field>
        <Field label="Source" hint="A URL here renders as a link.">
          <Input
            value={draft.source ?? ''}
            onChange={(event) => setDraft({ ...draft, source: event.target.value || undefined })}
          />
        </Field>
        <Field label="License">
          <Input
            value={draft.license ?? ''}
            onChange={(event) => setDraft({ ...draft, license: event.target.value || undefined })}
          />
        </Field>
        <Field label="Tags" hint="Comma separated." className="sm:col-span-2">
          <Input
            value={draft.tags.join(', ')}
            onChange={(event) => setDraft({ ...draft, tags: split(event.target.value) })}
          />
        </Field>
        <Field label="Notes / chain / patch" className="sm:col-span-2">
          <Textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function MusicAssetsView() {
  const [data, setData] = useMusicStore();
  const [draft, setDraft] = useState(blankAsset);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.title.trim()) return;
    setData((current) => ({ ...current, assets: [...current.assets, { ...draft, title: draft.title.trim() }] }));
    setDraft(blankAsset());
  };

  const projectTitle = (id?: string) =>
    id ? data.projects.find((item) => item.id === id)?.title ?? 'Removed project' : 'Shared asset';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.assets]
      .filter((item) => {
        if (type !== 'all' && item.type !== type) return false;
        if (!needle) return true;
        return [item.title, item.type, item.path, item.source, item.license, item.notes, ...item.tags]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [data.assets, query, type]);

  const open = data.assets.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Music Library & Studio"
      icon={PackagePlus}
      subtitle="Samples, presets, modular patches, repertoire, references, setlists, gear, signal chains, and licensing."
      actions={
        <PopoverEditor title="Add asset">
          <AssetFields draft={draft} setDraft={setDraft} projects={data.projects} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <PackagePlus className="size-4" aria-hidden="true" />
            Add asset
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search the library…" label="Search music assets" />
          <FilterChips
            label="Filter assets by type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All', count: data.assets.length },
              ...MUSIC_ASSET_TYPES.map((value) => ({
                value,
                label: value,
                count: data.assets.filter((item) => item.type === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={PackagePlus}
          size="page"
          title={data.assets.length === 0 ? 'The library is empty' : 'No asset matches'}
          description={
            data.assets.length === 0
              ? 'Capture samples, presets, patches, gear and references so they are findable later.'
              : 'Try another search or type filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => (
            <RecordCard
              key={item.id}
              title={item.title}
              onOpen={() => setOpenId(item.id)}
              badges={
                <>
                  <Badge variant="secondary">{item.type}</Badge>
                  {item.license && <Badge variant="outline">{item.license}</Badge>}
                </>
              }
              detail={
                <>
                  <p>{projectTitle(item.projectId)}</p>
                  <p className="truncate">{item.path || item.notes || 'No path recorded'}</p>
                  {item.source ? <LinkOut url={item.source} /> : null}
                </>
              }
              footer={item.tags.length ? item.tags.join(' · ') : undefined}
              actions={
                <ConfirmDelete
                  itemName={item.title}
                  itemLabel="asset"
                  onDelete={() =>
                    setData((current) => ({ ...current, assets: current.assets.filter((row) => row.id !== item.id) }))
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
        subtitle={open ? projectTitle(open.projectId) : undefined}
        badges={open && <Badge variant="secondary">{open.type}</Badge>}
        renderEdit={(current, setCurrent) => (
          <AssetFields draft={current} setDraft={setCurrent} projects={data.projects} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            assets: current.assets.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="asset"
              onDelete={() => {
                setData((current) => ({ ...current, assets: current.assets.filter((item) => item.id !== open.id) }));
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Path / file" value={open.path} wide />
            <Fact label="Source" value={open.source ? <LinkOut url={open.source} /> : ''} />
            <Fact label="License" value={open.license} />
            <Fact label="Tags" value={open.tags.join(', ')} placeholder="Untagged" wide />
            <Fact label="Notes / chain / patch" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

export function MusicDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useMusicStore();
  const week = weekOf(isoDay());
  const unfinished = unfinishedMusicProjects(data);
  const minutes = completedMusicMinutes(data, week[0], week[6]);
  const stale = unfinished.filter((item) => !item.nextAction.trim());
  const releases = data.projects.filter((item) => item.status === 'Released').length;
  const gear = data.assets.filter((item) => item.type === 'Gear').length;
  const patches = data.assets.filter((item) => item.type === 'Patch').length;
  const hasReference = data.assets.some((item) => item.type === 'Reference');

  if (data.projects.length === 0 && data.practice.length === 0 && data.assets.length === 0) {
    return (
      <ViewShell title="Music overview" icon={Music2} subtitle="Track pipeline, practice minutes, references, and the next concrete production step.">
        <DashboardEmpty
          icon={Music2}
          title="The studio is empty"
          description="Start a track, log a practice session, or add a reference, and this overview will follow the work."
          action={
            <Button size="sm" onClick={() => navigateView('music-projects')}>
              Start a track
            </Button>
          }
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Music overview"
      icon={Gauge}
      subtitle="Production momentum, practice, repertoire, modular work, studio assets, and shipped music."
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="xl:grid-cols-6">
        <Metric label="Active projects" value={unfinished.length} />
        <Metric label="Practice this week" value={`${minutes}m`} detail="Completed sessions" />
        <Metric
          label="Needs next action"
          value={stale.length}
          tone={stale.length ? 'warning' : 'default'}
          detail={stale.length ? stale.map((item) => item.title).join(', ') : 'All projects moving'}
        />
        <Metric label="Released" value={releases} />
        <Metric label="Gear" value={gear} />
        <Metric label="Saved patches" value={patches} />
      </MetricRow>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel title="Production pipeline" icon={Disc3}>
          <ul className="space-y-2">
            {MUSIC_PROJECT_STATUSES.filter((status) => status !== 'Archived').map((status) => {
              const count = data.projects.filter((item) => item.status === status).length;
              return (
                <li key={status} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0">{status}</span>
                  <Progress
                    value={data.projects.length ? (count / data.projects.length) * 100 : 0}
                    aria-label={`${status}: ${count} project${count === 1 ? '' : 's'}`}
                    className="flex-1"
                  />
                  <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{count}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="System checks" icon={Gauge}>
          <HealthSummary
            allClear={`Every project has a next action, ${minutes} minutes practised this week, references captured.`}
            checks={[
              {
                okay: stale.length === 0,
                message: `${stale.length} project${stale.length === 1 ? '' : 's'} need a next action.`,
              },
              { okay: minutes > 0, message: 'No completed practice logged this week.' },
              { okay: hasReference, message: 'Add a production or listening reference.' },
            ]}
          />
        </Panel>
      </div>
    </ViewShell>
  );
}

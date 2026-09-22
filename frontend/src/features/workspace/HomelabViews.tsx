import { useMemo, useState } from 'react';
import { ArrowRight, History, Network, Plus, Server, Wrench } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Textarea, cn } from '@/ui';
import {
  CardGrid,
  Choice,
  ConfirmDelete,
  DashboardEmpty,
  DashboardGrid,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
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
  HOMELAB_ASSET_TYPES,
  HOMELAB_RUN_STATUSES,
  HOMELAB_RUN_TYPES,
  HOMELAB_STATUSES,
  newHomelabId,
  type HomelabAsset,
  type HomelabBackupHealth,
  type HomelabRun,
} from './homelab';
import { isoDay } from './para';
import { addDays } from './planner';
import type { WorkspaceViewProps } from './plugins/types';
import { useHomelabStore } from './useHomelabStore';

const CRITICALITIES = ['Low', 'Medium', 'High'] as const;

const CRITICALITY_VARIANT: Record<HomelabAsset['criticality'], 'outline' | 'secondary' | 'warning'> = {
  Low: 'outline',
  Medium: 'secondary',
  High: 'warning',
};

const formatBackupAge = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return 'unknown';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatBackupCapacity = (capacityKiB: number): string =>
  Number.isFinite(capacityKiB) && capacityKiB > 0 ? `${(capacityKiB / 1024 / 1024).toFixed(1)} GiB free` : 'capacity unknown';

const backupHealthStatus = (health: HomelabBackupHealth): string => {
  if (health.failureState !== 'none') return health.failureState;
  if (health.integrity !== 'ok') return health.integrity;
  return 'Healthy';
};

const blankAsset = (): HomelabAsset => ({
  id: newHomelabId('asset'),
  name: '',
  type: 'Service',
  status: 'Planned',
  environment: 'Home',
  criticality: 'Medium',
  notes: '',
});

const blankRun = (): HomelabRun => ({
  id: newHomelabId('run'),
  type: 'Experiment',
  title: '',
  date: isoDay(),
  minutes: 60,
  status: 'Planned',
  outcome: '',
  nextAction: '',
});

/** Asset fields shared by the create form and the edit sheet. */
function AssetFields({
  draft,
  setDraft,
  assets,
}: {
  draft: HomelabAsset;
  setDraft: (next: HomelabAsset) => void;
  assets: HomelabAsset[];
}) {
  const hosts = assets.filter((item) => item.id !== draft.id);
  return (
    <>
      <FieldGroup legend="Asset" columns={2}>
        <Field label="Name" className="sm:col-span-2">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={HOMELAB_ASSET_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as HomelabAsset['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={HOMELAB_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as HomelabAsset['status'] })}
        />
        <Choice
          label="Criticality"
          value={draft.criticality}
          options={CRITICALITIES}
          hint="High-criticality assets are checked for a completed backup on the dashboard."
          onChange={(criticality) => setDraft({ ...draft, criticality: criticality as HomelabAsset['criticality'] })}
        />
        <Field label="Environment">
          <Input value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value })} />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Placement & access" columns={2}>
        <Choice
          label="Runs on host"
          value={draft.hostId ?? ''}
          clearable
          clearLabel="Top level"
          placeholder="Top level"
          hint="Groups this asset under the machine or network that carries it."
          options={hosts.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(hostId) => setDraft({ ...draft, hostId: hostId || undefined })}
          className="sm:col-span-2"
        />
        <Field label="Address / IP">
          <Input
            value={draft.address ?? ''}
            onChange={(event) => setDraft({ ...draft, address: event.target.value || undefined })}
          />
        </Field>
        <Field label="URL" hint="Rendered as a link on the asset.">
          <Input
            type="url"
            placeholder="https://"
            value={draft.url ?? ''}
            onChange={(event) => setDraft({ ...draft, url: event.target.value || undefined })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function HomelabAssetsView() {
  const [data, setData] = useHomelabStore();
  const [draft, setDraft] = useState(blankAsset);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.name.trim()) return;
    setData((current) => ({ ...current, assets: [...current.assets, { ...draft, name: draft.name.trim() }] }));
    setDraft(blankAsset());
  };

  const removeAsset = (id: string) =>
    setData((current) => ({
      ...current,
      assets: current.assets
        .filter((item) => item.id !== id)
        .map((item) => (item.hostId === id ? { ...item, hostId: undefined } : item)),
      runs: current.runs.map((run) => (run.assetId === id ? { ...run, assetId: undefined } : run)),
    }));

  const hostName = (id?: string) => (id ? data.assets.find((item) => item.id === id)?.name : undefined);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assets.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;
      return [item.name, item.type, item.environment, item.address, item.url, item.notes, hostName(item.hostId)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.assets, query, status]);

  /** `hostId` models a hierarchy, so render it as one instead of a string suffix. */
  const groups = useMemo(() => {
    const buckets = new Map<string, HomelabAsset[]>();
    filtered.forEach((item) => {
      const host = item.hostId && data.assets.some((candidate) => candidate.id === item.hostId) ? item.hostId : '';
      buckets.set(host, [...(buckets.get(host) ?? []), item]);
    });
    return [...buckets.entries()]
      .map(([hostId, assets]) => ({
        hostId,
        label: hostId ? `Hosted on ${hostName(hostId) ?? 'unknown host'}` : 'Top level',
        assets: [...assets].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => (a.hostId === '' ? -1 : b.hostId === '' ? 1 : a.label.localeCompare(b.label)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, data.assets]);

  const open = data.assets.find((item) => item.id === openId) ?? null;

  const card = (item: HomelabAsset) => (
    <RecordCard
      key={item.id}
      title={item.name}
      onOpen={() => setOpenId(item.id)}
      badges={
        <>
          <Badge variant="secondary">{item.type}</Badge>
          <StatusBadge status={item.status} />
          <Badge variant={CRITICALITY_VARIANT[item.criticality]}>{item.criticality} criticality</Badge>
        </>
      }
      detail={
        <>
          <p>{[item.environment, item.address].filter(Boolean).join(' · ') || 'No address recorded'}</p>
          {item.url ? <LinkOut url={item.url} /> : null}
        </>
      }
      actions={
        <ConfirmDelete
          itemName={item.name}
          itemLabel="asset"
          onDelete={() => removeAsset(item.id)}
          consequence="Operations logged against it become general infrastructure, and anything hosted on it moves to top level."
        />
      }
    />
  );

  return (
    <ViewShell
      title="Infrastructure"
      icon={Network}
      subtitle="Devices, networks, VLANs, VMs, containers, services, domains, ownership, and operational criticality."
      actions={
        <PopoverEditor title="Add asset">
          <AssetFields draft={draft} setDraft={setDraft} assets={data.assets} />
          <Button onClick={add} disabled={!draft.name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add asset
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search assets…" label="Search assets" />
          <FilterChips
            label="Filter assets by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.assets.length },
              ...HOMELAB_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.assets.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
      bodyClassName="space-y-4 p-4"
    >
      {groups.length === 0 ? (
        <EmptyPanel
          icon={Server}
          size="page"
          title={data.assets.length === 0 ? 'No infrastructure assets' : 'No asset matches'}
          description={
            data.assets.length === 0
              ? 'Record the machines, networks and services the homelab actually runs.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        groups.map((group) => (
          <Panel
            key={group.hostId || 'top-level'}
            title={group.label}
            icon={group.hostId ? Server : Network}
            description={`${group.assets.length} asset${group.assets.length === 1 ? '' : 's'}`}
          >
            <CardGrid>{group.assets.map(card)}</CardGrid>
          </Panel>
        ))
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        subtitle={open?.type}
        badges={
          open && (
            <>
              <StatusBadge status={open.status} />
              <Badge variant={CRITICALITY_VARIANT[open.criticality]}>{open.criticality} criticality</Badge>
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <AssetFields draft={current} setDraft={setCurrent} assets={data.assets} />
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
              itemName={open.name}
              itemLabel="asset"
              onDelete={() => {
                removeAsset(open.id);
                setOpenId(null);
              }}
              consequence="Operations logged against it become general infrastructure, and anything hosted on it moves to top level."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Environment" value={open.environment} />
            <Fact label="Criticality" value={open.criticality} emphasis />
            <Fact label="Runs on host" value={hostName(open.hostId)} placeholder="Top level" />
            <Fact label="Address / IP" value={open.address} />
            <Fact label="URL" value={open.url ? <LinkOut url={open.url} /> : ''} placeholder="No URL" wide />
            <Fact
              label="Hosted assets"
              value={
                data.assets
                  .filter((item) => item.hostId === open.id)
                  .map((item) => item.name)
                  .join(', ') || ''
              }
              placeholder="Nothing hosted here"
              wide
            />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Operation fields shared by the create form and the edit sheet. */
function RunFields({
  draft,
  setDraft,
  assets,
}: {
  draft: HomelabRun;
  setDraft: (next: HomelabRun) => void;
  assets: HomelabAsset[];
}) {
  return (
    <>
      <FieldGroup legend="Operation" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Asset"
          value={draft.assetId ?? ''}
          clearable
          clearLabel="General infrastructure"
          placeholder="General infrastructure"
          options={assets.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(assetId) => setDraft({ ...draft, assetId: assetId || undefined })}
          className="sm:col-span-2"
        />
        <Choice
          label="Type"
          value={draft.type}
          options={HOMELAB_RUN_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as HomelabRun['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={HOMELAB_RUN_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as HomelabRun['status'] })}
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
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as HomelabRun['blockId'] })}
          className="sm:col-span-2"
        />
      </FieldGroup>
      <FieldGroup legend="Result" columns={1}>
        <Field label="Outcome">
          <Textarea rows={2} value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })} />
        </Field>
        <Field label="Next action" hint="What the operation leaves open.">
          <Input value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function HomelabOperationsView() {
  const [data, setData] = useHomelabStore();
  const [draft, setDraft] = useState(blankRun);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.title.trim()) return;
    setData((current) => ({ ...current, runs: [...current.runs, { ...draft, title: draft.title.trim() }] }));
    setDraft(blankRun());
  };

  const assetName = (id?: string) => (id ? data.assets.find((item) => item.id === id)?.name ?? 'Removed asset' : 'General');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.runs]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [item.title, item.type, item.outcome, item.nextAction, assetName(item.assetId)]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.runs, data.assets, query, status]);

  const open = data.runs.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Operations & Experiments"
      icon={Wrench}
      subtitle="Deployments, changes, incidents, maintenance, backups, restore tests, and R&D sessions."
      actions={
        <PopoverEditor title="Plan or log work">
          <RunFields draft={draft} setDraft={setDraft} assets={data.assets} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add operation
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search operations…" label="Search operations" />
          <FilterChips
            label="Filter operations by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.runs.length },
              ...HOMELAB_RUN_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.runs.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      <Panel title="Operations log" icon={Wrench} bodyClassName="p-0">
        {filtered.length === 0 ? (
          <EmptyPanel
            icon={Wrench}
            title={data.runs.length === 0 ? 'No operations logged' : 'Nothing matches'}
            description={
              data.runs.length === 0
                ? 'Log a deployment, incident, backup or restore test to build the operational record.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows>
            {filtered.map((item) => (
              <ListRow
                key={item.id}
                title={item.title}
                muted={item.status === 'Done'}
                onOpen={() => setOpenId(item.id)}
                leading={
                  <Checkbox
                    checked={item.status === 'Done'}
                    aria-label={item.status === 'Done' ? `Reopen “${item.title}”` : `Mark “${item.title}” done`}
                    onCheckedChange={(checked) =>
                      setData((current) => ({
                        ...current,
                        runs: current.runs.map((run) =>
                          run.id === item.id ? { ...run, status: checked === true ? 'Done' : 'Planned' } : run,
                        ),
                      }))
                    }
                  />
                }
                detail={
                  <>
                    {item.type} · {assetName(item.assetId)} · {item.date} · {item.minutes}m
                    {item.nextAction ? ` · next: ${item.nextAction}` : ''}
                  </>
                }
                meta={<StatusBadge status={item.status} />}
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="operation"
                    onDelete={() =>
                      setData((current) => ({ ...current, runs: current.runs.filter((run) => run.id !== item.id) }))
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
        title={open?.title ?? ''}
        subtitle={open ? `${open.type} · ${assetName(open.assetId)} · ${open.date}` : undefined}
        badges={open && <StatusBadge status={open.status} />}
        renderEdit={(current, setCurrent) => <RunFields draft={current} setDraft={setCurrent} assets={data.assets} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            runs: current.runs.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="operation"
              onDelete={() => {
                setData((current) => ({ ...current, runs: current.runs.filter((item) => item.id !== open.id) }));
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Duration" value={`${open.minutes} minutes`} />
            <Fact
              label="Day block"
              value={DAY_BLOCKS.find((block) => block.id === open.blockId)?.label}
              placeholder="Unblocked"
            />
            <Fact label="Outcome" value={open.outcome} wide />
            <Fact label="Next action" value={open.nextAction} wide emphasis placeholder="Nothing left open" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

export function HomelabDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useHomelabStore();
  const today = isoDay();

  const online = data.assets.filter((item) => item.status === 'Online').length;
  const degraded = data.assets.filter((item) => ['Degraded', 'Offline'].includes(item.status));
  const failed = data.runs.filter((item) => item.status === 'Failed');
  const backupHealth = [...data.backupHealth].sort((a, b) => a.assetId.localeCompare(b.assetId));
  const backupFailures = backupHealth.filter((item) => item.failureState !== 'none' || item.integrity !== 'ok');
  const completedBackups = new Set(
    data.runs.filter((run) => run.type === 'Backup' && run.status === 'Done').map((run) => run.assetId).filter(Boolean),
  );
  backupHealth.filter((item) => item.failureState === 'none' && item.integrity === 'ok').forEach((item) => completedBackups.add(item.assetId));
  const missingBackup = data.assets.filter(
    (item) =>
      item.criticality === 'High' &&
      !completedBackups.has(item.id),
  );
  const restoreTests = data.runs.filter((run) => run.type === 'Restore Test' && run.status === 'Done').length;

  const assetName = (id?: string) => data.assets.find((item) => item.id === id)?.name;

  /** Operations still open, soonest first — the actual work queue. */
  const openRuns = [...data.runs]
    .filter((run) => run.status === 'Planned' || run.status === 'In progress')
    .sort((a, b) => a.date.localeCompare(b.date));

  const recentRuns = [...data.runs]
    .filter((run) => run.status === 'Done' || run.status === 'Failed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  /** Completed operations per day over the last fortnight. */
  const activity = Array.from({ length: 14 }, (_, index) => {
    const day = addDays(today, index - 13);
    return data.runs.filter((run) => run.date === day && run.status === 'Done').length;
  });

  if (data.assets.length === 0 && data.runs.length === 0) {
    return (
      <ViewShell
        title="Homelab overview"
        icon={Server}
        subtitle="Operational state, incidents, backups, restore confidence, changes, and experiments."
      >
        <DashboardEmpty
          icon={Server}
          title="Nothing tracked yet"
          description="Record the machines, networks and services the homelab runs, then log the work you do on them."
          action={
            <Button size="sm" onClick={() => navigateView('homelab-assets')}>
              Add infrastructure
            </Button>
          }
        />
      </ViewShell>
    );
  }

  const goTo = (view: string, label: string) => (
    <Button size="sm" variant="ghost" onClick={() => navigateView(view)}>
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );

  return (
    <ViewShell
      title="Homelab overview"
      icon={Server}
      subtitle="Operational state, incidents, backups, restore confidence, changes, and experiments."
      actions={goTo('homelab-assets', 'Infrastructure')}
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="xl:grid-cols-5">
        <Metric
          label="Online assets"
          value={online}
          detail={`of ${data.assets.length} tracked`}
          onOpen={() => navigateView('homelab-assets')}
        />
        <Metric
          label="Degraded or offline"
          value={degraded.length}
          tone={degraded.length ? 'danger' : 'success'}
          detail={degraded.length ? degraded.map((item) => item.name).join(', ') : 'All healthy'}
          onOpen={() => navigateView('homelab-assets')}
        />
        <Metric
          label="Critical without backup"
          value={missingBackup.length}
          tone={missingBackup.length ? 'warning' : 'success'}
          detail={missingBackup.length ? missingBackup.map((item) => item.name).join(', ') : 'All covered'}
          onOpen={() => navigateView('homelab-assets')}
        />
        <Metric
          label="Operations logged"
          value={data.runs.filter((run) => run.status === 'Done').length}
          trend={activity}
          detail="last 14 days"
          onOpen={() => navigateView('homelab-operations')}
        />
        <Metric label="Restore tests passed" value={restoreTests} detail="proves the backups" />
      </MetricRow>

      <DashboardGrid>
        <Panel
          title="Open operations"
          icon={Wrench}
          description={openRuns.length ? undefined : 'Nothing scheduled.'}
          actions={goTo('homelab-operations', 'Operations')}
          bodyClassName="p-0"
          className="xl:col-span-2"
        >
          {openRuns.length === 0 ? (
            <EmptyPanel
              icon={Wrench}
              title="No open operations"
              description="Plan a backup, change or restore test to build a record you can trust."
            />
          ) : (
            <ListRows>
              {openRuns.map((run) => {
                const overdue = run.date < today;
                return (
                  <ListRow
                    key={run.id}
                    title={run.title}
                    detail={
                      <>
                        {run.type}
                        {assetName(run.assetId) ? ` · ${assetName(run.assetId)}` : ''}
                        {run.nextAction ? ` · next: ${run.nextAction}` : ''}
                      </>
                    }
                    meta={
                      <>
                        <span className={cn('font-mono', overdue && 'text-destructive')}>{run.date}</span>
                        <StatusBadge status={run.status} overrides={{ 'in progress': 'info' }} />
                      </>
                    }
                    onOpen={() => navigateView('homelab-operations')}
                  />
                );
              })}
            </ListRows>
          )}
        </Panel>

        <Panel title="Health" icon={Network}>
          <HealthSummary
            allClear="Assets healthy, critical backups covered, no failed operations."
            checks={[
              {
                okay: degraded.length === 0,
                message: `${degraded.length} asset${degraded.length === 1 ? ' is' : 's are'} degraded or offline: ${degraded
                  .map((item) => item.name)
                  .join(', ')}.`,
                action: goTo('homelab-assets', 'Open'),
              },
              {
                okay: missingBackup.length === 0,
                message: `${missingBackup.length} critical asset${missingBackup.length === 1 ? ' needs' : 's need'} a completed backup record.`,
                action: goTo('homelab-operations', 'Log'),
              },
              {
                okay: failed.length === 0,
                message: `${failed.length} failed operation${failed.length === 1 ? '' : 's'} need follow-up.`,
                action: goTo('homelab-operations', 'Open'),
              },
              {
                okay: backupHealth.length > 0 && backupFailures.length === 0,
                message:
                  backupHealth.length === 0
                    ? 'No per-asset backup-health payload is reporting yet.'
                    : `${backupFailures.length} backup-health record${backupFailures.length === 1 ? '' : 's'} need follow-up.`,
                action: goTo('homelab-operations', 'Review'),
              },
            ]}
          />
        </Panel>

        <Panel
          title="Backup health"
          icon={History}
          description="Per-asset freshness, capacity, integrity, restore evidence, failure state, and ownership."
          actions={goTo('homelab-operations', 'Operations')}
          bodyClassName="p-0"
        >
          {backupHealth.length === 0 ? (
            <EmptyPanel
              icon={History}
              title="No collector payload"
              description="Connect a backup collector to expose freshness, restore evidence, and failure state per asset."
            />
          ) : (
            <ListRows>
              {backupHealth.map((health) => {
                const restore = health.lastRestoreTest;
                return (
                  <ListRow
                    key={health.assetId}
                    title={assetName(health.assetId) ?? health.assetId}
                    detail={`Owner ${health.owner} · last success ${health.lastSuccess ?? 'not recorded'} · age ${formatBackupAge(health.ageSeconds)} · ${formatBackupCapacity(health.capacityKiB)} · integrity ${health.integrity} · restore ${restore.status}${restore.observedAt ? ` (${restore.observedAt})` : ''}`}
                    meta={<StatusBadge status={backupHealthStatus(health)} />}
                  />
                );
              })}
            </ListRows>
          )}
        </Panel>

        <Panel
          title="Infrastructure"
          icon={Server}
          actions={goTo('homelab-assets', 'All assets')}
          bodyClassName="p-0"
        >
          {data.assets.length === 0 ? (
            <EmptyPanel icon={Server} title="No assets" description="Add the machines and services you run." />
          ) : (
            <ListRows>
              {[...data.assets]
                .sort((a, b) => {
                  const rank = (item: HomelabAsset) => (item.status === 'Online' ? 1 : 0);
                  return rank(a) - rank(b) || a.name.localeCompare(b.name);
                })
                .slice(0, 7)
                .map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.name}
                    detail={[item.type, assetName(item.hostId) && `on ${assetName(item.hostId)}`, item.address]
                      .filter(Boolean)
                      .join(' · ')}
                    meta={<StatusBadge status={item.status} />}
                    onOpen={() => navigateView('homelab-assets')}
                  />
                ))}
            </ListRows>
          )}
        </Panel>

        <Panel
          title="Recent work"
          icon={History}
          actions={goTo('homelab-operations', 'Operations')}
          bodyClassName="p-0"
          className="xl:col-span-2"
        >
          {recentRuns.length === 0 ? (
            <EmptyPanel icon={History} title="Nothing logged yet" description="Completed operations appear here." />
          ) : (
            <ListRows>
              {recentRuns.map((run) => (
                <ListRow
                  key={run.id}
                  title={run.title}
                  detail={[run.type, assetName(run.assetId), run.outcome].filter(Boolean).join(' · ')}
                  meta={
                    <>
                      <span className="font-mono">{run.date}</span>
                      <StatusBadge status={run.status} />
                    </>
                  }
                  onOpen={() => navigateView('homelab-operations')}
                />
              ))}
            </ListRows>
          )}
        </Panel>
      </DashboardGrid>
    </ViewShell>
  );
}

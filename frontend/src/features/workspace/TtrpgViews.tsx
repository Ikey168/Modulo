import { useMemo, useState } from 'react';
import { CalendarDays, Dices as Dice20, Plus, ScrollText, Users } from 'lucide-react';
import { Badge, Button, Input, Textarea } from '@/ui';
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
  ViewShell,
} from './viewkit';
import type { WorkspaceViewProps } from './plugins/types';
import { PopoverEditor } from './EntryPopover';
import { DAY_BLOCKS } from './dayBlocks';
import {
  CAMPAIGN_STATUSES,
  GAME_SESSION_STATUSES,
  TTRPG_ENTITY_TYPES,
  newTtrpgId,
  type Campaign,
  type GameSession,
  type TtrpgEntity,
} from './ttrpg';
import { isoDay } from './para';
import { useTtrpgStore } from './useTtrpgStore';

const split = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const listOrDash = (values: string[]) => (values.length ? values.join(', ') : '');

const campaign = (): Campaign => ({
  id: newTtrpgId('campaign'),
  title: '',
  system: '',
  status: 'Idea',
  cadence: 'Weekly',
  location: '',
  gm: '',
  players: [],
  tone: '',
  safetyTools: '',
  notes: '',
});

const entity = (): TtrpgEntity => ({
  id: newTtrpgId('entity'),
  campaignId: '',
  type: 'Lore',
  name: '',
  status: '',
  summary: '',
  links: [],
});

const session = (): GameSession => ({
  id: newTtrpgId('session'),
  campaignId: '',
  title: '',
  date: isoDay(),
  minutes: 240,
  status: 'Planned',
  attendees: [],
  prep: '',
  summary: '',
  decisions: '',
  nextHook: '',
});

const CAMPAIGN_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  active: 'success',
  recruiting: 'info',
  paused: 'warning',
  idea: 'outline',
  completed: 'success',
  archived: 'outline',
};

/** Campaign fields shared by the create form and the edit sheet. */
function CampaignFields({
  draft,
  setDraft,
}: {
  draft: Campaign;
  setDraft: (next: Campaign) => void;
}) {
  return (
    <>
      <FieldGroup legend="Table" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="System">
          <Input
            value={draft.system}
            onChange={(event) => setDraft({ ...draft, system: event.target.value })}
            placeholder="Cyberpunk RED, Shadowrun, D&D…"
          />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={CAMPAIGN_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as Campaign['status'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Schedule" columns={2}>
        <Field label="Cadence">
          <Input value={draft.cadence} onChange={(event) => setDraft({ ...draft, cadence: event.target.value })} />
        </Field>
        <Field label="Next session">
          <Input
            type="date"
            value={draft.nextSession ?? ''}
            onChange={(event) => setDraft({ ...draft, nextSession: event.target.value || undefined })}
          />
        </Field>
        <Field label="Location">
          <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </Field>
        <Field label="GM">
          <Input value={draft.gm} onChange={(event) => setDraft({ ...draft, gm: event.target.value })} />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Group" columns={2}>
        <Field label="Players" hint="Comma separated." className="sm:col-span-2">
          <Input
            value={draft.players.join(', ')}
            onChange={(event) => setDraft({ ...draft, players: split(event.target.value) })}
          />
        </Field>
        <Field label="Tone">
          <Input value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} />
        </Field>
        <Field label="Safety tools">
          <Input
            value={draft.safetyTools}
            onChange={(event) => setDraft({ ...draft, safetyTools: event.target.value })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function CampaignsView() {
  const [data, setData] = useTtrpgStore();
  const [draft, setDraft] = useState(campaign);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.title.trim()) return;
    setData((current) => ({ ...current, campaigns: [...current.campaigns, { ...draft, title: draft.title.trim() }] }));
    setDraft(campaign());
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.campaigns.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;
      return [item.title, item.system, item.gm, item.location, ...item.players]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [data.campaigns, query, status]);

  const open = data.campaigns.find((item) => item.id === openId) ?? null;

  const removeCampaign = (id: string) =>
    setData((current) => ({
      ...current,
      campaigns: current.campaigns.filter((item) => item.id !== id),
      entities: current.entities.filter((item) => item.campaignId !== id),
      sessions: current.sessions.filter((item) => item.campaignId !== id),
    }));

  const saveCampaign = (next: Campaign) =>
    setData((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) => (item.id === next.id ? next : item)),
    }));

  const counts = (value: string) =>
    value === 'all' ? data.campaigns.length : data.campaigns.filter((item) => item.status === value).length;

  return (
    <ViewShell
      title="Campaigns"
      icon={Dice20}
      subtitle="Systems, groups, cadence, next sessions, locations, tone, and safety agreements."
      actions={
        <PopoverEditor title="Add campaign">
          <CampaignFields draft={draft} setDraft={setDraft} />
          <Button onClick={add} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add campaign
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search campaigns…"
            label="Search campaigns"
          />
          <FilterChips
            label="Filter campaigns by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: counts('all') },
              ...CAMPAIGN_STATUSES.map((value) => ({ value, label: value, count: counts(value) })),
            ]}
          />
        </Toolbar>
      }
    >
      {filtered.length === 0 ? (
        <EmptyPanel
          icon={Dice20}
          size="page"
          title={data.campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match'}
          description={
            data.campaigns.length === 0
              ? 'Add a table to track its system, cadence, group and safety agreements.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => {
            const sessions = data.sessions.filter((row) => row.campaignId === item.id).length;
            const entities = data.entities.filter((row) => row.campaignId === item.id).length;
            return (
              <RecordCard
                key={item.id}
                title={item.title}
                onOpen={() => setOpenId(item.id)}
                badges={
                  <>
                    <StatusBadge status={item.status} overrides={CAMPAIGN_TONE} />
                    {item.system && <Badge variant="secondary">{item.system}</Badge>}
                  </>
                }
                detail={
                  <>
                    <p>
                      {item.cadence || 'No cadence'}
                      {item.nextSession ? ` · next ${item.nextSession}` : ''}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                    <p>
                      GM {item.gm || 'TBD'} · {item.players.length} player{item.players.length === 1 ? '' : 's'}
                    </p>
                  </>
                }
                footer={`${sessions} session${sessions === 1 ? '' : 's'} · ${entities} world entr${entities === 1 ? 'y' : 'ies'}`}
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="campaign"
                    onDelete={() => removeCampaign(item.id)}
                    consequence="Its world entries and sessions are removed with it."
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
        subtitle={open?.system || undefined}
        badges={open && <StatusBadge status={open.status} overrides={CAMPAIGN_TONE} />}
        renderEdit={(current, setCurrent) => <CampaignFields draft={current} setDraft={setCurrent} />}
        onSave={saveCampaign}
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="campaign"
              onDelete={() => {
                removeCampaign(open.id);
                setOpenId(null);
              }}
              consequence="Its world entries and sessions are removed with it."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Cadence" value={open.cadence} />
            <Fact label="Next session" value={open.nextSession} emphasis />
            <Fact label="Location" value={open.location} />
            <Fact label="GM" value={open.gm} />
            <Fact label="Players" value={listOrDash(open.players)} wide />
            <Fact label="Tone" value={open.tone} />
            <Fact label="Safety tools" value={open.safetyTools} placeholder="None recorded" />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Entity fields shared by the create form and the edit sheet. */
function EntityFields({
  draft,
  setDraft,
  campaigns,
}: {
  draft: TtrpgEntity;
  setDraft: (next: TtrpgEntity) => void;
  campaigns: Campaign[];
}) {
  return (
    <>
      <Choice
        label="Campaign"
        value={draft.campaignId}
        placeholder="Select campaign"
        options={campaigns.map((item) => ({ value: item.id, label: item.title || 'Untitled campaign' }))}
        onChange={(campaignId) => setDraft({ ...draft, campaignId })}
      />
      <Choice
        label="Type"
        value={draft.type}
        options={TTRPG_ENTITY_TYPES}
        onChange={(type) => setDraft({ ...draft, type: type as TtrpgEntity['type'] })}
      />
      <Field label="Name">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <Field label="Status" hint="Free text, e.g. Alive, Hostile, Unresolved.">
        <Input value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} />
      </Field>
      <Field label="Summary">
        <Textarea
          rows={4}
          value={draft.summary}
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
        />
      </Field>
      <Field label="Related names / links" hint="Comma separated.">
        <Input
          value={draft.links.join(', ')}
          onChange={(event) => setDraft({ ...draft, links: split(event.target.value) })}
        />
      </Field>
    </>
  );
}

export function TtrpgWorldView() {
  const [data, setData] = useTtrpgStore();
  const [draft, setDraft] = useState(entity);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.campaignId || !draft.name.trim()) return;
    setData((current) => ({ ...current, entities: [...current.entities, { ...draft, name: draft.name.trim() }] }));
    setDraft(entity());
  };

  const campaignTitle = (id: string) => data.campaigns.find((item) => item.id === id)?.title ?? 'Missing campaign';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.entities.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!needle) return true;
      return [item.name, item.summary, item.status, campaignTitle(item.campaignId), ...item.links]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.entities, data.campaigns, query, type]);

  const open = data.entities.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="World & Characters"
      icon={Users}
      subtitle="Player characters, NPCs, locations, factions, quests, items, lore, encounters, and handouts."
      actions={
        <PopoverEditor title="Add entity">
          <EntityFields draft={draft} setDraft={setDraft} campaigns={data.campaigns} />
          <Button onClick={add} disabled={!draft.campaignId || !draft.name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add entity
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search the world…" label="Search world entries" />
          <FilterChips
            label="Filter world entries by type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All', count: data.entities.length },
              ...TTRPG_ENTITY_TYPES.map((value) => ({
                value,
                label: value,
                count: data.entities.filter((item) => item.type === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      {data.campaigns.length === 0 ? (
        <EmptyPanel
          icon={Dice20}
          size="page"
          title="Add a campaign first"
          description="World entries belong to a campaign, so create one before populating the setting."
        />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={Users}
          size="page"
          title={data.entities.length === 0 ? 'The world is empty' : 'Nothing matches'}
          description={
            data.entities.length === 0
              ? 'Add characters, factions, locations and lore as the table discovers them.'
              : 'Try another search or type filter.'
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((item) => (
            <RecordCard
              key={item.id}
              title={item.name}
              onOpen={() => setOpenId(item.id)}
              badges={
                <>
                  <Badge variant="secondary">{item.type}</Badge>
                  {item.status && <StatusBadge status={item.status} />}
                </>
              }
              detail={
                <>
                  <p>{campaignTitle(item.campaignId)}</p>
                  <p className="line-clamp-3">{item.summary || 'No summary.'}</p>
                </>
              }
              actions={
                <ConfirmDelete
                  itemName={item.name}
                  itemLabel="entry"
                  onDelete={() =>
                    setData((current) => ({
                      ...current,
                      entities: current.entities.filter((row) => row.id !== item.id),
                    }))
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
        title={open?.name ?? ''}
        subtitle={open ? campaignTitle(open.campaignId) : undefined}
        badges={
          open && (
            <>
              <Badge variant="secondary">{open.type}</Badge>
              {open.status && <StatusBadge status={open.status} />}
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <EntityFields draft={current} setDraft={setCurrent} campaigns={data.campaigns} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            entities: current.entities.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.name}
              itemLabel="entry"
              onDelete={() => {
                setData((current) => ({
                  ...current,
                  entities: current.entities.filter((item) => item.id !== open.id),
                }));
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Summary" value={open.summary} wide emphasis />
            <Fact label="Related" value={listOrDash(open.links)} wide placeholder="No links recorded" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

/** Session fields shared by the create form and the edit sheet. */
function SessionFields({
  draft,
  setDraft,
  campaigns,
}: {
  draft: GameSession;
  setDraft: (next: GameSession) => void;
  campaigns: Campaign[];
}) {
  return (
    <>
      <FieldGroup legend="Session" columns={2}>
        <Choice
          label="Campaign"
          value={draft.campaignId}
          placeholder="Select campaign"
          options={campaigns.map((item) => ({ value: item.id, label: item.title || 'Untitled campaign' }))}
          onChange={(campaignId) => setDraft({ ...draft, campaignId })}
          className="sm:col-span-2"
        />
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </Field>
        <Field label="Minutes">
          <Input
            type="number"
            min={30}
            value={draft.minutes}
            onChange={(event) => setDraft({ ...draft, minutes: Number(event.target.value) })}
          />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={GAME_SESSION_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as GameSession['status'] })}
        />
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          options={DAY_BLOCKS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as GameSession['blockId'] })}
        />
      </FieldGroup>
      <FieldGroup legend="At the table" columns={1}>
        <Field label="Attendees" hint="Comma separated.">
          <Input
            value={draft.attendees.join(', ')}
            onChange={(event) => setDraft({ ...draft, attendees: split(event.target.value) })}
          />
        </Field>
        <Field label="Prep">
          <Textarea rows={2} value={draft.prep} onChange={(event) => setDraft({ ...draft, prep: event.target.value })} />
        </Field>
        <Field label="Summary">
          <Textarea
            rows={3}
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          />
        </Field>
        <Field label="Decisions & consequences">
          <Textarea
            rows={2}
            value={draft.decisions}
            onChange={(event) => setDraft({ ...draft, decisions: event.target.value })}
          />
        </Field>
        <Field label="Next hook" hint="What pulls the group into the next session.">
          <Input value={draft.nextHook} onChange={(event) => setDraft({ ...draft, nextHook: event.target.value })} />
        </Field>
      </FieldGroup>
    </>
  );
}

export function TtrpgSessionsView() {
  const [data, setData] = useTtrpgStore();
  const [draft, setDraft] = useState(session);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    if (!draft.campaignId || !draft.title.trim()) return;
    setData((current) => ({ ...current, sessions: [...current.sessions, { ...draft, title: draft.title.trim() }] }));
    setDraft(session());
  };

  const campaignTitle = (id: string) => data.campaigns.find((item) => item.id === id)?.title ?? 'Missing campaign';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.sessions]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [item.title, item.summary, item.nextHook, campaignTitle(item.campaignId), ...item.attendees]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sessions, data.campaigns, query, status]);

  const open = data.sessions.find((item) => item.id === openId) ?? null;

  return (
    <ViewShell
      title="Sessions"
      icon={ScrollText}
      subtitle="Scheduling, attendance, prep, recaps, decisions, continuity, and the next narrative hook."
      actions={
        <PopoverEditor title="Plan or log session">
          <SessionFields draft={draft} setDraft={setDraft} campaigns={data.campaigns} />
          <Button onClick={add} disabled={!draft.campaignId || !draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add session
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search sessions…" label="Search sessions" />
          <FilterChips
            label="Filter sessions by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: data.sessions.length },
              ...GAME_SESSION_STATUSES.map((value) => ({
                value,
                label: value,
                count: data.sessions.filter((item) => item.status === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      <Panel title="Session log" icon={CalendarDays} bodyClassName="p-0">
        {filtered.length === 0 ? (
          <EmptyPanel
            icon={ScrollText}
            title={data.sessions.length === 0 ? 'No sessions yet' : 'Nothing matches'}
            description={
              data.sessions.length === 0
                ? 'Plan a game or log one you have played to build the campaign record.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows>
            {filtered.map((item) => (
              <ListRow
                key={item.id}
                title={item.title}
                onOpen={() => setOpenId(item.id)}
                detail={
                  <>
                    {campaignTitle(item.campaignId)} · {item.date} · {item.minutes}m
                    {item.nextHook ? ` · next: ${item.nextHook}` : ''}
                  </>
                }
                meta={<StatusBadge status={item.status} overrides={{ played: 'success', planned: 'info' }} />}
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="session"
                    onDelete={() =>
                      setData((current) => ({
                        ...current,
                        sessions: current.sessions.filter((row) => row.id !== item.id),
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
        title={open?.title ?? ''}
        subtitle={open ? `${campaignTitle(open.campaignId)} · ${open.date}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={{ played: 'success', planned: 'info' }} />}
        renderEdit={(current, setCurrent) => (
          <SessionFields draft={current} setDraft={setCurrent} campaigns={data.campaigns} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            sessions: current.sessions.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="session"
              onDelete={() => {
                setData((current) => ({
                  ...current,
                  sessions: current.sessions.filter((item) => item.id !== open.id),
                }));
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
            <Fact label="Attendees" value={listOrDash(open.attendees)} wide placeholder="Nobody recorded" />
            <Fact label="Prep" value={open.prep} wide />
            <Fact label="Summary" value={open.summary} wide />
            <Fact label="Decisions & consequences" value={open.decisions} wide />
            <Fact label="Next hook" value={open.nextHook} wide emphasis placeholder="No hook — momentum at risk" />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

export function TtrpgDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useTtrpgStore();
  const active = data.campaigns.filter((item) => item.status === 'Active');
  const played = data.sessions.filter((item) => item.status === 'Played');
  const upcoming = data.sessions.filter((item) => item.status === 'Planned' && item.date >= isoDay());
  const missingHook = played.filter((item) => !item.nextHook.trim());
  const people = [...new Set(played.flatMap((item) => item.attendees))];
  const scheduled = active.every((item) => item.cadence.trim() && item.nextSession);
  const safety = active.every((item) => item.safetyTools.trim());

  if (data.campaigns.length === 0 && data.sessions.length === 0 && data.entities.length === 0) {
    return (
      <ViewShell title="Campaign overview" icon={Dice20} subtitle="Active tables, upcoming games, prep load, continuity, world depth, and recurring community.">
        <DashboardEmpty
          icon={Dice20}
          title="No campaigns yet"
          description="Add a table and this overview tracks upcoming games, prep load, world depth and who keeps showing up."
          action={
            <Button size="sm" onClick={() => navigateView('ttrpg-campaigns')}>
              Add a campaign
            </Button>
          }
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Campaign overview"
      icon={Dice20}
      subtitle="Active tables, upcoming games, prep load, continuity, world depth, and recurring community."
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="lg:grid-cols-5">
        <Metric label="Active campaigns" value={active.length} />
        <Metric label="Upcoming sessions" value={upcoming.length} tone={upcoming.length ? 'default' : 'warning'} />
        <Metric label="World entities" value={data.entities.length} />
        <Metric label="Played sessions" value={played.length} />
        <Metric label="People at the table" value={people.length} />
      </MetricRow>

      <Panel title="Campaign health" icon={Users}>
        <HealthSummary
          allClear="Cadence set, hooks recorded, and safety tools agreed at every active table."
          checks={[
            { okay: scheduled, message: 'An active campaign needs cadence or its next session date.' },
            {
              okay: missingHook.length === 0,
              message: `${missingHook.length} played session${missingHook.length === 1 ? ' needs' : 's need'} a next hook.`,
            },
            { okay: safety, message: 'Record safety tools for every active table.' },
          ]}
        />
      </Panel>
    </ViewShell>
  );
}

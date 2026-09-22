import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, Input, Textarea, cn } from '@/ui';
import { DAY_BLOCKS } from './dayBlocks';
import {
  SESSION_STATUSES,
  newEducationId,
  studyMinutesBetween,
  type LearningNode,
  type StudySession,
} from './education';
import {
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  Panel,
  RecordCard,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
} from './viewkit';
import { addDays, isoDate, weekOf, WEEKDAY_LABELS } from './planner';
import { useEducationStore } from './useEducationStore';
import { PopoverEditor } from './EntryPopover';

const SESSION_TONE: Record<string, 'success' | 'warning' | 'info'> = {
  done: 'success',
  planned: 'info',
  skipped: 'warning',
};

const blank = (): StudySession => ({
  id: newEducationId('session'),
  nodeId: '',
  date: isoDate(new Date()),
  durationMinutes: 60,
  blockId: 'deep-work-b',
  status: 'Planned',
});

const blockLabel = (id: StudySession['blockId']) => DAY_BLOCKS.find((block) => block.id === id)?.label;

/** Study-session fields shared by the plan form and the edit sheet. */
function SessionFields({
  draft,
  setDraft,
  nodes,
}: {
  draft: StudySession;
  setDraft: (next: StudySession) => void;
  nodes: LearningNode[];
}) {
  return (
    <>
      <FieldGroup legend="Session" columns={2}>
        <Choice
          label="Learning item"
          className="sm:col-span-2"
          value={draft.nodeId}
          placeholder="Select a course"
          options={nodes.map((node) => ({ value: node.id, label: `${node.type}: ${node.title}` }))}
          onChange={(nodeId) => setDraft({ ...draft, nodeId })}
        />
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </Field>
        <Field label="Duration (minutes)">
          <Input
            type="number"
            min={0}
            step={5}
            value={draft.durationMinutes}
            onChange={(event) =>
              setDraft({ ...draft, durationMinutes: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </Field>
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="No block"
          placeholder="No block"
          options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as StudySession['blockId'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={SESSION_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as StudySession['status'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Focus" columns={1}>
        <Field label="Session focus" hint="What this block of study is meant to cover.">
          <Textarea
            rows={3}
            value={draft.notes ?? ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function EducationStudyPlannerView() {
  const [data, persist] = useEducationStore();
  const [anchor, setAnchor] = useState(() => isoDate(new Date()));
  const [draft, setDraft] = useState(blank);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const week = useMemo(() => weekOf(anchor), [anchor]);
  const today = isoDate(new Date());
  const selectableNodes = data.nodes.filter((node) => node.status !== 'Dropped');
  const nodeTitle = (id: string) => data.nodes.find((node) => node.id === id)?.title ?? 'Missing learning item';
  const minutes = studyMinutesBetween(data, week[0], week[6]);

  const createDraft: StudySession = {
    ...draft,
    nodeId: data.nodes.some((node) => node.id === draft.nodeId) ? draft.nodeId : selectableNodes[0]?.id ?? '',
  };

  const weekSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.sessions
      .filter((session) => session.date >= week[0] && session.date <= week[6])
      .filter((session) => status === 'all' || session.status === status)
      .filter(
        (session) =>
          !needle ||
          `${data.nodes.find((node) => node.id === session.nodeId)?.title ?? ''} ${session.notes ?? ''}`
            .toLowerCase()
            .includes(needle),
      );
  }, [data.nodes, data.sessions, query, status, week]);

  const open = data.sessions.find((session) => session.id === openId) ?? null;

  const add = () => {
    if (!createDraft.nodeId) return;
    persist((current) => ({ ...current, sessions: [...current.sessions, createDraft] }));
    setDraft({ ...blank(), date: createDraft.date, blockId: createDraft.blockId, nodeId: createDraft.nodeId });
  };
  const save = (next: StudySession) =>
    persist((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === next.id ? next : session)),
    }));
  const remove = (id: string) =>
    persist((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== id) }));

  const counts = (value: string) =>
    data.sessions.filter(
      (session) =>
        session.date >= week[0] && session.date <= week[6] && (value === 'all' || session.status === value),
    ).length;

  return (
    <ViewShell
      title="Study Planner"
      icon={CalendarClock}
      subtitle={`${Math.floor(minutes / 60)}h ${minutes % 60}m completed in ${week[0]} → ${week[6]}`}
      actions={
        <>
          <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="font-mono text-xs">
            {week[0]} → {week[6]}
          </span>
          <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          {!week.includes(today) && (
            <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
              This week
            </Button>
          )}
          {selectableNodes.length > 0 && (
            <PopoverEditor title="Plan study session">
              <SessionFields draft={createDraft} setDraft={setDraft} nodes={selectableNodes} />
              <Button onClick={add} disabled={!createDraft.nodeId}>
                <Plus className="size-4" aria-hidden="true" />
                Plan session
              </Button>
            </PopoverEditor>
          )}
        </>
      }
      toolbar={
        selectableNodes.length > 0 && (
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search sessions…" label="Search study sessions" />
            <FilterChips
              label="Filter study sessions by status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All', count: counts('all') },
                ...SESSION_STATUSES.map((value) => ({ value, label: value, count: counts(value) })),
              ]}
            />
          </Toolbar>
        )
      }
    >
      {selectableNodes.length === 0 ? (
        <EmptyPanel
          icon={CalendarClock}
          size="page"
          title="Nothing to study yet"
          description="Create a program or course in Learning Core first."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {week.map((day, index) => {
            const sessions = weekSessions.filter((session) => session.date === day);
            return (
              <Panel
                key={day}
                title={
                  <span className="flex items-baseline gap-1.5">
                    {WEEKDAY_LABELS[index]}
                    <span className="font-mono text-xxs text-muted-foreground">{day.slice(5)}</span>
                  </span>
                }
                className={cn('min-h-44', day === today && 'border-primary/60 bg-primary/5')}
                bodyClassName="p-2"
              >
                {sessions.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No study planned.</p>
                ) : (
                  <div className="grid gap-2">
                    {sessions.map((session) => (
                      <RecordCard
                        key={session.id}
                        title={nodeTitle(session.nodeId)}
                        onOpen={() => setOpenId(session.id)}
                        badges={
                          <StatusBadge
                            status={session.status}
                            completedStatuses={['Done']}
                            overrides={SESSION_TONE}
                          />
                        }
                        detail={
                          <>
                            <p>
                              {session.durationMinutes} min
                              {blockLabel(session.blockId) ? ` · ${blockLabel(session.blockId)}` : ''}
                            </p>
                            {session.notes && <p className="line-clamp-2">{session.notes}</p>}
                          </>
                        }
                        actions={
                          <ConfirmDelete
                            itemName={`${nodeTitle(session.nodeId)} on ${session.date}`}
                            itemLabel="study session"
                            onDelete={() => remove(session.id)}
                            consequence="Its logged minutes stop counting toward this week's study time."
                          />
                        }
                      />
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open ? nodeTitle(open.nodeId) : ''}
        subtitle={open ? `${open.date} · ${open.durationMinutes} min` : undefined}
        badges={
          open && <StatusBadge status={open.status} completedStatuses={['Done']} overrides={SESSION_TONE} />
        }
        renderEdit={(current, setCurrent) => (
          <SessionFields draft={current} setDraft={setCurrent} nodes={selectableNodes} />
        )}
        onSave={save}
        actions={
          open && (
            <ConfirmDelete
              itemName={`${nodeTitle(open.nodeId)} on ${open.date}`}
              itemLabel="study session"
              onDelete={() => {
                remove(open.id);
                setOpenId(null);
              }}
              consequence="Its logged minutes stop counting toward this week's study time."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Learning item" value={nodeTitle(open.nodeId)} />
            <Fact label="Date" value={open.date} />
            <Fact label="Duration" value={`${open.durationMinutes} minutes`} emphasis />
            <Fact label="Day block" value={blockLabel(open.blockId)} placeholder="No block" />
            <Fact
              label="Session focus"
              value={open.notes && <span className="whitespace-pre-wrap">{open.notes}</span>}
              wide
            />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

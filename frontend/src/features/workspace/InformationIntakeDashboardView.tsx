import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Inbox,
  Radar,
  Wrench,
} from 'lucide-react';
import { Button, Progress } from '@/ui';
import {
  INTAKE_MODE_DEFINITIONS,
  activeDeepResearchCount,
  minutesBetween,
  sessionsOn,
  staleArtifacts,
} from './informationIntake';
import { isoDay } from './para';
import { addDays, weekOf } from './planner';
import type { WorkspaceViewProps } from './plugins/types';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import {
  EmptyPanel,
  HealthLine,
  HealthList,
  ListRow,
  ListRows,
  Metric,
  MetricRow,
  Panel,
  ViewShell,
} from './viewkit';

/** Deep Research runs are capped so attention is not spread thin. */
const DEEP_RESEARCH_LIMIT = 3;
/** Weekly Awareness budget, in minutes. */
const AWARENESS_LIMIT = 120;
/** Maintenance is due if none completed within this many days. */
const MAINTENANCE_WINDOW = 31;
/** Rows shown per panel before the list defers to its full view. */
const PREVIEW = 7;

export function InformationIntakeDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useInformationIntakeStore();
  const today = isoDay();
  const week = weekOf(today);
  const inbox = data.items.filter((item) => item.status === 'Inbox');
  const active = data.items.filter((item) => item.status === 'Active');
  const deepActive = activeDeepResearchCount(data);
  const todaySessions = sessionsOn(data, today);
  const awarenessMinutes = minutesBetween(data, 'Awareness', week[0], week[6]);
  const stale = staleArtifacts(data, today);
  const recentMaintenance = data.sessions.some(
    (session) =>
      session.mode === 'Maintenance' &&
      session.status === 'Done' &&
      session.date >= addDays(today, -MAINTENANCE_WINDOW),
  );
  const transitions = data.items.filter((item) => item.status === 'Done' && item.nextMode);
  const stableOutputs = data.artifacts.filter((artifact) => artifact.status === 'Stable').length;

  const goTo = (view: string, label = 'Open') => (
    <Button size="sm" variant="ghost" onClick={() => navigateView(view)}>
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );

  /**
   * A row names one record, so it opens that record. The workspace route is
   * `/app/:view`, so the id rides in the query string and the target view
   * consumes it with `useDeepLink`.
   */
  const openRecord = (view: string, param: string, id: string) => () =>
    navigateView(`${view}?${param}=${encodeURIComponent(id)}`);

  /** Truncated lists say what they are hiding, so the tile and the list agree. */
  const more = (total: number, view: string) =>
    total > PREVIEW ? (
      <button
        type="button"
        onClick={() => navigateView(view)}
        className="mt-2 rounded-sm px-1.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {total - PREVIEW} more
      </button>
    ) : null;

  return (
    <ViewShell
      title="Information intake"
      icon={Radar}
      subtitle="Capture, routing decisions, mode sessions, and the outputs they produce."
      actions={goTo('information-intake', 'Inbox')}
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="lg:grid-cols-6">
        <Metric
          label="Unrouted"
          value={inbox.length}
          tone={inbox.length > 0 ? 'warning' : 'success'}
          detail={inbox.length > 0 ? 'awaiting a decision' : 'inbox clear'}
        />
        <Metric label="Active modes" value={active.length} />
        <Metric
          label="Deep research"
          value={`${deepActive}/${DEEP_RESEARCH_LIMIT}`}
          tone={deepActive >= DEEP_RESEARCH_LIMIT ? 'warning' : 'default'}
          detail="work-in-progress limit"
        />
        <Metric
          label="Awareness this week"
          value={`${awarenessMinutes}m`}
          tone={awarenessMinutes > AWARENESS_LIMIT ? 'warning' : 'default'}
          detail={`limit ${AWARENESS_LIMIT}m`}
        />
        <Metric label="Stable outputs" value={stableOutputs} />
        <Metric
          label="Due for review"
          value={stale.length}
          tone={stale.length > 0 ? 'warning' : 'default'}
        />
      </MetricRow>

      <section className="grid items-start gap-3 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Today's mode sessions"
          icon={Clock3}
          actions={goTo('information-workbench', 'Workbench')}
          bodyClassName="p-0"
        >
          {todaySessions.length === 0 ? (
            <EmptyPanel
              icon={Clock3}
              title="Nothing planned today"
              description="Schedule a mode session from the workbench to give the day a shape."
            />
          ) : (
            <ListRows>
              {todaySessions.map((session) => {
                const item = data.items.find((candidate) => candidate.id === session.itemId);
                const done = session.status === 'Done';
                return (
                  <ListRow
                    key={session.id}
                    title={item?.title ?? session.mode}
                    muted={done}
                    leading={
                      done ? (
                        <CheckCircle2 className="size-3.5 text-success" aria-label="Done" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground/50" aria-label="Not done" />
                      )
                    }
                    meta={`${session.mode} · ${session.durationMinutes}m`}
                    onOpen={
                      session.itemId
                        ? openRecord('information-workbench', 'item', session.itemId)
                        : undefined
                    }
                  />
                );
              })}
            </ListRows>
          )}
        </Panel>

        <Panel title="System health" icon={Wrench}>
          <HealthList>
            <HealthLine okay={inbox.length < 10}>
              {inbox.length < 10 ? 'Intake backlog is bounded.' : `${inbox.length} items need routing.`}
            </HealthLine>
            <HealthLine okay={deepActive <= DEEP_RESEARCH_LIMIT}>
              {deepActive <= DEEP_RESEARCH_LIMIT
                ? 'Deep Research work-in-progress limit respected.'
                : 'Too many Deep Research topics are active.'}
            </HealthLine>
            <HealthLine okay={awarenessMinutes <= AWARENESS_LIMIT}>
              {awarenessMinutes <= AWARENESS_LIMIT
                ? 'Awareness remains under two hours this week.'
                : 'Awareness exceeded its weekly quality limit.'}
            </HealthLine>
            <HealthLine
              okay={recentMaintenance}
              action={
                recentMaintenance ? undefined : goTo('information-workbench', 'Run it')
              }
            >
              {recentMaintenance
                ? 'Maintenance completed within 31 days.'
                : 'A monthly maintenance review is due.'}
            </HealthLine>
          </HealthList>
        </Panel>

        <Panel
          title="Needs a decision"
          icon={Inbox}
          actions={goTo('information-intake', 'Route')}
          bodyClassName="p-0"
        >
          {inbox.length === 0 ? (
            <EmptyPanel icon={Inbox} title="Inbox is clear" description="Every captured item has a decision." />
          ) : (
            <>
              <ListRows>
                {inbox.slice(0, PREVIEW).map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.title}
                    meta={new Date(item.capturedAt).toLocaleDateString()}
                    onOpen={openRecord('information-intake', 'item', item.id)}
                  />
                ))}
              </ListRows>
              <div className="px-1.5 pb-2">{more(inbox.length, 'information-intake')}</div>
            </>
          )}
        </Panel>

        <Panel
          title="Mode transitions"
          icon={ArrowRight}
          actions={goTo('information-intake')}
          bodyClassName="p-0"
        >
          {transitions.length === 0 ? (
            <EmptyPanel
              icon={ArrowRight}
              title="Nothing waiting downstream"
              description="Completed items with a next mode appear here."
            />
          ) : (
            <>
              <ListRows>
                {transitions.slice(0, PREVIEW).map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.title}
                    meta={`→ ${item.nextMode}`}
                    onOpen={openRecord('information-intake', 'item', item.id)}
                  />
                ))}
              </ListRows>
              <div className="px-1.5 pb-2">{more(transitions.length, 'information-intake')}</div>
            </>
          )}
        </Panel>

        <Panel
          title="Outputs due for review"
          icon={FileText}
          actions={goTo('information-outputs', 'Outputs')}
          bodyClassName="p-0"
        >
          {stale.length === 0 ? (
            <EmptyPanel icon={FileText} title="No reviews due" description="Every output is inside its review window." />
          ) : (
            <>
              <ListRows>
                {stale.slice(0, PREVIEW).map((artifact) => (
                  <ListRow
                    key={artifact.id}
                    title={artifact.title}
                    meta={<span className="text-warning">{artifact.reviewDate}</span>}
                    onOpen={openRecord('information-outputs', 'artifact', artifact.id)}
                  />
                ))}
              </ListRows>
              <div className="px-1.5 pb-2">{more(stale.length, 'information-outputs')}</div>
            </>
          )}
        </Panel>
      </section>

      <Panel title="Modes" icon={Radar} bodyClassName="p-0">
        <div className="grid sm:grid-cols-2">
          {INTAKE_MODE_DEFINITIONS.map((definition) => {
            const modeItems = data.items.filter(
              (item) => item.mode === definition.mode && !['Done', 'Discarded'].includes(item.status),
            );
            const complete = data.items.filter(
              (item) => item.mode === definition.mode && item.status === 'Done',
            ).length;
            const total = modeItems.length + complete;
            return (
              <button
                key={definition.mode}
                type="button"
                onClick={() => navigateView(`information-intake?q=${encodeURIComponent(definition.mode)}`)}
                aria-label={`Show ${definition.mode} items`}
                className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors odd:sm:border-r hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Radar className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{definition.mode}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{modeItems.length}</span>
                {total > 0 && <Progress value={(complete / total) * 100} className="h-1.5 w-16" />}
              </button>
            );
          })}
        </div>
      </Panel>
    </ViewShell>
  );
}

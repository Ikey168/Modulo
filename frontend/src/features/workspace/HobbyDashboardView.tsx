import { Compass, History, PackageCheck, TrendingUp } from 'lucide-react';
import { Badge, Button, Progress } from '@/ui';
import {
  completedSessions,
  peopleYouCanText,
  restorativeRatio,
  trialProgress,
  weeklyHobbySessions,
} from './hobbies';
import { isoDay } from './para';
import { weekOf } from './planner';
import type { WorkspaceViewProps } from './plugins/types';
import { useHobbyStore } from './useHobbyStore';
import {
  DashboardEmpty,
  DashboardGrid,
  EmptyPanel,
  ListRow,
  ListRows,
  MetricStrip,
  NextUp,
  Panel,
  QuickLinks,
  ViewShell,
  type NextAction,
} from './viewkit';

/** Sessions that constitute a completed six-session experiment. */
const TRIAL_LENGTH = 6;
/** Protected fun or recovery blocks the week is meant to hold. */
const FUN_BLOCK_TARGET = 2;
/** Anchors an active stack is meant to cover. */
const ANCHORS = ['Artifact', 'Body', 'People'] as const;

export function HobbyDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useHobbyStore();
  const week = weekOf(isoDay());
  const sessions = weeklyHobbySessions(data, week[0], week[6]);
  const fun = sessions.filter((session) => session.funActivityId && session.blockId);
  const people = peopleYouCanText(data);
  const active = data.hobbies.filter((item) => item.status === 'Active' || item.status === 'Trial');
  const queued = data.hobbies.filter((item) => item.status === 'Queued');
  const restorative = restorativeRatio(data, sessions);
  const artifacts = [...data.artifacts].sort((a, b) => b.date.localeCompare(a.date));
  const laneTitle = (id?: string) => data.hobbies.find((item) => item.id === id)?.title;
  const funTitle = (id?: string) => data.funMenu.find((item) => item.id === id)?.title;

  if (data.hobbies.length === 0) {
    return (
      <ViewShell
        title="Hobbies"
        icon={Compass}
        subtitle="Anchors, six-session experiments, artifacts shipped, and protected fun."
      >
        <DashboardEmpty
          icon={Compass}
          title="No hobby lanes yet"
          description="Add a lane in the stack to start tracking anchors, experiments and the artifacts they produce."
          action={
            <Button size="sm" onClick={() => navigateView('hobby-stack')}>
              Open the stack
            </Button>
          }
        />
      </ViewShell>
    );
  }

  /**
   * The lead: concrete next steps, most committed first. A lane's own
   * `nextAction` is the strongest signal, then the structural gaps.
   */
  const nextActions: NextAction[] = [];

  active
    .filter((lane) => lane.nextAction.trim())
    .slice(0, 3)
    .forEach((lane) => {
      const done = completedSessions(data, lane.id);
      const remaining = TRIAL_LENGTH - done;
      nextActions.push({
        id: `lane-${lane.id}`,
        title: lane.nextAction,
        context: `${lane.title}${remaining > 0 ? ` · ${remaining} session${remaining === 1 ? '' : 's'} to go` : ' · ready for session seven'}`,
        onOpen: () => navigateView('hobby-stack'),
      });
    });

  if (fun.length < FUN_BLOCK_TARGET) {
    const missing = FUN_BLOCK_TARGET - fun.length;
    nextActions.push({
      id: 'fun',
      title: `Protect ${missing} more fun or recovery block${missing === 1 ? '' : 's'} this week`,
      context: `${fun.length} of ${FUN_BLOCK_TARGET} booked`,
      tone: 'warning',
      onOpen: () => navigateView('hobby-fun'),
    });
  }

  const uncovered = ANCHORS.filter((anchor) => !active.some((lane) => lane.anchor === anchor));
  if (uncovered.length > 0) {
    nextActions.push({
      id: 'anchors',
      title: `Choose a lane that anchors ${uncovered.map((a) => a.toLowerCase()).join(' and ')}`,
      context: 'Every active stack should cover artifact, body and people',
      tone: 'warning',
      onOpen: () => navigateView('hobby-stack'),
    });
  }

  const driftingLanes = active.filter((lane) => !lane.nextAction.trim());
  if (driftingLanes.length > 0) {
    nextActions.push({
      id: 'drift',
      title: `Pick the next step for ${driftingLanes.length} lane${driftingLanes.length === 1 ? '' : 's'}`,
      context: driftingLanes.map((lane) => lane.title).join(', '),
      tone: 'warning',
      onOpen: () => navigateView('hobby-stack'),
    });
  }

  const nextTrials = active.filter((lane) => completedSessions(data, lane.id) < TRIAL_LENGTH);
  const recentSessions = [...data.sessions]
    .filter((item) => item.status === 'Done')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <ViewShell
      title="Hobbies"
      icon={Compass}
      subtitle="Anchors, six-session experiments, artifacts shipped, and protected fun."
      bodyClassName="space-y-6 p-5"
    >
      <div className="max-w-3xl space-y-4">
        <NextUp
          actions={nextActions.slice(0, 5)}
          emptyMessage="Every lane has a next step and the week's fun blocks are protected."
        />
        <MetricStrip
          stats={[
            { label: 'active', value: active.length, onOpen: () => navigateView('hobby-stack') },
            { label: 'queued', value: queued.length, onOpen: () => navigateView('hobby-stack') },
            { label: 'sessions this week', value: sessions.length, onOpen: () => navigateView('hobby-practice') },
            { label: 'shipped', value: data.artifacts.length, onOpen: () => navigateView('hobby-practice') },
            {
              label: 'restorative',
              value: `${Math.round(restorative * 100)}%`,
              tone: sessions.length > 0 && restorative < 0.5 ? 'warning' : undefined,
            },
            { label: 'people', value: people.length },
          ]}
        />
        <QuickLinks
          links={[
            { label: 'Recent sessions', onOpen: () => navigateView('hobby-practice') },
            { label: 'Artifacts', onOpen: () => navigateView('hobby-practice') },
            { label: 'Stack', onOpen: () => navigateView('hobby-stack') },
            { label: 'Fun menu', onOpen: () => navigateView('hobby-fun') },
          ]}
        />
      </div>

      <DashboardGrid>
        <Panel title="Six-session experiments" icon={TrendingUp} className="xl:col-span-2">
          {nextTrials.length === 0 ? (
            <EmptyPanel
              icon={TrendingUp}
              title="Every experiment has run its six"
              description="Start a new lane, or move a finished experiment to session seven."
            />
          ) : (
            <div className="space-y-3">
              {nextTrials.slice(0, 6).map((lane) => {
                const done = completedSessions(data, lane.id);
                return (
                  <div key={lane.id}>
                    <div className="mb-1.5 flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{lane.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {done}/{TRIAL_LENGTH}
                      </span>
                    </div>
                    <Progress value={trialProgress(data, lane.id)} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Artifacts" icon={PackageCheck} bodyClassName="px-0 pb-2">
          {artifacts.length === 0 ? (
            <EmptyPanel
              icon={PackageCheck}
              title="Nothing shipped yet"
              description="Log a track, module, meal, note or photo."
            />
          ) : (
            <ListRows>
              {artifacts.slice(0, 5).map((artifact) => (
                <ListRow
                  key={artifact.id}
                  title={artifact.title}
                  detail={laneTitle(artifact.hobbyId)}
                  meta={<Badge variant="outline">{artifact.type || 'Artifact'}</Badge>}
                  onOpen={() => navigateView('hobby-practice')}
                />
              ))}
            </ListRows>
          )}
        </Panel>

        <Panel title="Recent sessions" icon={History} bodyClassName="px-0 pb-2" className="xl:col-span-3">
          {recentSessions.length === 0 ? (
            <EmptyPanel
              icon={History}
              title="Nothing logged yet"
              description="Log a session to start building the record this page reads from."
            />
          ) : (
            <ListRows>
              {recentSessions.map((item) => (
                <ListRow
                  key={item.id}
                  title={laneTitle(item.hobbyId) ?? funTitle(item.funActivityId) ?? 'Session'}
                  detail={[item.notes, item.people.length ? `with ${item.people.join(', ')}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                  meta={
                    <>
                      <span className="font-mono">{item.date}</span>
                      <span className="font-mono">{item.durationMinutes}m</span>
                    </>
                  }
                  onOpen={() => navigateView('hobby-practice')}
                />
              ))}
            </ListRows>
          )}
        </Panel>
      </DashboardGrid>
    </ViewShell>
  );
}

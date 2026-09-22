import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';
import { Button, Progress } from '@/ui';
import {
  EmptyPanel,
  ListRow,
  ListRows,
  Metric,
  MetricRow,
  Panel,
  StatusBadge,
  ViewShell,
} from './viewkit';
import type { WorkspaceViewProps } from './plugins/types';
import { nodeProgress, studyMinutesBetween, upcomingAssignments } from './education';
import { isoDate, weekOf } from './planner';
import { useEducationStore } from './useEducationStore';

const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export function EducationDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useEducationStore();
  const today = isoDate(new Date());
  const week = weekOf(today);
  const active = data.nodes.filter((node) => !node.parentId && node.status === 'Active');
  const upcoming = upcomingAssignments(data, today);
  const overdue = data.assignments.filter(
    (assignment) =>
      assignment.dueDate && assignment.dueDate < today && !['Submitted', 'Graded'].includes(assignment.status),
  );
  const plannedSessions = data.sessions
    .filter((session) => session.date >= week[0] && session.date <= week[6] && session.status === 'Planned')
    .sort((a, b) => a.date.localeCompare(b.date));
  const minutes = studyMinutesBetween(data, week[0], week[6]);
  const nodeTitle = (id: string) => data.nodes.find((node) => node.id === id)?.title ?? 'Missing course';

  return (
    <ViewShell
      title="Education overview"
      icon={GraduationCap}
      subtitle="Commitments, workload, deadlines, and learning progress."
      bodyClassName="space-y-4 p-4"
    >
      {data.nodes.length === 0 ? (
        <EmptyPanel
          icon={GraduationCap}
          size="page"
          title="Education system is empty"
          description="Create a program or course in Learning Core to begin."
          action={
            <Button size="sm" onClick={() => navigateView('education-core')}>
              Open Learning Core
            </Button>
          }
        />
      ) : (
        <>
          <MetricRow>
            <Metric icon={BookOpenCheck} label="Active programs" value={active.length} />
            <Metric icon={CalendarClock} label="Study this week" value={duration(minutes)} detail={`${week[0]} → ${week[6]}`} />
            <Metric icon={ClipboardCheck} label="Upcoming work" value={upcoming.length} />
            <Metric
              icon={AlertTriangle}
              label="Overdue"
              value={overdue.length}
              tone={overdue.length > 0 ? 'danger' : 'default'}
            />
          </MetricRow>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel
              title="Active learning"
              icon={BookOpenCheck}
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigateView('education-core')}>
                  Manage
                </Button>
              }
            >
              {active.length === 0 ? (
                <EmptyPanel
                  title="Nothing is marked Active"
                  description="Set a program or course to Active to track it here."
                  action={
                    <Button size="sm" variant="outline" onClick={() => navigateView('education-core')}>
                      Open Learning Core
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {active.map((node) => {
                    const progress = nodeProgress(data, node.id);
                    return (
                      <li key={node.id} className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2 text-[13px]">
                          <span className="min-w-0 flex-1 truncate font-medium">{node.title}</span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="mt-1 h-1.5" />
                        {node.targetDate && (
                          <p className="mt-1 text-xxs text-muted-foreground">Target {node.targetDate}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title="Upcoming assignments"
              icon={ClipboardCheck}
              bodyClassName="p-0"
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigateView('education-assignments')}>
                  Open assignments
                </Button>
              }
            >
              {upcoming.length === 0 ? (
                <EmptyPanel title="No upcoming deadlines" description="Nothing is due after today." />
              ) : (
                <ListRows>
                  {upcoming.map((assignment) => (
                    <ListRow
                      key={assignment.id}
                      title={assignment.title}
                      detail={`${nodeTitle(assignment.nodeId)} · ${assignment.type}`}
                      meta={
                        <>
                          <StatusBadge status={assignment.status} completedStatuses={['Graded']} />
                          <span className="font-mono">{assignment.dueDate}</span>
                        </>
                      }
                    />
                  ))}
                </ListRows>
              )}
            </Panel>

            {overdue.length > 0 && (
              <Panel
                title="Overdue work"
                icon={AlertTriangle}
                description="Past its due date and not yet submitted."
                bodyClassName="p-0"
                actions={
                  <Button size="sm" variant="ghost" onClick={() => navigateView('education-assignments')}>
                    Open assignments
                  </Button>
                }
              >
                <ListRows>
                  {overdue
                    .slice()
                    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
                    .map((assignment) => (
                      <ListRow
                        key={assignment.id}
                        title={assignment.title}
                        detail={`${nodeTitle(assignment.nodeId)} · ${assignment.type}`}
                        meta={
                          <>
                            <StatusBadge status="Overdue" />
                            <span className="font-mono">{assignment.dueDate}</span>
                          </>
                        }
                      />
                    ))}
                </ListRows>
              </Panel>
            )}

            <Panel
              title="Planned study this week"
              icon={CalendarClock}
              bodyClassName="p-0"
              className={overdue.length > 0 ? undefined : 'xl:col-span-2'}
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigateView('education-study')}>
                  Open planner
                </Button>
              }
            >
              {plannedSessions.length === 0 ? (
                <EmptyPanel
                  title="No study sessions planned this week"
                  description="Block time for the courses you are actually taking."
                  action={
                    <Button size="sm" variant="outline" onClick={() => navigateView('education-study')}>
                      Open planner
                    </Button>
                  }
                />
              ) : (
                <ListRows>
                  {plannedSessions.map((session) => (
                    <ListRow
                      key={session.id}
                      title={nodeTitle(session.nodeId)}
                      detail={session.notes}
                      meta={
                        <>
                          <span className="font-mono">{session.date}</span>
                          <span>{session.durationMinutes} min</span>
                        </>
                      }
                    />
                  ))}
                </ListRows>
              )}
            </Panel>
          </div>
        </>
      )}
    </ViewShell>
  );
}

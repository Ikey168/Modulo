import { dayKey } from './noteDates';
import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Dumbbell,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Repeat2,
  Target,
  Utensils,
} from 'lucide-react';
import { Badge, Button, Progress } from '@/ui';
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
import { DAY_BLOCKS } from './dayBlocks';
import { buildLifeCommandCenter, type LifeCommandCenterItem } from './lifeCommandCenter';
import { LIFE_PLUGIN_CONFIGS } from './lifeConfigs';
import { DOMAIN_COLLECTION_CONFIGS } from './domainConfigs';
import { emptyLifeCollection } from './lifeStore';
import { progressPercent } from './mediaLibrary';
import { isoDay, reviewSignals } from './para';
import {
  MEAL_PLANNER_PLUGIN_ID,
  MEDIA_LIBRARY_PLUGIN_ID,
  ROUTINES_PLUGIN_ID,
  WORKOUT_PLANNER_PLUGIN_ID,
} from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import type { WorkspaceViewProps } from './plugins/types';
import { useLifeCollections } from './useLifeCollection';
import { useParaStore } from './useParaStore';
import { useRoutinesStore } from './useRoutinesStore';
import { useMealPlannerStore, useMediaLibraryStore, useWorkoutPlannerStore } from './usePluginDataStores';


export function ParaDashboardView({ navigateView }: WorkspaceViewProps) {
  const [data] = useParaStore();
  const [routineData] = useRoutinesStore();
  const { isEnabled } = usePlugins();
  const today = isoDay();

  const enabledLifeConfigs = useMemo(
    () => [...LIFE_PLUGIN_CONFIGS, ...DOMAIN_COLLECTION_CONFIGS].filter((config) => isEnabled(config.id)),
    [isEnabled],
  );
  const lifeCollections = useLifeCollections(enabledLifeConfigs.map((config) => config.id));
  const mealsEnabled = isEnabled(MEAL_PLANNER_PLUGIN_ID);
  const mediaEnabled = isEnabled(MEDIA_LIBRARY_PLUGIN_ID);
  const workoutsEnabled = isEnabled(WORKOUT_PLANNER_PLUGIN_ID);
  const routinesEnabled = isEnabled(ROUTINES_PLUGIN_ID);

  const [mealData] = useMealPlannerStore();
  const [mediaData] = useMediaLibraryStore(mediaEnabled);
  const [workoutData] = useWorkoutPlannerStore();
  const meals = mealsEnabled ? mealData : undefined;
  const media = mediaEnabled ? mediaData : undefined;
  const workouts = workoutsEnabled ? workoutData : undefined;
  const activeMedia = useMemo(
    () => (media?.items ?? []).filter((item) => item.status === 'Active'),
    [media],
  );

  const life = useMemo(
    () =>
      buildLifeCommandCenter({
        today,
        routines: routinesEnabled ? routineData : undefined,
        meals,
        workouts,
        collections: enabledLifeConfigs.map((config) => ({
          config,
          data: lifeCollections[config.id] ?? emptyLifeCollection(),
        })),
      }),
    [today, routinesEnabled, routineData, meals, workouts, enabledLifeConfigs, lifeCollections],
  );

  const activeProjects = data.projects.filter((project) => !project.archivedAt && project.status === 'Active');
  const next = data.tasks.filter((task) => !task.archivedAt && task.status === 'Next');
  const todayTasks = data.tasks.filter(
    (task) =>
      !task.archivedAt &&
      task.status !== 'Done' &&
      (task.doDate === today || Boolean(task.deadline && task.deadline <= today)),
  );
  const goals = data.goals.filter((goal) => !goal.archivedAt && goal.status === 'Active');
  const signals = reviewSignals(data);
  const rhythmTotal = life.habits.total + life.routines.total;
  const rhythmDone = life.habits.done + life.routines.done;
  const openLifeToday = life.today.filter((item) => !item.done).length;
  const lifeModuleCount =
    enabledLifeConfigs.length +
    Number(mealsEnabled) +
    Number(workoutsEnabled) +
    Number(routinesEnabled) +
    Number(mediaEnabled);

  const openView = (view: string, label = 'Open') => (
    <Button size="sm" variant="ghost" onClick={() => navigateView(view)}>
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );

  return (
    <ViewShell
      title="PARA overview"
      icon={LayoutDashboard}
      subtitle="PARA direction and daily life, projected from the plugins that own the data."
      bodyClassName="space-y-5 p-4"
    >
      <MetricRow className="xl:grid-cols-5">
        <Metric
          label="Open today"
          value={todayTasks.length + openLifeToday}
          detail={`${todayTasks.length} PARA · ${openLifeToday} life`}
        />
        <Metric
          label="Daily rhythm"
          value={rhythmTotal ? `${rhythmDone}/${rhythmTotal}` : '—'}
          detail="routines and habits"
        />
        <Metric
          label="Next 7 days"
          value={life.upcoming.filter((item) => !item.done).length}
          detail="life commitments"
        />
        <Metric
          label="Time-sensitive"
          value={life.alerts.length}
          detail="food, returns, warranties"
          tone={life.alerts.length > 0 ? 'warning' : 'default'}
        />
        <Metric label="Active projects" value={activeProjects.length} detail={`${lifeModuleCount} life modules`} />
      </MetricRow>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Today</h3>
          <p className="text-xs text-muted-foreground">
            One operational view across PARA and your enabled Life plugins. Rows are a summary — open the owning view to
            act on a record.
          </p>
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Today's agenda"
            icon={CalendarDays}
            actions={openView('planner', 'Planner')}
            bodyClassName="p-0"
          >
            {todayTasks.length === 0 && life.today.length === 0 ? (
              <HealthList>
                <HealthLine okay>Nothing scheduled for today.</HealthLine>
              </HealthList>
            ) : (
              <>
                <ListRows>
                  {todayTasks.slice(0, 6).map((task) => {
                    const overdue = Boolean(task.deadline && task.deadline < today);
                    return (
                      <ListRow
                        key={task.id}
                        title={task.title}
                        leading={<Circle className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                        detail={`PARA task${task.doDate ? ` · do ${task.doDate}` : ''}`}
                        meta={
                          task.deadline && (
                            <Badge variant={overdue ? 'destructive' : 'outline'}>
                              {overdue ? 'Overdue' : `Due ${task.deadline}`}
                            </Badge>
                          )
                        }
                      />
                    );
                  })}
                  {life.today.slice(0, 10).map((item) => (
                    <LifeRow key={item.id} item={item} today={today} />
                  ))}
                </ListRows>
                {todayTasks.length + life.today.length > 16 && (
                  <More count={todayTasks.length + life.today.length - 16} />
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Routines & habits"
            icon={Repeat2}
            actions={routinesEnabled ? openView('routines-habits') : undefined}
          >
            {!routinesEnabled ? (
              <EmptyPanel
                icon={Repeat2}
                title="Routines are off"
                description="Enable Routines & Habits to add your daily rhythm."
              />
            ) : rhythmTotal === 0 ? (
              <EmptyPanel
                icon={Repeat2}
                title="Nothing scheduled today"
                description="No routines or habits fall on today's schedule."
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>Today's rhythm</span>
                    <span className="tabular-nums">
                      {rhythmDone}/{rhythmTotal}
                    </span>
                  </div>
                  <Progress value={rhythmTotal ? (rhythmDone / rhythmTotal) * 100 : 0} className="h-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Routines" value={`${life.routines.done}/${life.routines.total}`} />
                  <Metric label="Habits" value={`${life.habits.done}/${life.habits.total}`} />
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Food & movement"
            icon={Utensils}
            actions={
              <>
                {mealsEnabled && openView('meal-planner', 'Meals')}
                {workoutsEnabled && openView('workout-planner', 'Workouts')}
              </>
            }
          >
            {!mealsEnabled && !workoutsEnabled ? (
              <EmptyPanel
                icon={Utensils}
                title="No food or movement module"
                description="Enable Meals or Workouts to see today's plan."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Meals"
                  icon={Utensils}
                  value={mealsEnabled ? `${life.meals.done}/${life.meals.total}` : '—'}
                  detail={mealsEnabled ? 'complete today' : 'module disabled'}
                />
                <Metric
                  label="Workouts"
                  icon={Dumbbell}
                  value={workoutsEnabled ? `${life.workouts.done}/${life.workouts.total}` : '—'}
                  detail={workoutsEnabled ? 'complete today' : 'module disabled'}
                />
              </div>
            )}
          </Panel>

          <Panel
            title="Current media"
            icon={BookOpen}
            actions={mediaEnabled ? openView('media-library') : undefined}
            bodyClassName={mediaEnabled && activeMedia.length > 0 ? 'p-0' : undefined}
          >
            {!mediaEnabled ? (
              <EmptyPanel
                icon={BookOpen}
                title="Media Library is off"
                description="Enable Media Library to see what is in progress."
              />
            ) : activeMedia.length === 0 ? (
              <EmptyPanel icon={BookOpen} title="Nothing in progress" description="No media is currently active." />
            ) : (
              <>
                <ListRows>
                  {activeMedia.slice(0, 5).map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      detail={
                        <span className="flex items-center gap-2">
                          <span>{item.type}</span>
                          <Progress value={progressPercent(item)} className="h-1 w-24" />
                          <span className="tabular-nums">{progressPercent(item)}%</span>
                        </span>
                      }
                    />
                  ))}
                </ListRows>
                {activeMedia.length > 5 && <More count={activeMedia.length - 5} />}
              </>
            )}
          </Panel>

          <Panel
            title="Next 7 days"
            icon={Clock3}
            actions={openView('calendar', 'Calendar')}
            bodyClassName={life.upcoming.length > 0 ? 'p-0' : undefined}
          >
            {life.upcoming.length === 0 ? (
              <HealthList>
                <HealthLine okay>No upcoming Life commitments.</HealthLine>
              </HealthList>
            ) : (
              <>
                <ListRows>
                  {life.upcoming.slice(0, 7).map((item) => (
                    <LifeRow key={item.id} item={item} today={today} />
                  ))}
                </ListRows>
                {life.upcoming.length > 7 && <More count={life.upcoming.length - 7} />}
              </>
            )}
          </Panel>

          <Panel
            title="Time-sensitive"
            icon={AlertTriangle}
            bodyClassName={life.alerts.length > 0 ? 'p-0' : undefined}
          >
            {life.alerts.length === 0 ? (
              <HealthList>
                <HealthLine okay>No food, return, or warranty deadlines nearby.</HealthLine>
              </HealthList>
            ) : (
              <>
                <ListRows>
                  {life.alerts.slice(0, 7).map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      leading={<AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />}
                      detail={`${item.kind} · ${item.source}`}
                      meta={
                        <Badge variant={item.date < today ? 'destructive' : 'warning'}>
                          {dateLabel(item.date, today)}
                        </Badge>
                      }
                    />
                  ))}
                </ListRows>
                {life.alerts.length > 7 && <More count={life.alerts.length - 7} />}
              </>
            )}
          </Panel>
        </div>
      </section>

      {lifeModuleCount > 0 && (
        <Panel title="Life modules" icon={ArrowRight} description="Jump to the plugin that owns the data.">
          <div className="flex flex-wrap gap-2">
            {routinesEnabled && (
              <ModuleButton label="Routines" icon={Repeat2} onClick={() => navigateView('routines-habits')} />
            )}
            {mealsEnabled && <ModuleButton label="Meals" icon={Utensils} onClick={() => navigateView('meal-planner')} />}
            {workoutsEnabled && (
              <ModuleButton label="Workouts" icon={Dumbbell} onClick={() => navigateView('workout-planner')} />
            )}
            {mediaEnabled && <ModuleButton label="Media" icon={BookOpen} onClick={() => navigateView('media-library')} />}
            {enabledLifeConfigs.map((config) => (
              <ModuleButton
                key={config.id}
                label={config.title}
                icon={config.icon}
                onClick={() => navigateView(config.id)}
              />
            ))}
          </div>
        </Panel>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">PARA system</h3>
          <p className="text-xs text-muted-foreground">Commitments, direction, capture, and review health.</p>
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Panel
            title="Due and do today"
            icon={ListTodo}
            actions={openView('para-tasks')}
            bodyClassName={todayTasks.length > 0 ? 'p-0' : undefined}
          >
            {todayTasks.length === 0 ? (
              <HealthList>
                <HealthLine okay>Nothing urgent today.</HealthLine>
              </HealthList>
            ) : (
              <ListRows>
                {todayTasks.slice(0, 8).map((task) => {
                  const overdue = Boolean(task.deadline && task.deadline < today);
                  return (
                    <ListRow
                      key={task.id}
                      title={task.title}
                      detail={task.doDate ? `Do ${task.doDate}` : 'No do date'}
                      meta={
                        task.deadline && (
                          <Badge variant={overdue ? 'destructive' : 'outline'}>
                            {overdue ? `Overdue ${task.deadline}` : `Due ${task.deadline}`}
                          </Badge>
                        )
                      }
                    />
                  );
                })}
              </ListRows>
            )}
          </Panel>

          <Panel
            title="Active projects"
            icon={FolderKanban}
            actions={openView('para-projects')}
            bodyClassName={activeProjects.length > 0 ? 'p-0' : undefined}
          >
            {activeProjects.length === 0 ? (
              <EmptyPanel
                icon={FolderKanban}
                title="No active projects"
                description="Nothing is currently in flight."
              />
            ) : (
              <ListRows>
                {activeProjects.map((project) => {
                  const ready = next.some((task) => task.projectId === project.id);
                  return (
                    <ListRow
                      key={project.id}
                      title={project.name}
                      meta={
                        <Badge variant={ready ? 'success' : 'warning'}>
                          {ready ? 'Next action ready' : 'Needs next action'}
                        </Badge>
                      }
                    />
                  );
                })}
              </ListRows>
            )}
          </Panel>

          <Panel title="Active goals & arcs" icon={Target} actions={openView('para-goals')}>
            {goals.length === 0 ? (
              <EmptyPanel icon={Target} title="No directional layer" description="No goals or arcs are active." />
            ) : (
              <ul className="space-y-2">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <div className="flex gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                      <span className="tabular-nums">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="mt-1 h-1" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="System health" icon={AlertTriangle} actions={openView('para-review')}>
            <HealthList>
              {signals.length === 0 ? (
                <HealthLine okay>PARA structure looks healthy.</HealthLine>
              ) : (
                signals.slice(0, 6).map((signal) => (
                  <HealthLine key={signal} okay={false}>
                    {signal}
                  </HealthLine>
                ))
              )}
            </HealthList>
          </Panel>

          <Panel title="Capture inbox" icon={Inbox} actions={openView('para-capture')}>
            <Metric
              label="Unprocessed captures"
              value={data.inbox.length}
              detail={data.inbox.length === 0 ? 'Inbox zero' : 'waiting to be routed'}
              tone={data.inbox.length > 0 ? 'warning' : 'success'}
            />
          </Panel>
        </div>
      </section>
    </ViewShell>
  );
}

function LifeRow({ item, today }: { item: LifeCommandCenterItem; today: string }) {
  const block = DAY_BLOCKS.find((candidate) => candidate.id === item.blockId);
  const detail = item.date === today ? block?.start ?? item.detail : dateLabel(item.date, today);
  return (
    <ListRow
      title={item.title}
      muted={item.done}
      leading={
        item.done ? (
          <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <Circle className="size-3.5 text-muted-foreground" aria-hidden="true" />
        )
      }
      detail={`${item.source}${detail ? ` · ${detail}` : ''}`}
    />
  );
}

function ModuleButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
      <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
    </Button>
  );
}

function More({ count }: { count: number }) {
  return <p className="px-3 py-2 text-xxs text-muted-foreground">+{count} more</p>;
}

function dateLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === dayKey(tomorrow)) return 'Tomorrow';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

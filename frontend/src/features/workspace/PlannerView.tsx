// Planner view (#370): editable Notion-compatible day blocks stored in each
// dated Markdown note, plus PARA tasks scheduled into those same blocks.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarPlus, ChevronLeft, ChevronRight, Flame, NotebookPen, Plus, Repeat2, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, cn, useToast } from '@/ui';
import { ChoiceInline } from './viewkit';
import type { WorkspaceViewProps } from './plugins/types';
import {
  DAY_BLOCKS,
  dayBlockPlanOf,
  replaceDayBlockPlan,
  type DayBlockId,
  type DayBlockPlan,
} from './dayBlocks';
import {
  addDays,
  carryOverBlock,
  dailyTemplate,
  findDailyNote,
  headlineOf,
  isoDate,
  uncheckedItems,
  weekOf,
  WEEKDAY_LABELS,
} from './planner';
import type { ParaTask } from './para';
import { hobbySessionsOn, type HobbySession } from './hobbies';
import { musicPracticeOn, type MusicPractice } from './musicStudio';
import { labEntriesOn, type LabEntry } from './electronicsWorkbench';
import { homelabRunsOn, type HomelabRun } from './homelab';
import { styleLogsOn, type StyleLog } from './wardrobe';
import { gameSessionsOn, type GameSession } from './ttrpg';
import { correspondenceOn, obligationsOn, type BusinessCorrespondence, type BusinessObligation } from './businessAdmin';
import { LIFE_PLUGIN_CONFIGS, type LifePluginConfig } from './lifeConfigs';
import { DOMAIN_COLLECTION_CONFIGS } from './domainConfigs';
import { emptyLifeCollection, lifeOccurrenceDone, lifeRecordsOn, setLifeOccurrenceDone, type LifeRecord } from './lifeStore';
import { BUSINESS_OBLIGATIONS_PLUGIN_ID, BUSINESS_OPERATIONS_PLUGIN_ID, CALENDAR_PLUGIN_ID, ELECTRONICS_LAB_PLUGIN_ID, HOBBY_PRACTICE_PLUGIN_ID, HOMELAB_OPERATIONS_PLUGIN_ID, MUSIC_PRACTICE_PLUGIN_ID, ROUTINES_PLUGIN_ID, STYLE_STUDIO_PLUGIN_ID, TTRPG_SESSIONS_PLUGIN_ID } from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import { habitCount, habitStreak, habitsOn, routineDone, routinesOn, setHabitCount, setRoutineDone } from './routines';
import { useParaStore } from './useParaStore';
import { LIFE_COLLECTION_SCHEMA, useLifeCollections } from './useLifeCollection';
import { useRoutinesStore } from './useRoutinesStore';
import { useHobbyStore } from './useHobbyStore';
import { useMusicStore } from './useMusicStore';
import { useElectronicsStore } from './useElectronicsStore';
import { useHomelabStore } from './useHomelabStore';
import { useWardrobeStore } from './useWardrobeStore';
import { useTtrpgStore } from './useTtrpgStore';
import { useBusinessAdminStore } from './useBusinessAdminStore';

const BLOCK_STYLE: Record<DayBlockId, string> = {
  sleep: 'border-l-gray-400 bg-gray-500/5',
  'morning-prime': 'border-l-orange-400 bg-orange-500/5',
  'deep-work-a': 'border-l-blue-500 bg-blue-500/5',
  'deep-work-b': 'border-l-blue-500 bg-blue-500/5',
  reset: 'border-l-green-500 bg-green-500/5',
  'ops-people': 'border-l-purple-500 bg-purple-500/5',
  'early-evening': 'border-l-yellow-400 bg-yellow-500/5',
  'wind-down': 'border-l-pink-400 bg-pink-500/5',
};

const CalendarView = lazy(() => import('./CalendarView').then((module) => ({ default: module.CalendarView })));
type PlannerLayout = 'day' | 'week' | 'month' | 'year';

export function PlannerView({ data, onOpenNote, navigateView, currentView }: WorkspaceViewProps) {
  const { toast } = useToast();
  const { isEnabled, workspaceState } = usePlugins();
  const [para, persistPara] = useParaStore();
  const [routineData, persistRoutines] = useRoutinesStore();
  const [hobbyData, persistHobbies] = useHobbyStore();
  const [musicData, persistMusic] = useMusicStore();
  const [electronicsData, persistElectronics] = useElectronicsStore();
  const [homelabData, persistHomelab] = useHomelabStore();
  const [wardrobeData, persistWardrobe] = useWardrobeStore();
  const [ttrpgData, persistTtrpg] = useTtrpgStore();
  const [businessData, persistBusiness] = useBusinessAdminStore();
  const [layout, setLayout] = useState<PlannerLayout>(() => currentView === 'calendar' ? 'month' : 'day');
  const [anchor, setAnchor] = useState(() => isoDate(new Date()));
  const [drafts, setDrafts] = useState<Partial<Record<DayBlockId, string>>>({});
  const today = isoDate(new Date());

  const selectedNote = useMemo(() => findDailyNote(data.notes, anchor), [data.notes, anchor]);
  const selectedBody = selectedNote?.markdownContent ?? selectedNote?.content ?? '';
  const blockPlan = useMemo(() => dayBlockPlanOf(selectedBody), [selectedBody]);
  const previous = addDays(anchor, -1);
  const previousNote = useMemo(() => findDailyNote(data.notes, previous), [data.notes, previous]);
  const carryable = useMemo(
    () => previousNote ? uncheckedItems(previousNote.markdownContent ?? previousNote.content ?? '') : [],
    [previousNote],
  );
  const scheduledTasks = useMemo(
    () => para.tasks.filter((task) => !task.archivedAt && task.doDate === anchor),
    [para.tasks, anchor],
  );
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const routinesEnabled = isEnabled(ROUTINES_PLUGIN_ID);
  const hobbiesEnabled = isEnabled(HOBBY_PRACTICE_PLUGIN_ID);
  const musicEnabled = isEnabled(MUSIC_PRACTICE_PLUGIN_ID);
  const electronicsEnabled = isEnabled(ELECTRONICS_LAB_PLUGIN_ID);
  const homelabEnabled = isEnabled(HOMELAB_OPERATIONS_PLUGIN_ID);
  const styleEnabled = isEnabled(STYLE_STUDIO_PLUGIN_ID);
  const ttrpgEnabled = isEnabled(TTRPG_SESSIONS_PLUGIN_ID);
  const businessEnabled = isEnabled(BUSINESS_OBLIGATIONS_PLUGIN_ID) || isEnabled(BUSINESS_OPERATIONS_PLUGIN_ID);
  const calendarEnabled = isEnabled(CALENDAR_PLUGIN_ID);
  const layoutOptions: PlannerLayout[] = calendarEnabled ? ['day', 'week', 'month', 'year'] : ['day', 'week'];
  const isCalendarLayout = layout === 'month' || layout === 'year';
  const enabledLifeConfigs = [...LIFE_PLUGIN_CONFIGS, ...DOMAIN_COLLECTION_CONFIGS].filter((config) => config.schedule && isEnabled(config.id));
  const lifeCollections = useLifeCollections(enabledLifeConfigs.map((config) => config.id));
  const dailyRoutines = useMemo(() => routinesEnabled ? routinesOn(routineData, anchor) : [], [routineData, anchor, routinesEnabled]);
  const dailyHabits = useMemo(() => routinesEnabled ? habitsOn(routineData, anchor) : [], [routineData, anchor, routinesEnabled]);
  const dailyHobbies = useMemo(() => hobbiesEnabled ? hobbySessionsOn(hobbyData, anchor) : [], [hobbyData, anchor, hobbiesEnabled]);
  const dailyMusic = useMemo(() => musicEnabled ? musicPracticeOn(musicData, anchor) : [], [musicData, anchor, musicEnabled]);
  const dailyElectronics = useMemo(() => electronicsEnabled ? labEntriesOn(electronicsData, anchor) : [], [electronicsData, anchor, electronicsEnabled]);
  const dailyHomelab = useMemo(() => homelabEnabled ? homelabRunsOn(homelabData, anchor) : [], [homelabData, anchor, homelabEnabled]);
  const dailyStyle = useMemo(() => styleEnabled ? styleLogsOn(wardrobeData, anchor) : [], [wardrobeData, anchor, styleEnabled]);
  const dailyTtrpg = useMemo(() => ttrpgEnabled ? gameSessionsOn(ttrpgData, anchor) : [], [ttrpgData, anchor, ttrpgEnabled]);
  const dailyObligations = useMemo(() => businessEnabled ? obligationsOn(businessData, anchor) : [], [businessData, anchor, businessEnabled]);
  const dailyCorrespondence = useMemo(() => businessEnabled ? correspondenceOn(businessData, anchor) : [], [businessData, anchor, businessEnabled]);
  const dailyLifeRecords = enabledLifeConfigs.flatMap((config) => lifeRecordsOn(lifeCollections[config.id] ?? emptyLifeCollection(), anchor).map((record) => ({ config, record })));

  const ensureNote = async (date: string) => findDailyNote(data.notes, date) ?? data.createNote(date, dailyTemplate(date));

  const openOrCreate = async (date: string) => {
    const note = await ensureNote(date);
    if (note) onOpenNote(note.id);
  };

  const saveBlockPlan = async (nextPlan: DayBlockPlan) => {
    const note = await ensureNote(anchor);
    if (!note) return;
    const body = note.markdownContent ?? note.content ?? dailyTemplate(anchor);
    const next = replaceDayBlockPlan(body, nextPlan);
    await data.updateNote(note.id, { content: next, markdownContent: next });
  };

  const updateBlock = (blockId: DayBlockId, update: (items: DayBlockPlan[DayBlockId]) => DayBlockPlan[DayBlockId]) => {
    const next = { ...blockPlan, [blockId]: update([...blockPlan[blockId]]) };
    void saveBlockPlan(next);
  };

  const addBlockItem = (blockId: DayBlockId) => {
    const text = drafts[blockId]?.trim();
    if (!text) return;
    updateBlock(blockId, (items) => [...items, { text, done: false }]);
    setDrafts((current) => ({ ...current, [blockId]: '' }));
  };

  const patchTask = (id: string, update: Partial<ParaTask>) => {
    persistPara((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, ...update } : task),
    }));
  };

  const setLifeDone = (config: LifePluginConfig, record: LifeRecord, done: boolean) => {
    const current = lifeCollections[config.id] ?? emptyLifeCollection();
    const next = setLifeOccurrenceDone(current, record.id, anchor, done);
    void workspaceState('life-collections')
      .then(client => client.set(config.id, JSON.parse(JSON.stringify(next)), LIFE_COLLECTION_SCHEMA, 1))
      .catch(reason => toast({
        variant: 'destructive',
        title: 'Could not save planner item',
        description: reason instanceof Error ? reason.message : String(reason),
      }));
  };

  const patchHobbySession = (id: string, update: Partial<HobbySession>) => persistHobbies((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, ...update } : session) }));
  const patchMusicPractice = (id: string, update: Partial<MusicPractice>) => persistMusic((current) => ({ ...current, practice: current.practice.map((session) => session.id === id ? { ...session, ...update } : session) }));
  const patchLabEntry = (id: string, update: Partial<LabEntry>) => persistElectronics((current) => ({ ...current, lab: current.lab.map((entry) => entry.id === id ? { ...entry, ...update } : entry) }));
  const patchHomelabRun = (id: string, update: Partial<HomelabRun>) => persistHomelab((current) => ({ ...current, runs: current.runs.map((run) => run.id === id ? { ...run, ...update } : run) }));
  const patchStyleLog = (id: string, update: Partial<StyleLog>) => persistWardrobe((current) => ({ ...current, logs: current.logs.map((log) => log.id === id ? { ...log, ...update } : log) }));
  const patchTtrpgSession = (id: string, update: Partial<GameSession>) => persistTtrpg((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, ...update } : session) }));
  const patchBusinessObligation = (id: string, update: Partial<BusinessObligation>) => persistBusiness((current) => ({ ...current, obligations: current.obligations.map((item) => item.id === id ? { ...item, ...update } : item) }));
  const patchBusinessCorrespondence = (id: string, update: Partial<BusinessCorrespondence>) => persistBusiness((current) => ({ ...current, correspondence: current.correspondence.map((item) => item.id === id ? { ...item, ...update } : item) }));

  const carryOver = async () => {
    if (carryable.length === 0) return;
    const target = await ensureNote(anchor);
    if (!target) return;
    const body = target.markdownContent ?? target.content ?? dailyTemplate(anchor);
    const next = `${body.trimEnd()}\n${carryOverBlock(carryable, previous)}`;
    await data.updateNote(target.id, { content: next, markdownContent: next });
    toast({
      title: `${carryable.length} item${carryable.length === 1 ? '' : 's'} carried over`,
      description: `From ${previous} into ${anchor}.`,
    });
  };

  const selectedUnchecked = selectedNote ? uncheckedItems(selectedBody) : [];
  const unassignedTasks = scheduledTasks.filter((task) => !task.blockId);

  useEffect(() => {
    if (currentView === 'calendar' && calendarEnabled) setLayout('month');
    if (!calendarEnabled && isCalendarLayout) setLayout('day');
  }, [calendarEnabled, currentView]); // eslint-disable-line react-hooks/exhaustive-deps -- switching calendar modes must not retrigger this route-sync effect

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col', isCalendarLayout ? 'overflow-hidden' : 'overflow-y-auto')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Planner &amp; Calendar</h2>
        <div className="flex rounded-md border border-border p-0.5">
          {layoutOptions.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={layout === view}
              onClick={() => setLayout(view)}
              className={cn(
                'rounded px-2.5 py-0.5 text-xs capitalize',
                layout === view ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {view}
            </button>
          ))}
        </div>
        {!isCalendarLayout && anchor !== today && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAnchor(today)}>Today</Button>}
        {!isCalendarLayout && (
          <Button size="sm" className={anchor === today ? 'ml-auto' : undefined} onClick={() => void openOrCreate(anchor)}>
            <NotebookPen className="size-4" aria-hidden="true" />
            {selectedNote ? 'Open day note' : 'Create day note'}
          </Button>
        )}
      </div>

      {isCalendarLayout ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted-foreground">Loading calendar…</div>}>
          <CalendarView
            data={data}
            onOpenNote={onOpenNote}
            layout={layout}
            onLayoutChange={setLayout}
            anchor={anchor}
            onAnchorChange={setAnchor}
            embedded
          />
        </Suspense>
      ) : layout === 'day' ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => setAnchor(addDays(anchor, -1))}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="font-mono text-sm font-medium">{anchor}</span>
            {anchor === today && <span className="text-xs text-muted-foreground">Today</span>}
            {selectedUnchecked.length > 0 && <span className="text-xs text-muted-foreground">· {selectedUnchecked.length} open outside blocks</span>}
            <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => setAnchor(addDays(anchor, 1))}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {DAY_BLOCKS.map((block) => {
              const paraTasks = scheduledTasks.filter((task) => task.blockId === block.id);
              const routines = dailyRoutines.filter((routine) => routine.blockId === block.id);
              const habits = dailyHabits.filter((habit) => habit.blockId === block.id);
              const lifeRecords = dailyLifeRecords.filter(({ record }) => record.blockId === block.id);
              const hobbySessions = dailyHobbies.filter((session) => session.blockId === block.id);
              const musicSessions = dailyMusic.filter((session) => session.blockId === block.id);
              const electronicsEntries = dailyElectronics.filter((entry) => entry.blockId === block.id);
              const homelabRuns = dailyHomelab.filter((run) => run.blockId === block.id);
              const styleLogs = dailyStyle.filter((log) => log.blockId === block.id);
              const gameSessions = dailyTtrpg.filter((session) => session.blockId === block.id);
              const businessObligations = dailyObligations.filter((item) => item.blockId === block.id);
              const businessCorrespondence = dailyCorrespondence.filter((item) => item.blockId === block.id);
              return (
                <section key={block.id} className={cn('rounded-md border border-l-4 border-border', BLOCK_STYLE[block.id])}>
                  <header className="border-b border-border/70 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <h3 className="text-sm font-medium">{block.label}</h3>
                      <span className="font-mono text-xs text-muted-foreground">{block.start}–{block.end}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{block.taskTypes}</p>
                  </header>

                  <div className="flex flex-col gap-1.5 p-3">
                    {blockPlan[block.id].map((item, index) => (
                      <div key={`${item.text}-${index}`} className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={item.done}
                          aria-label={`Mark ${item.text} ${item.done ? 'open' : 'done'}`}
                          onCheckedChange={(checked) => updateBlock(block.id, (items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: checked === true } : entry))}
                        />
                        <span className={cn('min-w-0 flex-1 truncate text-sm', item.done && 'text-muted-foreground line-through')}>{item.text}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Delete ${item.text}`}
                          onClick={() => updateBlock(block.id, (items) => items.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}

                    {paraTasks.map((task) => (
                      <div key={task.id} className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={task.status === 'Done'}
                          aria-label={`Mark ${task.title} ${task.status === 'Done' ? 'open' : 'done'}`}
                          onCheckedChange={(checked) => patchTask(task.id, { status: checked === true ? 'Done' : 'Next' })}
                        />
                        <span className={cn('min-w-0 flex-1 truncate text-sm', task.status === 'Done' && 'text-muted-foreground line-through')}>{task.title}</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xxs text-primary">PARA</span>
                      </div>
                    ))}

                    {routines.map((routine) => {
                      const done = routineDone(routineData, routine.id, anchor);
                      return (
                        <div key={routine.id} className="flex min-w-0 items-center gap-2">
                          <Checkbox checked={done} aria-label={`Mark ${routine.title} ${done ? 'open' : 'done'}`} onCheckedChange={(checked) => persistRoutines((current) => setRoutineDone(current, routine.id, anchor, checked === true))} />
                          <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{routine.title}</span>
                          {routine.durationMinutes && <span className="text-xxs text-muted-foreground">{routine.durationMinutes} min</span>}
                          <span className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-xxs text-purple-500"><Repeat2 className="size-3" />Routine</span>
                        </div>
                      );
                    })}

                    {habits.map((habit) => {
                      const count = habitCount(routineData, habit.id, anchor);
                      const done = count >= habit.target;
                      const streak = habitStreak(routineData, habit, anchor);
                      return (
                        <div key={habit.id} className="flex min-w-0 items-center gap-2">
                          <Checkbox checked={done} aria-label={`Mark ${habit.title} ${done ? 'open' : 'done'}`} onCheckedChange={(checked) => persistRoutines((current) => setHabitCount(current, habit.id, anchor, checked === true ? habit.target : 0))} />
                          <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{habit.title}</span>
                          <span className="text-xxs text-muted-foreground">{count}/{habit.target}{habit.unit ? ` ${habit.unit}` : ''}</span>
                          {streak > 0 && <span className="flex items-center gap-0.5 text-xxs text-warning"><Flame className="size-3" />{streak}</span>}
                          {!done && <Button size="icon-sm" variant="ghost" aria-label={`Add one ${habit.unit ?? 'check-in'} for ${habit.title}`} onClick={() => persistRoutines((current) => setHabitCount(current, habit.id, anchor, count + 1))}><Plus className="size-3.5" /></Button>}
                          <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xxs text-warning">Habit</span>
                        </div>
                      );
                    })}

                    {lifeRecords.map(({ config, record }) => {
                      const done = lifeOccurrenceDone(lifeCollections[config.id] ?? emptyLifeCollection(), record.id, anchor);
                      return (
                        <div key={`${config.id}-${record.id}`} className="flex min-w-0 items-center gap-2">
                          <Checkbox checked={done} aria-label={`Mark ${record.title} ${done ? 'open' : 'done'}`} onCheckedChange={(checked) => setLifeDone(config, record, checked === true)} />
                          <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{record.title}</span>
                          {record.recurrence !== 'Once' && <span className="text-xxs text-muted-foreground">{record.recurrence}</span>}
                          <button type="button" onClick={() => navigateView(config.id)} className="rounded bg-teal-500/10 px-1.5 py-0.5 text-xxs text-teal-600 hover:bg-teal-500/20">{config.calendarSource}</button>
                        </div>
                      );
                    })}


                    {hobbySessions.map((session) => {
                      const hobby = hobbyData.hobbies.find((candidate) => candidate.id === session.hobbyId);
                      const fun = hobbyData.funMenu.find((candidate) => candidate.id === session.funActivityId);
                      const done = session.status === 'Done';
                      return <div key={session.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} aria-label={`Mark ${hobby?.title ?? fun?.title ?? 'hobby session'} ${done ? 'open' : 'done'}`} onCheckedChange={(checked) => patchHobbySession(session.id, { status: checked === true ? 'Done' : 'Planned' })} /><span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{hobby?.title ?? fun?.title ?? 'Hobby session'}</span><span className="text-xxs text-muted-foreground">{session.durationMinutes} min</span><button type="button" onClick={() => navigateView(session.funActivityId ? 'hobby-fun' : 'hobby-practice')} className="rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-xxs text-fuchsia-600 hover:bg-fuchsia-500/20">{session.funActivityId ? 'Fun' : 'Hobby'}</button></div>;
                    })}

                    {musicSessions.map((session) => { const done = session.status === 'Done'; return <div key={session.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked) => patchMusicPractice(session.id, { status: checked === true ? 'Done' : 'Planned' })} /><span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{session.instrument}: {session.focus}</span><span className="text-xxs text-muted-foreground">{session.minutes} min</span><button type="button" onClick={() => navigateView('music-practice')} className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-xxs text-indigo-600">Music</button></div>; })}

                    {electronicsEntries.map((entry) => { const done = ['Passed', 'Done'].includes(entry.status); return <div key={entry.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked) => patchLabEntry(entry.id, { status: checked === true ? 'Done' : 'Planned' })} /><span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{entry.title}</span><span className="text-xxs text-muted-foreground">{entry.minutes} min</span><button type="button" onClick={() => navigateView('electronics-lab')} className="rounded bg-lime-500/10 px-1.5 py-0.5 text-xxs text-lime-700">Electronics</button></div>; })}

                    {homelabRuns.map((run) => { const done = run.status === 'Done'; return <div key={run.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked) => patchHomelabRun(run.id, { status: checked === true ? 'Done' : 'Planned' })}/><span className={cn('min-w-0 flex-1 truncate text-sm',done&&'text-muted-foreground line-through')}>{run.title}</span><span className="text-xxs text-muted-foreground">{run.minutes} min</span><button type="button" onClick={()=>navigateView('homelab-operations')} className="rounded bg-sky-500/10 px-1.5 py-0.5 text-xxs text-sky-600">Homelab</button></div>})}
                    {styleLogs.map((log) => <div key={log.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={log.done} onCheckedChange={(checked)=>patchStyleLog(log.id,{done:checked===true})}/><span className={cn('min-w-0 flex-1 truncate text-sm',log.done&&'text-muted-foreground line-through')}>{log.title}</span><button type="button" onClick={()=>navigateView('style-studio')} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-xxs text-rose-600">Style</button></div>)}
                    {gameSessions.map((session) => {const done=session.status==='Played';return <div key={session.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked)=>patchTtrpgSession(session.id,{status:checked===true?'Played':'Planned'})}/><span className={cn('min-w-0 flex-1 truncate text-sm',done&&'text-muted-foreground line-through')}>{session.title}</span><span className="text-xxs text-muted-foreground">{session.minutes} min</span><button type="button" onClick={()=>navigateView('ttrpg-sessions')} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-xxs text-violet-600">TTRPG</button></div>})}
                    {businessObligations.map((item) => { const done = ['Submitted', 'Accepted', 'Not applicable'].includes(item.status); return <div key={item.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked) => patchBusinessObligation(item.id, { status: checked === true ? 'Submitted' : 'Open', submittedOn: checked === true ? anchor : undefined })}/><span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{item.title}</span><button type="button" onClick={() => navigateView('business-obligations')} className="rounded bg-warning/10 px-1.5 py-0.5 text-xxs text-warning">Business</button></div>; })}
                    {businessCorrespondence.map((item) => { const done = ['Answered', 'Filed'].includes(item.status); return <div key={item.id} className="flex min-w-0 items-center gap-2"><Checkbox checked={done} onCheckedChange={(checked) => patchBusinessCorrespondence(item.id, { status: checked === true ? 'Answered' : 'Open' })}/><span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted-foreground line-through')}>{item.subject}</span><button type="button" onClick={() => navigateView('business-operations')} className="rounded bg-warning/10 px-1.5 py-0.5 text-xxs text-warning">Business</button></div>; })}

                    {blockPlan[block.id].length === 0 && paraTasks.length === 0 && routines.length === 0 && habits.length === 0 && lifeRecords.length === 0 && hobbySessions.length === 0 && musicSessions.length === 0 && electronicsEntries.length === 0 && homelabRuns.length === 0 && styleLogs.length === 0 && gameSessions.length === 0 && businessObligations.length === 0 && businessCorrespondence.length === 0 && <p className="text-xs text-muted-foreground">No items planned.</p>}
                    <div className="mt-1 flex gap-1.5">
                      <Input
                        value={drafts[block.id] ?? ''}
                        onChange={(event) => setDrafts((current) => ({ ...current, [block.id]: event.target.value }))}
                        onKeyDown={(event) => event.key === 'Enter' && addBlockItem(block.id)}
                        placeholder="Add an item"
                        aria-label={`Add item to ${block.label}`}
                        className="h-8"
                      />
                      <Button size="icon-sm" variant="outline" aria-label={`Add item to ${block.label}`} onClick={() => addBlockItem(block.id)}>
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {unassignedTasks.length > 0 && (
            <section className="rounded-md border border-border">
              <header className="border-b border-border bg-muted/30 px-3 py-2"><h3 className="text-sm font-medium">Scheduled tasks without a block</h3></header>
              <div className="flex flex-col gap-2 p-3">
                {unassignedTasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-48 flex-1 text-sm">{task.title}</span>
                    <ChoiceInline
                      label={`Assign ${task.title} to a day block`}
                      value=""
                      placeholder="Choose block…"
                      options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))}
                      onChange={(blockId) => patchTask(task.id, { blockId: blockId as DayBlockId })}
                      className="w-40"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {carryable.length > 0 && (
            <section className="rounded-md border border-warning/40">
              <header className="flex items-center gap-2 border-b border-warning/30 bg-warning/5 px-3 py-2">
                <span className="text-sm font-medium">Unfinished outside blocks from {previous}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => void carryOver()}>
                  <ArrowRight className="size-4" aria-hidden="true" />Carry over
                </Button>
              </header>
              <ul className="flex flex-col gap-1 px-3 py-2">
                {carryable.map((item, index) => <li key={`${item}-${index}`} className="text-sm text-muted-foreground">☐ {item}</li>)}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="font-mono text-xs">{week[0]} → {week[6]}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {week.map((date, index) => {
              const note = findDailyNote(data.notes, date);
              const body = note ? note.markdownContent ?? note.content ?? '' : '';
              const open = note ? uncheckedItems(body).length : 0;
              const headline = note ? headlineOf(body) : null;
              const blockItems = note ? Object.values(dayBlockPlanOf(body)).flat().length : 0;
              const taskCount = para.tasks.filter((task) => !task.archivedAt && task.doDate === date).length;
              const routineCount = routinesEnabled ? routinesOn(routineData, date).length + habitsOn(routineData, date).length : 0;
              const lifeCount = enabledLifeConfigs.reduce((sum, config) => sum + lifeRecordsOn(lifeCollections[config.id] ?? emptyLifeCollection(), date).length, 0);
              const hobbyCount = hobbiesEnabled ? hobbySessionsOn(hobbyData, date).filter((session) => session.blockId).length : 0;
              const musicCount = musicEnabled ? musicPracticeOn(musicData, date).filter((session) => session.blockId).length : 0;
              const electronicsCount = electronicsEnabled ? labEntriesOn(electronicsData, date).filter((entry) => entry.blockId).length : 0;
              const homelabCount = homelabEnabled ? homelabRunsOn(homelabData, date).filter((run) => run.blockId).length : 0;
              const styleCount = styleEnabled ? styleLogsOn(wardrobeData, date).filter((log) => log.blockId).length : 0;
              const ttrpgCount = ttrpgEnabled ? gameSessionsOn(ttrpgData, date).filter((session) => session.blockId).length : 0;
              const businessCount = businessEnabled ? obligationsOn(businessData, date).length + correspondenceOn(businessData, date).length : 0;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => { setAnchor(date); setLayout('day'); }}
                  className={cn(
                    'flex min-h-24 flex-col rounded-md border p-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    date === today ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {WEEKDAY_LABELS[index]}
                    <span className="font-mono text-xxs text-muted-foreground">{date.slice(5)}</span>
                    {!note && <CalendarPlus className="ml-auto size-3 text-muted-foreground" aria-hidden="true" />}
                  </span>
                  {headline && <span className="mt-1 truncate text-xs text-muted-foreground">{headline}</span>}
                  {(blockItems > 0 || taskCount > 0 || routineCount > 0 || lifeCount > 0 || hobbyCount > 0 || musicCount > 0 || electronicsCount > 0 || homelabCount > 0 || styleCount > 0 || ttrpgCount > 0 || businessCount > 0 || open > 0) && <span className="mt-auto text-xxs text-muted-foreground">{blockItems + taskCount + routineCount + lifeCount + hobbyCount + musicCount + electronicsCount + homelabCount + styleCount + ttrpgCount + businessCount} blocked · {open} other</span>}
                  {!note && taskCount === 0 && routineCount === 0 && lifeCount === 0 && hobbyCount === 0 && musicCount === 0 && electronicsCount === 0 && homelabCount === 0 && styleCount === 0 && ttrpgCount === 0 && businessCount === 0 && <span className="mt-1 text-xxs text-muted-foreground">no plan</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

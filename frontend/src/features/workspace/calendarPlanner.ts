import { DAY_BLOCKS, dayBlockPlanOf, type DayBlockId } from './dayBlocks';
import type { EducationData } from './education';
import type { HobbyData } from './hobbies';
import type { MealPlannerData } from './mealPlanner';
import type { MusicData } from './musicStudio';
import type { ElectronicsData } from './electronicsWorkbench';
import type { HomelabData } from './homelab';
import type { WardrobeData } from './wardrobe';
import type { TtrpgData } from './ttrpg';
import type { ParaData } from './para';
import type { LifeCalendarSource, LifePluginConfig } from './lifeConfigs';
import { lifeOccurrenceDone, lifeRecordsOn, type LifeCollectionData } from './lifeStore';
import { habitCount, habitStreak, habitsOn, routineDone, routinesOn, type RoutinesData } from './routines';
import type { WorkoutPlannerData } from './workoutPlanner';
import type { BusinessAdminData } from './businessAdmin';

export type BlockItemSource = 'Plan' | 'Task' | 'Meal' | 'Meal prep' | 'Workout' | 'Study' | 'Hobby' | 'Fun' | 'Music' | 'Electronics' | 'Homelab' | 'Style' | 'TTRPG' | 'Business' | 'Routine' | 'Habit' | LifeCalendarSource;
export interface BlockOverviewItem {
  id: string;
  title: string;
  source: BlockItemSource;
  done: boolean;
  detail?: string;
}
export type CalendarBlockOverview = Record<DayBlockId, BlockOverviewItem[]>;

export function calendarBlockOverview(
  date: string,
  dailyBody: string,
  para: ParaData,
  meals: MealPlannerData,
  workouts: WorkoutPlannerData,
  education: EducationData,
  routines?: RoutinesData,
  lifeCollections: Array<{ config: LifePluginConfig; data: LifeCollectionData }> = [],
  hobbies?: HobbyData,
  music?: MusicData,
  electronics?: ElectronicsData,
  homelab?: HomelabData,
  wardrobe?: WardrobeData,
  ttrpg?: TtrpgData,
  business?: BusinessAdminData,
): CalendarBlockOverview {
  const notePlan = dayBlockPlanOf(dailyBody);
  const overview = Object.fromEntries(DAY_BLOCKS.map((block) => [block.id, notePlan[block.id].map((item, index) => ({
    id: `plan-${block.id}-${index}`,
    title: item.text,
    source: 'Plan' as const,
    done: item.done,
  }))])) as CalendarBlockOverview;

  for (const task of para.tasks.filter((item) => !item.archivedAt && item.doDate === date && item.blockId)) {
    overview[task.blockId!].push({ id: task.id, title: task.title, source: 'Task', done: task.status === 'Done', detail: task.priority });
  }
  for (const meal of meals.meals.filter((item) => item.date === date && item.blockId)) {
    overview[meal.blockId!].push({ id: meal.id, title: meal.title, source: 'Meal', done: meal.done, detail: `${meal.type} · ${meal.servings} serving${meal.servings === 1 ? '' : 's'}` });
  }
  for (const session of meals.prepSessions.filter((item) => item.date === date && item.blockId)) {
    overview[session.blockId!].push({ id: session.id, title: session.title, source: 'Meal prep', done: session.done, detail: `${session.portionsRemaining}/${session.portions} portions · ${session.location}` });
  }
  for (const workout of workouts.workouts.filter((item) => item.date === date && item.blockId)) {
    overview[workout.blockId!].push({ id: workout.id, title: workout.title, source: 'Workout', done: workout.done, detail: `${workout.type} · ${workout.durationMinutes} min` });
  }
  for (const session of education.sessions.filter((item) => item.date === date && item.blockId)) {
    const node = education.nodes.find((item) => item.id === session.nodeId);
    overview[session.blockId!].push({ id: session.id, title: node?.title ?? 'Missing learning item', source: 'Study', done: session.status === 'Done', detail: `${session.durationMinutes} min${session.notes ? ` · ${session.notes}` : ''}` });
  }
  for (const session of hobbies?.sessions.filter((item) => item.date === date && item.blockId) ?? []) {
    const hobby = hobbies?.hobbies.find((item) => item.id === session.hobbyId);
    const fun = hobbies?.funMenu.find((item) => item.id === session.funActivityId);
    overview[session.blockId!].push({ id: session.id, title: hobby?.title ?? fun?.title ?? 'Hobby session', source: session.funActivityId ? 'Fun' : 'Hobby', done: session.status === 'Done', detail: `${session.durationMinutes} min${session.people.length ? ` · with ${session.people.join(', ')}` : ''}` });
  }
  for (const session of music?.practice.filter((item) => item.date === date && item.blockId) ?? []) {
    overview[session.blockId!].push({ id: session.id, title: `${session.instrument}: ${session.focus}`, source: 'Music', done: session.status === 'Done', detail: `${session.minutes} min${session.piece ? ` · ${session.piece}` : ''}${session.bpm ? ` · ${session.bpm} BPM` : ''}` });
  }
  for (const entry of electronics?.lab.filter((item) => item.date === date && item.blockId) ?? []) {
    const project = electronics?.projects.find((item) => item.id === entry.projectId);
    overview[entry.blockId!].push({ id: entry.id, title: entry.title, source: 'Electronics', done: ['Passed', 'Done'].includes(entry.status), detail: `${project?.title ?? entry.type} · ${entry.minutes} min · ${entry.status}` });
  }
  for (const run of homelab?.runs.filter((item) => item.date === date && item.blockId) ?? []) { const asset = homelab?.assets.find((item) => item.id === run.assetId); overview[run.blockId!].push({ id: run.id, title: run.title, source: 'Homelab', done: run.status === 'Done', detail: `${asset?.name ?? run.type} · ${run.minutes} min · ${run.status}` }); }
  for (const log of wardrobe?.logs.filter((item) => item.date === date && item.blockId) ?? []) { overview[log.blockId!].push({ id: log.id, title: log.title, source: 'Style', done: log.done, detail: `${log.type}${log.rating ? ` · ${log.rating}/5` : ''}` }); }
  for (const session of ttrpg?.sessions.filter((item) => item.date === date && item.blockId) ?? []) { const campaign = ttrpg?.campaigns.find((item) => item.id === session.campaignId); overview[session.blockId!].push({ id: session.id, title: session.title, source: 'TTRPG', done: session.status === 'Played', detail: `${campaign?.title ?? 'Campaign'} · ${session.minutes} min · ${session.status}` }); }
  for (const item of business?.obligations.filter((entry) => entry.dueDate === date && entry.blockId) ?? []) { overview[item.blockId!].push({ id: item.id, title: item.title, source: 'Business', done: ['Submitted', 'Accepted', 'Not applicable'].includes(item.status), detail: `${item.type}${item.authority ? ` · ${item.authority}` : ''}` }); }
  for (const item of business?.correspondence.filter((entry) => entry.dueDate === date && entry.blockId) ?? []) { overview[item.blockId!].push({ id: item.id, title: item.subject, source: 'Business', done: ['Answered', 'Filed'].includes(item.status), detail: `${item.direction} correspondence · ${item.status}` }); }
  if (routines) {
    for (const routine of routinesOn(routines, date)) {
      overview[routine.blockId].push({ id: routine.id, title: routine.title, source: 'Routine', done: routineDone(routines, routine.id, date), detail: routine.durationMinutes ? `${routine.durationMinutes} min` : undefined });
    }
    for (const habit of habitsOn(routines, date)) {
      const count = habitCount(routines, habit.id, date);
      const streak = habitStreak(routines, habit, date);
      overview[habit.blockId].push({ id: habit.id, title: habit.title, source: 'Habit', done: count >= habit.target, detail: `${count}/${habit.target}${habit.unit ? ` ${habit.unit}` : ''}${streak > 0 ? ` · ${streak} streak` : ''}` });
    }
  }
  for (const { config, data } of lifeCollections) {
    for (const record of lifeRecordsOn(data, date)) {
      overview[record.blockId!].push({
        id: record.id,
        title: record.title,
        source: config.calendarSource,
        done: lifeOccurrenceDone(data, record.id, date) || config.completedStatuses.includes(record.status),
        detail: `${record.category} · ${record.status}${record.recurrence === 'Once' ? '' : ` · ${record.recurrence}`}`,
      });
    }
  }
  return overview;
}

export function blockOverviewCount(overview: CalendarBlockOverview): number {
  return Object.values(overview).reduce((sum, items) => sum + items.length, 0);
}

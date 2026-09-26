import { useState } from 'react';
import { Flame, Minus, Plus, Repeat2, Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox, EmptyState, Input, cn } from '@/ui';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { isoDate } from './planner';
import {
  SCHEDULE_MODES,
  habitCount,
  habitStreak,
  newRoutineId,
  occursOn,
  scheduleLabel,
  setHabitCount,
  type Recurrence,
  type ScheduleMode,
} from './routines';
import { useRoutinesStore } from './useRoutinesStore';
import { PopoverEditor } from './EntryPopover';
import { ChoiceInline } from './viewkit';

const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']] as const;
const defaultRecurrence = (): Recurrence => ({ mode: 'Daily', daysOfWeek: [] });

export function RoutinesHabitsView() {
  const [data, persist] = useRoutinesStore();
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineBlock, setRoutineBlock] = useState<DayBlockId>('morning-prime');
  const [routineMinutes, setRoutineMinutes] = useState(15);
  const [routineRecurrence, setRoutineRecurrence] = useState<Recurrence>(defaultRecurrence);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitBlock, setHabitBlock] = useState<DayBlockId>('morning-prime');
  const [habitTarget, setHabitTarget] = useState(1);
  const [habitUnit, setHabitUnit] = useState('times');
  const [habitRecurrence, setHabitRecurrence] = useState<Recurrence>(defaultRecurrence);
  const today = isoDate(new Date());

  const addRoutine = () => {
    if (!routineTitle.trim()) return;
    persist((current) => ({ ...current, routines: [...current.routines, { id: newRoutineId('routine'), title: routineTitle.trim(), blockId: routineBlock, recurrence: routineRecurrence, durationMinutes: routineMinutes, active: true }] }));
    setRoutineTitle('');
  };
  const addHabit = () => {
    if (!habitTitle.trim()) return;
    persist((current) => ({ ...current, habits: [...current.habits, { id: newRoutineId('habit'), title: habitTitle.trim(), blockId: habitBlock, recurrence: habitRecurrence, target: habitTarget, unit: habitUnit.trim() || undefined, active: true }] }));
    setHabitTitle('');
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">Routines & Habits</h2>
      </header>
      <div className="grid items-start gap-4 p-4 xl:grid-cols-2">
        <section className="rounded-sm border border-border">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2"><Repeat2 className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Routines</h3></header>
          <div className="border-b border-border p-3"><PopoverEditor title="Add routine">
            <Input value={routineTitle} onChange={(event) => setRoutineTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addRoutine()} placeholder="Routine, e.g. Morning reset" className="h-8" />
            <div className="flex flex-wrap gap-2">
              <ChoiceInline label="Routine day block" value={routineBlock} onChange={(value) => setRoutineBlock(value as DayBlockId)} options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))} className="min-w-48 flex-1" />
              <Input type="number" min={1} value={routineMinutes} onChange={(event) => setRoutineMinutes(Math.max(1, Number(event.target.value) || 1))} className="h-8 w-28" aria-label="Routine minutes" />
            </div>
            <RecurrenceFields value={routineRecurrence} onChange={setRoutineRecurrence} />
            <Button size="sm" onClick={addRoutine}><Plus />Add routine</Button>
          </PopoverEditor></div>
          {data.routines.length === 0 ? <EmptyState icon={<Repeat2 />} title="No routines yet" description="A routine becomes a recurring item in its assigned Planner block." className="my-8" /> : (
            <ul className="divide-y divide-border">
              {data.routines.map((routine) => {
                const block = DAY_BLOCKS.find((item) => item.id === routine.blockId);
                return <li key={routine.id} className="flex items-start gap-2 px-3 py-2"><Checkbox checked={routine.active} onCheckedChange={(checked) => persist((current) => ({ ...current, routines: current.routines.map((item) => item.id === routine.id ? { ...item, active: checked === true } : item) }))} aria-label={`${routine.active ? 'Pause' : 'Resume'} ${routine.title}`} /><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium', !routine.active && 'text-muted-foreground line-through')}>{routine.title}</p><p className="text-xs text-muted-foreground">{scheduleLabel(routine.recurrence)} · {block?.label}{routine.durationMinutes ? ` · ${routine.durationMinutes} min` : ''}</p></div><button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${routine.title}`} onClick={() => persist((current) => ({ ...current, routines: current.routines.filter((item) => item.id !== routine.id), routineCompletions: current.routineCompletions.filter((item) => item.routineId !== routine.id) }))}><Trash2 className="size-4" /></button></li>;
              })}
            </ul>
          )}
        </section>

        <section className="rounded-sm border border-border">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2"><Flame className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Habits</h3></header>
          <div className="border-b border-border p-3"><PopoverEditor title="Add habit">
            <Input value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addHabit()} placeholder="Habit, e.g. Drink water" className="h-8" />
            <div className="flex flex-wrap gap-2">
              <ChoiceInline label="Habit day block" value={habitBlock} onChange={(value) => setHabitBlock(value as DayBlockId)} options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))} className="min-w-48 flex-1" />
              <Input type="number" min={1} value={habitTarget} onChange={(event) => setHabitTarget(Math.max(1, Number(event.target.value) || 1))} className="h-8 w-20" aria-label="Daily habit target" />
              <Input value={habitUnit} onChange={(event) => setHabitUnit(event.target.value)} className="h-8 w-24" aria-label="Habit unit" placeholder="times" />
            </div>
            <RecurrenceFields value={habitRecurrence} onChange={setHabitRecurrence} />
            <Button size="sm" onClick={addHabit}><Plus />Add habit</Button>
          </PopoverEditor></div>
          {data.habits.length === 0 ? <EmptyState icon={<Flame />} title="No habits yet" description="Habits keep a daily count and a schedule-aware streak inside Planner." className="my-8" /> : (
            <ul className="divide-y divide-border">
              {data.habits.map((habit) => {
                const count = habitCount(data, habit.id, today);
                const streak = habitStreak(data, habit, today);
                const block = DAY_BLOCKS.find((item) => item.id === habit.blockId);
                const scheduledToday = habit.active && occursOn(habit.recurrence, today);
                return <li key={habit.id} className="px-3 py-2"><div className="flex items-start gap-2"><Checkbox checked={habit.active} onCheckedChange={(checked) => persist((current) => ({ ...current, habits: current.habits.map((item) => item.id === habit.id ? { ...item, active: checked === true } : item) }))} aria-label={`${habit.active ? 'Pause' : 'Resume'} ${habit.title}`} /><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium', !habit.active && 'text-muted-foreground line-through')}>{habit.title}</p><p className="text-xs text-muted-foreground">{scheduleLabel(habit.recurrence)} · {block?.label} · target {habit.target} {habit.unit}</p></div>{streak > 0 && <Badge variant="warning"><Flame className="size-3" />{streak}</Badge>}<button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${habit.title}`} onClick={() => persist((current) => ({ ...current, habits: current.habits.filter((item) => item.id !== habit.id), habitCheckIns: current.habitCheckIns.filter((item) => item.habitId !== habit.id) }))}><Trash2 className="size-4" /></button></div>{scheduledToday ? <div className="mt-2 flex items-center gap-2 pl-6"><span className="mr-auto text-xs text-muted-foreground">Today: {count}/{habit.target} {habit.unit}</span><Button size="icon-sm" variant="outline" disabled={count === 0} aria-label={`Decrease ${habit.title}`} onClick={() => persist((current) => setHabitCount(current, habit.id, today, count - 1))}><Minus /></Button><Button size="icon-sm" variant="outline" aria-label={`Increase ${habit.title}`} onClick={() => persist((current) => setHabitCount(current, habit.id, today, count + 1))}><Plus /></Button></div> : <p className="mt-2 pl-6 text-xs text-muted-foreground">Not scheduled today</p>}</li>;
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function RecurrenceFields({ value, onChange }: { value: Recurrence; onChange: (next: Recurrence) => void }) {
  const toggleDay = (day: number, checked: boolean) => onChange({ ...value, daysOfWeek: checked ? [...new Set([...value.daysOfWeek, day])] : value.daysOfWeek.filter((item) => item !== day) });
  return <div className="grid gap-2 rounded border border-border p-2"><div className="flex flex-wrap gap-2"><ChoiceInline label="Recurrence" value={value.mode} onChange={(mode) => onChange({ ...value, mode: mode as ScheduleMode })} options={SCHEDULE_MODES.map((mode) => ({ value: mode, label: mode === 'Custom' ? 'Custom days' : mode }))} className="flex-1" /><Input type="date" value={value.startDate ?? ''} onChange={(event) => onChange({ ...value, startDate: event.target.value || undefined })} className="h-9 w-36" aria-label="Starts on" /><Input type="date" value={value.endDate ?? ''} onChange={(event) => onChange({ ...value, endDate: event.target.value || undefined })} className="h-9 w-36" aria-label="Ends on" /></div>{value.mode === 'Custom' && <div className="flex flex-wrap gap-2">{WEEKDAYS.map(([day, label]) => <label key={day} className="flex items-center gap-1 text-xs text-muted-foreground"><Checkbox checked={value.daysOfWeek.includes(day)} onCheckedChange={(checked) => toggleDay(day, checked === true)} />{label}</label>)}</div>}</div>;
}

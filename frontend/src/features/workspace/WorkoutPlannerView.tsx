import { useWorkoutPlannerStore } from './usePluginDataStores';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, EmptyState, Input, cn } from '@/ui';
import { ChoiceInline } from './viewkit';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { addDays, isoDate, weekOf, WEEKDAY_LABELS } from './planner';
import {
  WORKOUT_TYPES,
  newWorkoutPlannerId,
  workoutsOn,
  type PlannedWorkout,
  type WorkoutType,
} from './workoutPlanner';
import { PopoverEditor } from './EntryPopover';

interface ExerciseDraft { name: string; prescription: string; }

export function WorkoutPlannerView() {
  const [data, persist] = useWorkoutPlannerStore();
  const [anchor, setAnchor] = useState(() => isoDate(new Date()));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [type, setType] = useState<WorkoutType>('Strength');
  const [duration, setDuration] = useState(60);
  const [blockId, setBlockId] = useState<DayBlockId>('morning-prime');
  const [exerciseDrafts, setExerciseDrafts] = useState<Record<string, ExerciseDraft>>({});
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const today = isoDate(new Date());



  const patchWorkout = (id: string, update: Partial<PlannedWorkout>) => {
    persist((current) => ({ ...current, workouts: current.workouts.map((workout) => workout.id === id ? { ...workout, ...update } : workout) }));
  };

  const addWorkout = () => {
    if (!title.trim()) return;
    const saved = persist((current) => ({
      ...current,
      workouts: [...current.workouts, {
        id: newWorkoutPlannerId('workout'),
        date,
        title: title.trim(),
        type,
        durationMinutes: duration,
        blockId,
        done: false,
        exercises: [],
      }],
    }));
    if (saved) setTitle('');
  };

  const addExercise = (workout: PlannedWorkout) => {
    const draft = exerciseDrafts[workout.id];
    if (!draft?.name.trim()) return;
    patchWorkout(workout.id, {
      exercises: [...workout.exercises, {
        id: newWorkoutPlannerId('exercise'),
        name: draft.name.trim(),
        prescription: draft.prescription.trim() || undefined,
        done: false,
      }],
    });
    setExerciseDrafts((current) => ({ ...current, [workout.id]: { name: '', prescription: '' } }));
  };

  const visibleWorkouts = week.flatMap((day) => workoutsOn(data, day));

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h2 className="text-sm font-semibold">Workout Planner</h2>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="size-4" /></Button>
          <span className="font-mono text-xs">{week[0]} → {week[6]}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight className="size-4" /></Button>
          {!week.includes(today) && <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>This week</Button>}
        </div>
        <div className="mt-3"><PopoverEditor title="Add workout">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addWorkout()} placeholder="Workout" className="h-8 w-56" />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 w-36 text-xs" aria-label="Workout date" />
          <ChoiceInline label="Workout type" value={type} onChange={(next) => setType(next as WorkoutType)} options={WORKOUT_TYPES} className="w-36" />
          <Input type="number" min={0} step={5} value={duration} onChange={(event) => setDuration(Math.max(0, Number(event.target.value) || 0))} className="h-8 w-24 text-xs" aria-label="Duration in minutes" />
          <ChoiceInline label="Day block" value={blockId} onChange={(next) => setBlockId(next as DayBlockId)} options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))} className="w-40" />
          <Button size="sm" onClick={addWorkout}><Plus className="size-4" />Add workout</Button>
        </PopoverEditor></div>
      </header>

      {visibleWorkouts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8"><EmptyState icon={<Dumbbell className="size-5" />} title="No workouts this week" description="Schedule a session, then add its exercises and prescriptions." /></div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {week.map((day, index) => workoutsOn(data, day).map((workout) => {
            const block = DAY_BLOCKS.find((item) => item.id === workout.blockId);
            const complete = workout.exercises.filter((exercise) => exercise.done).length;
            const draft = exerciseDrafts[workout.id] ?? { name: '', prescription: '' };
            return (
              <article key={workout.id} className={cn(day === today && 'border-l-2 border-primary')}>
                <header className="flex items-start gap-2 border-b border-border px-3 py-2">
                  <Checkbox checked={workout.done} onCheckedChange={(checked) => patchWorkout(workout.id, { done: checked === true })} aria-label={`Mark ${workout.title} ${workout.done ? 'open' : 'done'}`} />
                  <div className="min-w-0 flex-1">
                    <h3 className={cn('truncate text-sm font-medium', workout.done && 'text-muted-foreground line-through')}>{workout.title}</h3>
                    <p className="text-xs text-muted-foreground">{WEEKDAY_LABELS[index]} {day.slice(5)} · {workout.type} · {workout.durationMinutes} min</p>
                    {block && <p className="text-xxs text-muted-foreground">{block.label} · {complete}/{workout.exercises.length} exercises</p>}
                  </div>
                  <button type="button" aria-label={`Delete ${workout.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => persist((current) => ({ ...current, workouts: current.workouts.filter((item) => item.id !== workout.id) }))}><Trash2 className="size-4" /></button>
                </header>
                <div className="flex flex-col gap-1.5 p-3">
                  {workout.exercises.length === 0 && <p className="text-xs text-muted-foreground">No exercises yet.</p>}
                  {workout.exercises.map((exercise) => (
                    <div key={exercise.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/40">
                      <Checkbox checked={exercise.done} onCheckedChange={(checked) => patchWorkout(workout.id, { exercises: workout.exercises.map((item) => item.id === exercise.id ? { ...item, done: checked === true } : item) })} aria-label={`Mark ${exercise.name} ${exercise.done ? 'open' : 'done'}`} />
                      <span className={cn('min-w-0 flex-1 truncate text-sm', exercise.done && 'text-muted-foreground line-through')}>{exercise.name}</span>
                      {exercise.prescription && <span className="text-xs text-muted-foreground">{exercise.prescription}</span>}
                      <button type="button" aria-label={`Delete ${exercise.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => patchWorkout(workout.id, { exercises: workout.exercises.filter((item) => item.id !== exercise.id) })}><Trash2 className="size-3.5" /></button>
                    </div>
                  ))}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Input value={draft.name} onChange={(event) => setExerciseDrafts((current) => ({ ...current, [workout.id]: { ...draft, name: event.target.value } }))} onKeyDown={(event) => event.key === 'Enter' && addExercise(workout)} placeholder="Exercise" className="h-8 min-w-40 flex-1" />
                    <Input value={draft.prescription} onChange={(event) => setExerciseDrafts((current) => ({ ...current, [workout.id]: { ...draft, prescription: event.target.value } }))} onKeyDown={(event) => event.key === 'Enter' && addExercise(workout)} placeholder="3 × 5 @ 80 kg" className="h-8 w-40" />
                    <Button size="icon-sm" variant="outline" aria-label={`Add exercise to ${workout.title}`} onClick={() => addExercise(workout)}><Plus className="size-4" /></Button>
                  </div>
                </div>
              </article>
            );
          }))}
        </div>
      )}
    </div>
  );
}

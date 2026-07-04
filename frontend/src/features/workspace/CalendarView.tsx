// Calendar - places notes on a month or week grid by date. Bucket by updated or
// created date, navigate months and weeks, and open a note from its day. Today
// is highlighted; arrow keys move the selected day.
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, EmptyState, cn } from '@/ui';
import type { CoreNote } from '@modulo/core';
import { Segmented } from './Segmented';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  dayKey,
  monthGrid,
  noteDate,
  sameDay,
  startOfWeek,
  weekGrid,
  type DateField,
} from './noteDates';

interface CalendarViewProps {
  notes: CoreNote[];
  onOpenNote: (id: number) => void;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function CalendarView({ notes, onOpenNote }: CalendarViewProps) {
  const [layout, setLayout] = useState<'month' | 'week'>('month');
  const [field, setField] = useState<DateField>('updatedAt');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const today = useMemo(() => new Date(), []);

  const byDay = useMemo(() => {
    const m = new Map<string, CoreNote[]>();
    for (const n of notes) {
      const d = noteDate(n, field);
      if (!d) continue;
      const k = dayKey(d);
      const list = m.get(k);
      if (list) list.push(n);
      else m.set(k, [n]);
    }
    return m;
  }, [notes, field]);

  const days = useMemo(
    () => (layout === 'month' ? monthGrid(cursor.getFullYear(), cursor.getMonth()) : weekGrid(cursor)),
    [layout, cursor],
  );

  const title = useMemo(() => {
    if (layout === 'month') return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    return s.getMonth() === e.getMonth()
      ? `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} - ${e.getDate()}, ${s.getFullYear()}`
      : `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()} - ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${e.getFullYear()}`;
  }, [layout, cursor]);

  const shift = (dir: number) =>
    setCursor((c) => (layout === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * 7)));

  const goToday = () => {
    const t = new Date();
    setCursor(t);
    setSelected(t);
  };

  const moveSelection = (delta: number) => {
    const next = addDays(selected ?? today, delta);
    setSelected(next);
    if (layout === 'month' && next.getMonth() !== cursor.getMonth()) {
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    } else if (layout === 'week') {
      const s = startOfWeek(cursor);
      if (next < s || next > addDays(s, 6)) setCursor(next);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in deltas) {
      e.preventDefault();
      moveSelection(deltas[e.key]);
    }
  };

  return (
    <div className="flex flex-1 animate-fade-in flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-[8rem] text-sm font-medium tabular-nums">{title}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Segmented
            value={field}
            onChange={setField}
            options={[['updatedAt', 'Updated'], ['createdAt', 'Created']] as const}
          />
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[['month', 'Month'], ['week', 'Week']] as const}
          />
        </div>
      </header>

      {notes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="Nothing scheduled yet"
            description="Create notes and they will appear here by date."
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden p-3" role="grid" tabIndex={0} onKeyDown={onKeyDown}>
          <div className="grid shrink-0 grid-cols-7 border-b border-border pb-1.5">
            {WEEKDAY_SHORT.map((w) => (
              <div key={w} className="px-1 text-xxs font-medium uppercase tracking-wide text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div
            className={cn(
              'grid flex-1 grid-cols-7 gap-px overflow-y-auto pt-px',
              layout === 'month' ? 'grid-rows-6' : 'grid-rows-1',
            )}
          >
            {days.map((d) => {
              const dayNotes = byDay.get(dayKey(d)) ?? [];
              const inMonth = layout === 'week' || d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const isSel = selected != null && sameDay(d, selected);
              const max = layout === 'week' ? 24 : 3;
              return (
                <div
                  key={dayKey(d)}
                  role="gridcell"
                  onClick={() => setSelected(d)}
                  className={cn(
                    'flex min-h-0 flex-col gap-1 rounded-md border p-1.5 transition-colors',
                    inMonth ? 'bg-surface/40' : 'bg-transparent',
                    isSel ? 'border-border-strong' : 'border-transparent',
                    'hover:bg-surface',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex size-5 items-center justify-center rounded-full text-xxs tabular-nums',
                        isToday
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : inMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground/50',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {dayNotes.length > 0 && (
                      <span className="text-xxs tabular-nums text-muted-foreground">{dayNotes.length}</span>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                    {dayNotes.slice(0, max).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNote(n.id);
                        }}
                        title={n.title || 'Untitled'}
                        className="truncate rounded bg-primary/10 px-1 py-0.5 text-left text-xxs text-foreground transition-colors hover:bg-primary/20"
                      >
                        {n.title || 'Untitled'}
                      </button>
                    ))}
                    {dayNotes.length > max && (
                      <span className="px-1 text-xxs text-muted-foreground">+{dayNotes.length - max} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

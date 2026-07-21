// Planner view (#370): today's dated note front and center with carry-over of
// yesterday's unfinished items, plus a Monday-first week overview. A tab in
// the Productivity hub.
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarPlus, ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react';
import { Button, cn, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
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

export function PlannerView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const [layout, setLayout] = useState<'day' | 'week'>('day');
  const [anchor, setAnchor] = useState(() => isoDate(new Date()));
  const today = isoDate(new Date());

  const todayNote = useMemo(() => findDailyNote(data.notes, today), [data.notes, today]);
  const yesterday = addDays(today, -1);
  const yesterdayNote = useMemo(() => findDailyNote(data.notes, yesterday), [data.notes, yesterday]);
  const carryable = useMemo(
    () => (yesterdayNote ? uncheckedItems(yesterdayNote.markdownContent ?? yesterdayNote.content ?? '') : []),
    [yesterdayNote],
  );

  const week = useMemo(() => weekOf(anchor), [anchor]);

  const openOrCreate = async (date: string) => {
    const existing = findDailyNote(data.notes, date);
    if (existing) {
      onOpenNote(existing.id);
      return;
    }
    const created = await data.createNote(date, dailyTemplate(date));
    if (created) onOpenNote(created.id);
  };

  const carryOver = async () => {
    if (carryable.length === 0) return;
    let target = todayNote;
    if (!target) {
      target = (await data.createNote(today, dailyTemplate(today))) ?? undefined;
      if (!target) return;
    }
    const body = target.markdownContent ?? target.content ?? '';
    // Copy, never move: yesterday's note is untouched.
    const next = `${body.trimEnd()}\n${carryOverBlock(carryable, yesterday)}`;
    await data.updateNote(target.id, { content: next, markdownContent: next });
    toast({ title: `${carryable.length} item${carryable.length === 1 ? '' : 's'} carried over`, description: `From ${yesterday} into today's note.` });
    onOpenNote(target.id);
  };

  const todayUnchecked = todayNote ? uncheckedItems(todayNote.markdownContent ?? todayNote.content ?? '') : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Planner</h2>
        <div className="flex rounded-md border border-border p-0.5">
          {(['day', 'week'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layout === l}
              onClick={() => setLayout(l)}
              className={cn(
                'rounded px-2.5 py-0.5 text-xs capitalize',
                layout === l ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => void openOrCreate(today)}>
          <NotebookPen className="size-4" aria-hidden="true" />
          {todayNote ? "Open today's note" : "Create today's note"}
        </Button>
      </div>

      {layout === 'day' ? (
        <div className="flex flex-col gap-4 p-4">
          <section className="rounded-md border border-border">
            <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">Today — {today}</span>
              {todayUnchecked.length > 0 && (
                <span className="text-xs text-muted-foreground">{todayUnchecked.length} open</span>
              )}
            </header>
            {todayNote ? (
              todayUnchecked.length > 0 ? (
                <ul className="flex flex-col gap-1 px-3 py-2">
                  {todayUnchecked.map((item, i) => (
                    <li key={i} className="text-sm">
                      ☐ {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-3 text-xs text-muted-foreground">No open items — open the note to plan the day.</p>
              )
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                No note for today yet. Create it to start planning.
              </p>
            )}
          </section>

          {carryable.length > 0 && (
            <section className="rounded-md border border-amber-500/40">
              <header className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <span className="text-sm font-medium">Unfinished from {yesterday}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => void carryOver()}>
                  <ArrowRight className="size-4" aria-hidden="true" />
                  Carry over
                </Button>
              </header>
              <ul className="flex flex-col gap-1 px-3 py-2">
                {carryable.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    ☐ {item}
                  </li>
                ))}
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
            <span className="font-mono text-xs">
              {week[0]} → {week[6]}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {week.map((date, i) => {
              const note = findDailyNote(data.notes, date);
              const body = note ? (note.markdownContent ?? note.content ?? '') : '';
              const open = note ? uncheckedItems(body).length : 0;
              const headline = note ? headlineOf(body) : null;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => void openOrCreate(date)}
                  className={cn(
                    'flex min-h-24 flex-col rounded-md border p-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    date === today ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {WEEKDAY_LABELS[i]}
                    <span className="font-mono text-xxs text-muted-foreground">{date.slice(5)}</span>
                    {!note && <CalendarPlus className="ml-auto size-3 text-muted-foreground" aria-hidden="true" />}
                  </span>
                  {note ? (
                    <>
                      {headline && <span className="mt-1 truncate text-xs text-muted-foreground">{headline}</span>}
                      {open > 0 && <span className="mt-auto text-xxs text-muted-foreground">{open} open</span>}
                    </>
                  ) : (
                    <span className="mt-1 text-xxs text-muted-foreground">no note</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

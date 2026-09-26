// Calendar with year and month overview views. Clicking a date opens a compact
// day planner; its day blocks drill into an aggregate block overview.
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react';
import { Button, Popover, PopoverAnchor, PopoverContent, ScrollArea, cn } from '@/ui';
import type { CoreNote } from '@modulo/core';
import type { WorkspaceData } from './useCoreWorkspace';
import { Segmented } from './Segmented';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { calendarBlockOverview } from './calendarPlanner';
import { LIFE_PLUGIN_CONFIGS, type LifePluginConfig } from './lifeConfigs';
import { DOMAIN_COLLECTION_CONFIGS } from './domainConfigs';
import { BUSINESS_OBLIGATIONS_PLUGIN_ID, BUSINESS_OPERATIONS_PLUGIN_ID, ELECTRONICS_LAB_PLUGIN_ID, HOBBY_PRACTICE_PLUGIN_ID, HOMELAB_OPERATIONS_PLUGIN_ID, INFORMATION_INTAKE_PLUGIN_ID, MUSIC_PRACTICE_PLUGIN_ID, ROUTINES_PLUGIN_ID, STYLE_STUDIO_PLUGIN_ID, TTRPG_SESSIONS_PLUGIN_ID } from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import { useParaStore } from './useParaStore';
import { useEducationStore } from './useEducationStore';
import { useRoutinesStore } from './useRoutinesStore';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import { useHobbyStore } from './useHobbyStore';
import { useMusicStore } from './useMusicStore';
import { useElectronicsStore } from './useElectronicsStore';
import { useHomelabStore } from './useHomelabStore';
import { useWardrobeStore } from './useWardrobeStore';
import { useTtrpgStore } from './useTtrpgStore';
import { useBusinessAdminStore } from './useBusinessAdminStore';
import { useLifeCollections } from './useLifeCollection';
import { useMealPlannerStore, useWorkoutPlannerStore } from './usePluginDataStores';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  dayKey,
  monthGrid,
  noteDate,
  sameDay,
  yearGrid,
  type DateField,
} from './noteDates';
import { dailyTemplate, findDailyNote } from './planner';

interface CalendarViewProps {
  data: WorkspaceData;
  onOpenNote: (id: number) => void;
  layout?: CalendarLayout;
  onLayoutChange?: (layout: CalendarLayout) => void;
  anchor?: string;
  onAnchorChange?: (date: string) => void;
  embedded?: boolean;
}

export type CalendarLayout = 'year' | 'month';
const addDays = (date: Date, count: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
const dateFromKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
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

export function CalendarView({ data, onOpenNote, layout: controlledLayout, onLayoutChange, anchor, onAnchorChange, embedded = false }: CalendarViewProps) {
  const { isEnabled } = usePlugins();
  const [internalLayout, setInternalLayout] = useState<CalendarLayout>('month');
  const [field, setField] = useState<DateField>('updatedAt');
  const [internalCursor, setInternalCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<DayBlockId | null>(null);
  const layout = controlledLayout ?? internalLayout;
  const cursor = useMemo(() => anchor ? dateFromKey(anchor) : internalCursor, [anchor, internalCursor]);
  const setLayout = (next: CalendarLayout) => {
    setInternalLayout(next);
    onLayoutChange?.(next);
  };
  const setCursor = (next: Date | ((current: Date) => Date)) => {
    const value = typeof next === 'function' ? next(cursor) : next;
    setInternalCursor(value);
    onAnchorChange?.(dayKey(value));
  };
  const today = useMemo(() => new Date(), []);
  const routinesEnabled = isEnabled(ROUTINES_PLUGIN_ID);
  const informationEnabled = isEnabled(INFORMATION_INTAKE_PLUGIN_ID);
  const hobbiesEnabled = isEnabled(HOBBY_PRACTICE_PLUGIN_ID);
  const musicEnabled = isEnabled(MUSIC_PRACTICE_PLUGIN_ID);
  const electronicsEnabled = isEnabled(ELECTRONICS_LAB_PLUGIN_ID);
  const homelabEnabled = isEnabled(HOMELAB_OPERATIONS_PLUGIN_ID);
  const styleEnabled = isEnabled(STYLE_STUDIO_PLUGIN_ID);
  const ttrpgEnabled = isEnabled(TTRPG_SESSIONS_PLUGIN_ID);
  const businessEnabled = isEnabled(BUSINESS_OBLIGATIONS_PLUGIN_ID) || isEnabled(BUSINESS_OPERATIONS_PLUGIN_ID);
  const enabledLifeConfigs = [...LIFE_PLUGIN_CONFIGS, ...DOMAIN_COLLECTION_CONFIGS].filter((config) => config.schedule && isEnabled(config.id));

  const byDay = useMemo(() => {
    const map = new Map<string, CoreNote[]>();
    for (const note of data.notes) {
      const date = noteDate(note, field);
      if (!date) continue;
      const key = dayKey(date);
      const list = map.get(key);
      if (list) list.push(note);
      else map.set(key, [note]);
    }
    return map;
  }, [data.notes, field]);

  const days = useMemo(() => layout === 'month' ? monthGrid(cursor.getFullYear(), cursor.getMonth()) : [], [layout, cursor]);
  const months = useMemo(() => yearGrid(cursor.getFullYear()), [cursor]);
  const title = useMemo(() => {
    if (layout === 'year') return String(cursor.getFullYear());
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [layout, cursor]);

  const shift = (direction: number) => setCursor((current) => {
    if (layout === 'year') return new Date(current.getFullYear() + direction, 0, 1);
    return new Date(current.getFullYear(), current.getMonth() + direction, 1);
  });
  const openDay = (date: Date) => { setSelected(date); setSelectedBlock(null); onAnchorChange?.(dayKey(date)); };
  const closeDay = () => { setSelected(null); setSelectedBlock(null); };
  const goToday = () => { const date = new Date(); setCursor(date); openDay(date); };
  const moveSelection = (delta: number) => {
    const next = addDays(selected ?? today, delta);
    openDay(next);
    if (layout === 'year' && next.getFullYear() !== cursor.getFullYear()) setCursor(new Date(next.getFullYear(), 0, 1));
    if (layout === 'month' && next.getMonth() !== cursor.getMonth()) setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in deltas) { event.preventDefault(); moveSelection(deltas[event.key]); }
  };

  const planner = (date: Date) => (
    <DayPlannerPopover
      date={date}
      dayNotes={byDay.get(dayKey(date)) ?? []}
      data={data}
      onOpenNote={onOpenNote}
      blockId={selectedBlock}
      onSelectBlock={setSelectedBlock}
      routinesEnabled={routinesEnabled}
      informationEnabled={informationEnabled}
      hobbiesEnabled={hobbiesEnabled}
      musicEnabled={musicEnabled}
      electronicsEnabled={electronicsEnabled}
      homelabEnabled={homelabEnabled}
      styleEnabled={styleEnabled}
      ttrpgEnabled={ttrpgEnabled}
      businessEnabled={businessEnabled}
      lifeConfigs={enabledLifeConfigs}
    />
  );

  return (
    <div className={cn('flex min-h-0 flex-1 animate-fade-in flex-col overflow-hidden bg-background', !embedded && 'min-w-0')}>
      <header className="flex h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-[8rem] text-sm font-medium tabular-nums">{title}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next"><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Segmented value={field} onChange={setField} options={[['updatedAt', 'Updated'], ['createdAt', 'Created']] as const} />
          {!embedded && <Segmented value={layout} onChange={setLayout} options={[['year', 'Year'], ['month', 'Month']] as const} />}
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden p-3" role="grid" tabIndex={0} onKeyDown={onKeyDown}>
        {layout === 'year' ? (
          <ScrollArea className="flex-1">
            <div className="grid gap-3 pb-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {months.map((monthDays, month) => (
                <section key={month} className="rounded-md border border-border p-2">
                  <button type="button" className="mb-2 text-sm font-medium hover:text-primary" onClick={() => { setCursor(new Date(cursor.getFullYear(), month, 1)); setLayout('month'); }}>{MONTH_NAMES[month]}</button>
                  <div className="grid grid-cols-7 gap-px">
                    {WEEKDAY_SHORT.map((weekday) => <span key={weekday} className="pb-1 text-center text-[9px] font-medium text-muted-foreground">{weekday.slice(0, 1)}</span>)}
                    {monthDays.map((date) => {
                      if (date.getMonth() !== month) return <span key={dayKey(date)} className="h-6" />;
                      const dayNotes = byDay.get(dayKey(date)) ?? [];
                      const isSelected = selected != null && sameDay(date, selected);
                      return <Popover key={dayKey(date)} open={isSelected} onOpenChange={(open) => { if (!open && isSelected) closeDay(); }}>
                        <PopoverAnchor asChild><button type="button" onClick={() => openDay(date)} className={cn('relative flex h-6 items-center justify-center rounded text-[10px] hover:bg-muted', sameDay(date, today) && 'bg-primary font-semibold text-primary-foreground', isSelected && 'ring-2 ring-ring')} aria-label={`Open planner for ${dayKey(date)}`}>{date.getDate()}{dayNotes.length > 0 && <span className="absolute bottom-0.5 size-1 rounded-full bg-current opacity-60" />}</button></PopoverAnchor>
                        <PopoverContent className="w-96 p-0" align="start">{planner(date)}</PopoverContent>
                      </Popover>;
                    })}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-7 border-b border-border pb-1.5">{WEEKDAY_SHORT.map((weekday) => <div key={weekday} className="px-1 text-xxs font-medium uppercase tracking-wide text-muted-foreground">{weekday}</div>)}</div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-y-auto pt-px">
              {days.map((date) => {
                const dayNotes = byDay.get(dayKey(date)) ?? [];
                const inMonth = date.getMonth() === cursor.getMonth();
                const isSelected = selected != null && sameDay(date, selected);
                const max = 3;
                return <Popover key={dayKey(date)} open={isSelected} onOpenChange={(open) => { if (!open && isSelected) closeDay(); }}>
                  <PopoverAnchor asChild><div role="gridcell" onClick={() => openDay(date)} className={cn('flex min-h-0 flex-col gap-1 rounded-md border p-1.5 transition-colors hover:bg-surface', inMonth ? 'bg-surface/40' : 'bg-transparent', isSelected ? 'border-border-strong ring-1 ring-ring' : 'border-transparent')}>
                    <div className="flex items-center justify-between"><span className={cn('inline-flex size-5 items-center justify-center rounded-full text-xxs tabular-nums', sameDay(date, today) ? 'bg-primary font-semibold text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/50')}>{date.getDate()}</span>{dayNotes.length > 0 && <span className="text-xxs tabular-nums text-muted-foreground">{dayNotes.length}</span>}</div>
                    <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">{dayNotes.slice(0, max).map((note) => <button key={note.id} type="button" onClick={(event) => { event.stopPropagation(); onOpenNote(note.id); }} title={note.title || 'Untitled'} className="truncate rounded bg-primary/10 px-1 py-0.5 text-left text-xxs text-foreground hover:bg-primary/20">{note.title || 'Untitled'}</button>)}{dayNotes.length > max && <span className="px-1 text-xxs text-muted-foreground">+{dayNotes.length - max} more</span>}</div>
                  </div></PopoverAnchor>
                  <PopoverContent className="w-96 p-0" align="start">{planner(date)}</PopoverContent>
                </Popover>;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DayPlannerPopover({ date, dayNotes, data, onOpenNote, blockId, onSelectBlock, routinesEnabled, informationEnabled, hobbiesEnabled, musicEnabled, electronicsEnabled, homelabEnabled, styleEnabled, ttrpgEnabled, businessEnabled, lifeConfigs }: { date: Date; dayNotes: CoreNote[]; data: WorkspaceData; onOpenNote: (id: number) => void; blockId: DayBlockId | null; onSelectBlock: (id: DayBlockId | null) => void; routinesEnabled: boolean; informationEnabled: boolean; hobbiesEnabled: boolean; musicEnabled: boolean; electronicsEnabled: boolean; homelabEnabled: boolean; styleEnabled: boolean; ttrpgEnabled: boolean; businessEnabled: boolean; lifeConfigs: LifePluginConfig[] }) {
  const [para] = useParaStore();
  const [meals] = useMealPlannerStore();
  const [workouts] = useWorkoutPlannerStore();
  const [education] = useEducationStore();
  const [routines] = useRoutinesStore();
  const [information] = useInformationIntakeStore();
  const [hobbies] = useHobbyStore();
  const [music] = useMusicStore();
  const [electronics] = useElectronicsStore();
  const [homelab] = useHomelabStore();
  const [wardrobe] = useWardrobeStore();
  const [ttrpg] = useTtrpgStore();
  const [business] = useBusinessAdminStore();
  const lifeCollections = useLifeCollections(lifeConfigs.map((config) => config.id));
  const dateId = dayKey(date);
  const dailyNote = findDailyNote(data.notes, dateId);
  const body = dailyNote?.markdownContent ?? dailyNote?.content ?? '';
  const overview = calendarBlockOverview(
    dateId,
    body,
    para,
    meals,
    workouts,
    education,
    routinesEnabled ? routines : undefined,
    lifeConfigs.map((config) => ({ config, data: lifeCollections[config.id] })),
    informationEnabled ? information : undefined,
    hobbiesEnabled ? hobbies : undefined,
    musicEnabled ? music : undefined,
    electronicsEnabled ? electronics : undefined,
    homelabEnabled ? homelab : undefined,
    styleEnabled ? wardrobe : undefined,
    ttrpgEnabled ? ttrpg : undefined,
    businessEnabled ? business : undefined,
  );
  const selectedBlock = DAY_BLOCKS.find((block) => block.id === blockId);
  const openDayNote = async () => {
    const note = dailyNote ?? await data.createNote(dateId, dailyTemplate(dateId));
    if (note) onOpenNote(note.id);
  };

  if (selectedBlock) {
    const items = overview[selectedBlock.id];
    return <div>
      <header className={cn('border-b border-l-4 border-border p-3', BLOCK_STYLE[selectedBlock.id])}>
        <button type="button" onClick={() => onSelectBlock(null)} className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Day overview</button>
        <div className="flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{selectedBlock.label}</h3><span className="font-mono text-xs text-muted-foreground">{selectedBlock.start}–{selectedBlock.end}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{selectedBlock.taskTypes}</p>
      </header>
      <ScrollArea className="max-h-80">
        {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nothing assigned to this block.</p> : <ul className="divide-y divide-border">{items.map((item) => <li key={`${item.source}-${item.id}`} className="flex items-start gap-2 px-3 py-2"><span className={cn('mt-0.5 text-sm', item.done && 'text-muted-foreground')}>{item.done ? '☑' : '☐'}</span><div className="min-w-0 flex-1"><p className={cn('truncate text-sm', item.done && 'text-muted-foreground line-through')}>{item.title}</p>{item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}</div><span className="rounded bg-muted px-1.5 py-0.5 text-xxs text-muted-foreground">{item.source}</span></li>)}</ul>}
      </ScrollArea>
    </div>;
  }

  const total = Object.values(overview).reduce((sum, items) => sum + items.length, 0);
  return <div>
    <header className="flex items-center gap-2 border-b border-border p-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3><p className="text-xs text-muted-foreground">{total} blocked item{total === 1 ? '' : 's'} · {dayNotes.length} calendar note{dayNotes.length === 1 ? '' : 's'}</p></div><Button size="icon-sm" variant="ghost" onClick={() => void openDayNote()} aria-label={dailyNote ? 'Open day note' : 'Create day note'}><NotebookPen className="size-4" /></Button></header>
    <ScrollArea className="max-h-96"><div className="space-y-1.5 p-2">{DAY_BLOCKS.map((block) => {
      const items = overview[block.id];
      return <button key={block.id} type="button" onClick={() => onSelectBlock(block.id)} className={cn('flex w-full items-center gap-2 rounded-md border border-l-4 border-border px-2.5 py-2 text-left hover:border-border-strong', BLOCK_STYLE[block.id])}><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{block.label}</p><p className="font-mono text-xxs text-muted-foreground">{block.start}–{block.end}</p></div><span className="text-xs text-muted-foreground">{items.length}</span><ChevronRight className="size-3.5 text-muted-foreground" /></button>;
    })}</div></ScrollArea>
  </div>;
}

// Zeiterfassung view (#365): a running timer bound to an engagement, manual
// entries, per-engagement billable totals, and the handoff that copies
// unbilled entries as ```invoice line rows and marks them billed. A tab in
// the Business hub.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Play, Square, Timer, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { engagementsIn } from './auditReport';
import { formatEur } from './invoicing';
import {
  entryAmountEur,
  formatMinutes,
  markBilled,
  newEntryId,
  readEntries,
  summarizeByEngagement,
  toInvoiceLines,
  unbilledFor,
  writeEntries,
  type TimeEntry,
} from './timeTracking';

const DEFAULT_RATE = 150;

export function TimeTrackingView({ data }: WorkspaceViewProps) {
  const { toast } = useToast();
  const engagements = useMemo(() => engagementsIn(data.notes), [data.notes]);

  const [entries, setEntries] = useState<TimeEntry[]>(() => readEntries());
  const persist = (next: TimeEntry[]) => {
    setEntries(next);
    writeEntries(next);
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [engagement, setEngagement] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt != null) {
      tickRef.current = setInterval(() => forceTick((n) => n + 1), 30_000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [startedAt]);

  const stopTimer = () => {
    if (startedAt == null) return;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    persist([
      {
        id: newEntryId(),
        date: new Date().toISOString().slice(0, 10),
        engagement,
        description: description || 'Work session',
        minutes,
        rateEur: Number(rate) || 0,
        billable: (Number(rate) || 0) > 0,
        billed: false,
      },
      ...entries,
    ]);
    setStartedAt(null);
    setDescription('');
  };

  const addManual = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    persist([
      {
        id: newEntryId(),
        date: new Date().toISOString().slice(0, 10),
        engagement,
        description: description || 'Work',
        minutes,
        rateEur: Number(rate) || 0,
        billable: (Number(rate) || 0) > 0,
        billed: false,
      },
      ...entries,
    ]);
    setDescription('');
  };

  const [manualMinutes, setManualMinutes] = useState('');

  const summaries = useMemo(() => summarizeByEngagement(entries), [entries]);
  const runningMinutes = startedAt != null ? Math.max(0, Math.round((Date.now() - startedAt) / 60_000)) : 0;

  const copyInvoiceLines = async (eng: string) => {
    const unbilled = unbilledFor(entries, eng);
    if (unbilled.length === 0) return;
    const lines = toInvoiceLines(unbilled);
    try {
      await navigator.clipboard.writeText(lines);
    } catch {
      // Clipboard unavailable — still mark billed? No: bail out untouched.
      toast({ variant: 'destructive', title: 'Clipboard unavailable', description: 'Entries were not marked billed.' });
      return;
    }
    persist(markBilled(entries, new Set(unbilled.map((e) => e.id))));
    toast({
      title: `${unbilled.length} entr${unbilled.length === 1 ? 'y' : 'ies'} copied as invoice lines`,
      description: 'Paste into a ```invoice fence. Entries are now marked billed.',
    });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Time</h2>
          <select
            value={engagement}
            onChange={(e) => setEngagement(e.target.value)}
            aria-label="Engagement"
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
          >
            <option value="">(unassigned)</option>
            {engagements.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you working on?"
            className="h-8 w-56 text-sm"
          />
          <Input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-label="Hourly rate (EUR)"
            className="h-8 w-20 text-sm"
            placeholder="€/h"
          />
          {startedAt == null ? (
            <Button size="sm" onClick={() => setStartedAt(Date.now())}>
              <Play className="size-4" aria-hidden="true" />
              Start
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stopTimer}>
              <Square className="size-4" aria-hidden="true" />
              Stop ({formatMinutes(runningMinutes)})
            </Button>
          )}
          <span className="mx-1 text-xs text-muted-foreground">or</span>
          <Input
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addManual(Number(manualMinutes));
                setManualMinutes('');
              }
            }}
            placeholder="min"
            aria-label="Manual minutes"
            className="h-8 w-16 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              addManual(Number(manualMinutes));
              setManualMinutes('');
            }}
          >
            Log
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Timer className="size-5" />}
            title="No time logged yet"
            description="Start the timer against an engagement, or log minutes manually. Unbilled time converts to invoice lines."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {summaries.map((s) => {
            const list = entries.filter((e) => (e.engagement || '(unassigned)') === s.engagement);
            return (
              <section key={s.engagement} className="rounded-md border border-border">
                <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
                  <span className="text-sm font-medium">{s.engagement}</span>
                  <span className="text-xs text-muted-foreground">{formatMinutes(s.minutes)} total</span>
                  {s.billableUnbilledMinutes > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        unbilled {formatMinutes(s.billableUnbilledMinutes)} · {formatEur(s.unbilledEur)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => void copyInvoiceLines(s.engagement === '(unassigned)' ? '' : s.engagement)}
                      >
                        <Copy className="size-4" aria-hidden="true" />
                        Copy invoice lines
                      </Button>
                    </>
                  )}
                </header>
                <ul className="divide-y divide-border/60">
                  {list.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{e.date}</span>
                      <span className="min-w-0 flex-1 truncate">{e.description}</span>
                      <span className="tabular-nums text-xs">{formatMinutes(e.minutes)}</span>
                      {e.billable ? (
                        <span className="w-20 text-right tabular-nums text-xs">{formatEur(entryAmountEur(e))}</span>
                      ) : (
                        <span className="w-20 text-right text-xs text-muted-foreground">n/b</span>
                      )}
                      <span
                        className={
                          e.billed
                            ? 'rounded-full border border-emerald-500/40 px-1.5 text-xxs text-emerald-600 dark:text-emerald-400'
                            : e.billable
                              ? 'rounded-full border border-amber-500/40 px-1.5 text-xxs text-amber-600 dark:text-amber-400'
                              : 'rounded-full border border-border px-1.5 text-xxs text-muted-foreground'
                        }
                      >
                        {e.billed ? 'billed' : e.billable ? 'unbilled' : 'internal'}
                      </span>
                      <button
                        type="button"
                        aria-label="Delete entry"
                        onClick={() => persist(entries.filter((x) => x.id !== e.id))}
                        className="text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

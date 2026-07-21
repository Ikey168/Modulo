// Timeline - notes as a chronological stream, grouped by day, week, or month.
// Group by updated or created date, filter by tag, and open an entry to edit it.
import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import {
  EmptyState,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@/ui';
import type { CoreNote, CoreTag } from '@modulo/core';
import { relativeTime } from './workspaceUtils';
import { Segmented } from './Segmented';
import { groupByPeriod, noteDate, type DateField, type Period } from './noteDates';

interface TimelineViewProps {
  notes: CoreNote[];
  tags: CoreTag[];
  loading?: boolean;
  onOpenNote: (id: number) => void;
}

function snippetOf(n: CoreNote): string {
  return (n.markdownContent ?? n.content ?? '')
    .replace(/[#>*`~[\]()_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function TimelineView({ notes, tags, loading = false, onOpenNote }: TimelineViewProps) {
  const [field, setField] = useState<DateField>('updatedAt');
  const [period, setPeriod] = useState<Period>('day');
  const [tag, setTag] = useState<string>(''); // '' = all tags

  const tagNames = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags ?? []) set.add(t.name);
    for (const t of tags) set.add(t.name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [notes, tags]);

  const filtered = useMemo(
    () => (tag ? notes.filter((n) => (n.tags ?? []).some((t) => t.name === tag)) : notes),
    [notes, tag],
  );
  const groups = useMemo(() => groupByPeriod(filtered, field, period), [filtered, field, period]);

  return (
    <div className="flex flex-1 animate-fade-in flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3">
        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">Timeline</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Select value={tag || 'all'} onValueChange={(v) => setTag(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tagNames.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            value={field}
            onChange={setField}
            options={[['updatedAt', 'Updated'], ['createdAt', 'Created']] as const}
          />
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']] as const}
          />
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          {loading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : (
            <EmptyState
              icon={<History className="size-5" />}
              title="Nothing on the timeline"
              description={tag ? 'No notes carry this tag yet.' : 'Create notes to see them here in chronological order.'}
            />
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-4">
            {groups.map((g) => (
              <section key={g.key} className="mb-3">
                <h3 className="sticky top-0 z-10 bg-background/90 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
                  {g.label}
                  <span className="ml-1.5 font-normal text-muted-foreground">{g.notes.length}</span>
                </h3>
                <ol className="relative ml-2 border-l border-border">
                  {g.notes.map((n) => {
                    const d = noteDate(n, field);
                    const snippet = snippetOf(n);
                    return (
                      <li key={n.id} className="relative pb-2.5 pl-5">
                        <span
                          className="absolute left-0 top-3 size-2 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          onClick={() => onOpenNote(n.id)}
                          className="block w-full rounded-md border border-border bg-surface/50 p-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{n.title || 'Untitled'}</span>
                            <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">
                              {d ? relativeTime(d.toISOString()) : ''}
                            </span>
                          </div>
                          {snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{snippet}</p>}
                          {(n.tags ?? []).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(n.tags ?? []).slice(0, 4).map((t) => (
                                <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 text-xxs text-muted-foreground">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

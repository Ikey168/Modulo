// Findings dashboard (#358): every parseable ```finding fence across the vault,
// filterable by severity, status, and engagement tag. Lives as a tab in the
// Audit hub. Clicking a row opens the containing note.
import { useMemo, useState } from 'react';
import { Bug } from 'lucide-react';
import { cn, EmptyState } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { SeverityBadge, StatusChip } from './FindingCard';
import {
  countBySeverity,
  extractFindings,
  SEVERITIES,
  sortBySeverity,
  STATUSES,
  type FindingSeverity,
  type FindingStatus,
} from './findings';

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function FindingsView({ data, onOpenNote }: WorkspaceViewProps) {
  const [severity, setSeverity] = useState<FindingSeverity | 'all'>('all');
  const [status, setStatus] = useState<FindingStatus | 'all'>('all');
  const [engagement, setEngagement] = useState<string | 'all'>('all');

  const all = useMemo(() => extractFindings(data.notes), [data.notes]);
  const engagements = useMemo(
    () => [...new Set(all.flatMap((f) => f.engagements))].sort(),
    [all],
  );

  const filtered = useMemo(
    () =>
      sortBySeverity(
        all.filter(
          (f) =>
            (severity === 'all' || f.finding.severity === severity) &&
            (status === 'all' || f.finding.status === status) &&
            (engagement === 'all' || f.engagements.includes(engagement)),
        ),
      ),
    [all, severity, status, engagement],
  );

  const counts = useMemo(() => countBySeverity(all), [all]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Findings</h2>
          <FilterChip active={severity === 'all'} label={`all (${all.length})`} onClick={() => setSeverity('all')} />
          {SEVERITIES.map((s) => (
            <FilterChip
              key={s}
              active={severity === s}
              label={`${s} (${counts[s]})`}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xxs uppercase tracking-wide text-muted-foreground">Status</span>
          <FilterChip active={status === 'all'} label="all" onClick={() => setStatus('all')} />
          {STATUSES.map((s) => (
            <FilterChip key={s} active={status === s} label={s} onClick={() => setStatus(status === s ? 'all' : s)} />
          ))}
          {engagements.length > 0 && (
            <>
              <span className="ml-2 text-xxs uppercase tracking-wide text-muted-foreground">Engagement</span>
              <FilterChip active={engagement === 'all'} label="all" onClick={() => setEngagement('all')} />
              {engagements.map((e) => (
                <FilterChip
                  key={e}
                  active={engagement === e}
                  label={e.replace(/^engagement\//, '')}
                  onClick={() => setEngagement(engagement === e ? 'all' : e)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Bug className="size-5" />}
            title={all.length === 0 ? 'No findings yet' : 'No findings match the filters'}
            description={
              all.length === 0
                ? 'Add a ```finding fence to any note — findings across all engagements appear here.'
                : 'Relax a filter to see more findings.'
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((f, i) => (
            <li key={`${f.noteId}-${f.finding.id || i}`}>
              <button
                type="button"
                onClick={() => onOpenNote(f.noteId)}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <SeverityBadge severity={f.finding.severity} />
                {f.finding.id && <span className="font-mono text-xs text-muted-foreground">{f.finding.id}</span>}
                <span className="min-w-0 flex-1 truncate text-sm">{f.finding.title}</span>
                <StatusChip status={f.finding.status} />
                <span className="w-full pl-0 text-xs text-muted-foreground sm:w-auto">
                  {[f.finding.contract, f.noteTitle].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

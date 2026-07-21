// Renders one ```finding fence as a structured card (#358): severity badge,
// status chip, meta line, and the markdown body as prose. Malformed source
// renders a helpful error card and never crashes the note.
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/ui';
import {
  isParseError,
  parseFinding,
  type Finding,
  type FindingSeverity,
  type FindingStatus,
} from './findings';

export const SEVERITY_BADGE: Record<FindingSeverity, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  informational: 'bg-muted text-muted-foreground',
};

export const STATUS_CHIP: Record<FindingStatus, string> = {
  open: 'border-red-500/40 text-red-600 dark:text-red-400',
  acknowledged: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  fixed: 'border-blue-500/40 text-blue-600 dark:text-blue-400',
  verified: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
};

export function SeverityBadge({ severity, className }: { severity: FindingSeverity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xxs font-semibold uppercase tracking-wide',
        SEVERITY_BADGE[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}

export function StatusChip({ status, className }: { status: FindingStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xxs font-medium capitalize',
        STATUS_CHIP[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

function Meta({ finding }: { finding: Finding }) {
  const parts = [finding.contract, finding.location, finding.vulnClass].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="text-xs text-muted-foreground">{parts.join(' · ')}</div>;
}

export function FindingCard({ source }: { source: string }) {
  const parsed = parseFinding(source);

  if (isParseError(parsed)) {
    return (
      <div className="my-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-medium">Invalid finding block</div>
          <div className="text-xs opacity-90">{parsed.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={parsed.severity} />
        {parsed.id && <span className="font-mono text-xs text-muted-foreground">{parsed.id}</span>}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{parsed.title}</span>
        <StatusChip status={parsed.status} />
      </div>
      <div className="mt-1.5 space-y-1.5">
        <Meta finding={parsed} />
        {parsed.body && <div className="whitespace-pre-wrap text-sm text-foreground/90">{parsed.body}</div>}
        {parsed.response && (
          <div className="rounded bg-muted/50 px-2 py-1.5 text-xs">
            <span className="font-medium">Client response:</span> {parsed.response}
          </div>
        )}
      </div>
    </div>
  );
}

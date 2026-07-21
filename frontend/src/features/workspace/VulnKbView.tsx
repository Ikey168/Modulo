// Vulnerability knowledge base view (#360): every finding class across the
// vault as an expandable cluster — severity mix, engagement spread, writeup
// link, and the findings themselves. Lives as a tab in the Audit hub.
import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { cn, EmptyState } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { SeverityBadge, StatusChip } from './FindingCard';
import { classStats } from './vulnKb';
import { SEVERITIES } from './findings';

export function VulnKbView({ data, onOpenNote }: WorkspaceViewProps) {
  const stats = useMemo(() => classStats(data.notes), [data.notes]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const toggle = (cls: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });

  if (stats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="No classified findings yet"
          description="Give findings a class: vuln/<name> header and they cluster here — across every engagement you have ever audited."
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Vulnerability knowledge base</h2>
        <p className="text-xs text-muted-foreground">
          {stats.length} classes across {stats.reduce((n, s) => n + s.findings.length, 0)} findings. Tag a note{' '}
          <span className="font-mono">vuln/&lt;class&gt;</span> to make it the class writeup.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {stats.map((s) => {
          const expanded = open.has(s.cls);
          const engagements = [...new Set(s.findings.flatMap((f) => f.engagements))];
          return (
            <li key={s.cls}>
              <button
                type="button"
                onClick={() => toggle(s.cls)}
                aria-expanded={expanded}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {expanded ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="font-mono text-sm font-medium">{s.cls}</span>
                <span className="text-xs text-muted-foreground">{s.findings.length}×</span>
                <span className="flex flex-wrap gap-1">
                  {SEVERITIES.filter((sev) => s.bySeverity[sev]).map((sev) => (
                    <SeverityBadge key={sev} severity={sev} className="text-[10px]" />
                  ))}
                </span>
                {engagements.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {engagements.length} engagement{engagements.length === 1 ? '' : 's'}
                  </span>
                )}
                <span className="ml-auto text-xs">
                  {s.writeupNoteId != null ? (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNote(s.writeupNoteId!);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          onOpenNote(s.writeupNoteId!);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      {s.writeupNoteTitle}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">no writeup yet</span>
                  )}
                </span>
              </button>
              {expanded && (
                <ul className="border-t border-border/60 bg-muted/20">
                  {s.findings.map((f, i) => (
                    <li key={`${f.noteId}-${f.finding.id || i}`}>
                      <button
                        type="button"
                        onClick={() => onOpenNote(f.noteId)}
                        className={cn(
                          'flex w-full flex-wrap items-center gap-2 py-2 pl-12 pr-4 text-left transition-colors',
                          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        )}
                      >
                        <SeverityBadge severity={f.finding.severity} />
                        <span className="min-w-0 flex-1 truncate text-sm">{f.finding.title}</span>
                        <StatusChip status={f.finding.status} />
                        <span className="text-xs text-muted-foreground">{f.noteTitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

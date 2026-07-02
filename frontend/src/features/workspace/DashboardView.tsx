import { useEffect, useMemo, useState } from 'react';
import { Plus, Store, FileText, ArrowRight } from 'lucide-react';
import type { CoreNote } from '@modulo/core';
import { Badge, Button, Separator, Skeleton, cn } from '@/ui';
import { isAnchored, relativeTime } from './workspaceUtils';
import { PLUGINS } from './plugins';
import { listBlueprints, type BlueprintListItem } from '../blueprint/blueprintService';

interface DashboardViewProps {
  notes: CoreNote[];
  installedPlugins: Set<string>;
  walletAddress?: string;
  onOpenNote: (id: number) => void;
  onOpenBlueprints: () => void;
  onOpenMarketplace: () => void;
}

/** Flat uppercase section rule: `WORKFLOWS ───────────` with an optional right slot. */
function SectionRule({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="font-mono text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <Separator className="flex-1" />
      {right}
    </div>
  );
}

interface ActivityEvent {
  at: number;
  kind: 'workflow' | 'note' | 'anchor';
  text: string;
  onClick?: () => void;
}

export function DashboardView({ notes, installedPlugins, walletAddress, onOpenNote, onOpenBlueprints, onOpenMarketplace }: DashboardViewProps) {
  const [workflows, setWorkflows] = useState<BlueprintListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBlueprints()
      .then((list) => {
        if (!cancelled) setWorkflows(list);
      })
      .catch(() => {
        if (!cancelled) setWorkflows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anchoredCount = useMemo(() => notes.filter(isAnchored).length, [notes]);

  // Presentational activity log synthesized from what the client knows:
  // workflow updates, note saves, and on-chain anchors, newest first.
  const activity = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];
    (workflows ?? []).forEach((w) => {
      events.push({
        at: new Date(w.updatedAt).getTime(),
        kind: 'workflow',
        text: `workflow updated · ${w.name}`,
        onClick: onOpenBlueprints,
      });
    });
    notes.forEach((n) => {
      const at = new Date(n.updatedAt ?? 0).getTime();
      events.push({ at, kind: 'note', text: `note saved · ${n.title}`, onClick: () => onOpenNote(n.id) });
      if (isAnchored(n)) {
        events.push({ at, kind: 'anchor', text: `anchored on-chain · ${n.title}`, onClick: () => onOpenNote(n.id) });
      }
    });
    return events
      .filter((e) => Number.isFinite(e.at) && e.at > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, 9);
  }, [workflows, notes, onOpenBlueprints, onOpenNote]);

  const activePlugins = useMemo(
    () => [...installedPlugins].map((id) => PLUGINS.find((p) => p.id === id)?.name ?? id),
    [installedPlugins],
  );

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const DOT: Record<ActivityEvent['kind'], string> = {
    workflow: 'bg-primary',
    note: 'bg-info',
    anchor: 'bg-success',
  };

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto">
      <div className="mx-auto max-w-5xl p-5 md:px-10 md:py-10">
        {/* Masthead: date + inline mono stats instead of stat tiles. */}
        <header className="mb-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{today}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            </div>
            <Button size="sm" onClick={onOpenBlueprints}>
              <Plus className="size-4" />
              New workflow
            </Button>
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            <span className="text-primary-hover">{workflows?.length ?? '–'}</span> workflows ·{' '}
            <span className="text-foreground">{installedPlugins.size}</span> plugins ·{' '}
            <span className="text-foreground">{notes.length}</span> notes ·{' '}
            <span className={anchoredCount > 0 ? 'text-success' : undefined}>{anchoredCount}</span> anchored on-chain
          </p>
        </header>

        {/* Workflows: the centerpiece — full-width flat rows, no card chrome. */}
        <section className="mb-10" aria-label="Workflows">
          <SectionRule
            label="Workflows"
            right={
              <button
                type="button"
                onClick={onOpenBlueprints}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                open editor <ArrowRight className="size-3.5" />
              </button>
            }
          />
          {workflows === null && (
            <div className="flex flex-col gap-px">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
          {workflows !== null && workflows.length === 0 && (
            <button
              type="button"
              onClick={onOpenBlueprints}
              className="group flex w-full flex-col items-center gap-3 rounded-md border border-dashed border-border-strong px-6 py-12 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-mono text-sm text-muted-foreground">
                <span className="text-primary">$</span> create your first workflow
              </span>
              <span className="max-w-md text-xs text-muted-foreground">
                Automate your workspace — summarize notes on save, tag them, anchor them on-chain.
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-hover group-hover:underline">
                Open the editor <ArrowRight className="size-3.5" />
              </span>
            </button>
          )}
          {workflows !== null && workflows.length > 0 && (
            <ul className="divide-y divide-border">
              {workflows.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={onOpenBlueprints}
                    className="group flex w-full items-center gap-4 px-2 py-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="relative flex size-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{w.name}</span>
                      {w.description && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{w.description}</span>
                      )}
                    </span>
                    <span className="hidden shrink-0 font-mono text-xxs text-muted-foreground sm:block">v{w.version}</span>
                    <span className="w-16 shrink-0 text-right font-mono text-xxs text-muted-foreground">
                      {relativeTime(w.updatedAt)}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_260px]">
          {/* Activity: terminal-style log. */}
          <section aria-label="Recent activity">
            <SectionRule label="Activity" />
            {activity.length === 0 ? (
              <p className="px-2 font-mono text-xs text-muted-foreground">— no activity yet</p>
            ) : (
              <ul className="flex flex-col">
                {activity.map((e, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={e.onClick}
                      className="flex w-full items-baseline gap-3 rounded-sm px-2 py-1.5 text-left font-mono text-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="w-14 shrink-0 text-right text-muted-foreground/70">{relativeTime(new Date(e.at).toISOString())}</span>
                      <span className={cn('mt-px size-1.5 shrink-0 self-center rounded-full', DOT[e.kind])} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-subtle-foreground">{e.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right rail: system state, flat. */}
          <aside className="flex flex-col gap-8">
            <section aria-label="Plugins">
              <SectionRule
                label="Plugins"
                right={
                  <button
                    type="button"
                    onClick={onOpenMarketplace}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Store className="size-3.5" /> browse
                  </button>
                }
              />
              {activePlugins.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">No plugins installed.</p>
              ) : (
                <ul className="flex flex-col gap-2 px-2">
                  {activePlugins.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-subtle-foreground">{name}</span>
                      <Badge variant="success" className="shrink-0">active</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Wallet">
              <SectionRule label="Wallet" />
              <p className={cn('px-2 font-mono text-xs', walletAddress ? 'text-subtle-foreground' : 'text-muted-foreground')}>
                {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'not connected'}
              </p>
            </section>

            <section aria-label="Notes">
              <SectionRule label="Notes" />
              {notes.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="flex flex-col gap-1 px-2">
                  {[...notes]
                    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
                    .slice(0, 4)
                    .map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onOpenNote(n.id)}
                          className="flex w-full items-center gap-2 rounded-sm py-1 text-left text-xs text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{n.title}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

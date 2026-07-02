import { useEffect, useMemo, useState } from 'react';
import { Workflow, Plus } from 'lucide-react';
import type { CoreNote } from '@modulo/core';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, cn } from '@/ui';
import { SectionLabel } from './atoms';
import { isAnchored, relativeTime } from './workspaceUtils';
import { PLUGINS } from './plugins';
import { listBlueprints, type BlueprintListItem } from '../blueprint/blueprintService';

interface DashboardViewProps {
  notes: CoreNote[];
  installedPlugins: Set<string>;
  walletAddress?: string;
  onOpenNote: (id: number) => void;
  onOpenBlueprints: () => void;
}

export function DashboardView({ notes, installedPlugins, walletAddress, onOpenNote, onOpenBlueprints }: DashboardViewProps) {
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

  const recent = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
        .slice(0, 5),
    [notes],
  );

  const activeNames = useMemo(
    () => [...installedPlugins].map((id) => PLUGINS.find((p) => p.id === id)?.name ?? id),
    [installedPlugins],
  );

  const stats: Array<{ label: string; value: number; tone?: string }> = [
    { label: 'Workflows', value: workflows?.length ?? 0, tone: 'text-primary-hover' },
    { label: 'Plugins', value: installedPlugins.size },
    { label: 'Notes', value: notes.length },
    { label: 'On-Chain', value: notes.filter(isAnchored).length, tone: 'text-success' },
  ];

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto p-5 md:px-10 md:py-9">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground">Your automations at a glance</p>
        </div>
        <Button size="sm" onClick={onOpenBlueprints}>
          <Plus className="size-4" />
          New workflow
        </Button>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, tone }) => (
          <Card key={label} className="px-5 py-4">
            <SectionLabel className="mb-2.5">{label}</SectionLabel>
            <div className={cn('text-3xl font-semibold tracking-tight text-foreground', tone)}>{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <CardTitle className="text-[13px]">Workflows</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpenBlueprints}>
              Open editor
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {workflows === null && (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            )}
            {workflows !== null && workflows.length === 0 && (
              <EmptyState
                icon={<Workflow className="size-5" />}
                title="No workflows yet"
                description="Automate your workspace — summarize notes on save, tag them, anchor them on-chain."
                action={
                  <Button size="sm" onClick={onOpenBlueprints}>
                    Create your first workflow
                  </Button>
                }
                className="py-10"
              />
            )}
            {workflows !== null &&
              workflows.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={onOpenBlueprints}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Workflow className="size-4 shrink-0 text-primary-hover" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{w.name}</span>
                    {w.description && (
                      <span className="block truncate text-xxs text-muted-foreground">{w.description}</span>
                    )}
                  </span>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    v{w.version}
                  </Badge>
                  <span className="shrink-0 text-xxs text-muted-foreground">{relativeTime(w.updatedAt)}</span>
                </button>
              ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between border-b border-border px-5 py-4">
              <CardTitle className="text-[13px]">Active Plugins</CardTitle>
              <span className="text-xs font-semibold text-primary-hover">{installedPlugins.size}</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 px-5 py-4">
              {activeNames.length === 0 && <p className="text-xs text-muted-foreground">No plugins installed.</p>}
              {activeNames.map((name) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{name}</span>
                  <Badge variant="success">Active</Badge>
                </div>
              ))}
            </CardContent>
            <div className="border-t border-border px-5 py-3.5">
              <SectionLabel className="mb-2.5">Wallet</SectionLabel>
              {walletAddress ? (
                <div className="font-mono text-xs text-subtle-foreground">
                  {`${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No wallet connected</div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-[13px]">Recent Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {recent.length === 0 && <p className="p-3 text-xs text-muted-foreground">No notes yet.</p>}
              {recent.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onOpenNote(n.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', isAnchored(n) ? 'bg-success' : 'bg-border-strong')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{n.title}</span>
                  <span className="shrink-0 text-xxs text-muted-foreground">{relativeTime(n.updatedAt)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

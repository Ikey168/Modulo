import { useMemo } from 'react';
import type { CoreNote, CoreTag, CoreLink } from '@modulo/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@/ui';
import { SectionLabel } from './atoms';
import { isAnchored, relativeTime } from './workspaceUtils';
import { PLUGINS } from './plugins';

interface DashboardViewProps {
  notes: CoreNote[];
  links: CoreLink[];
  tags: CoreTag[];
  installedPlugins: Set<string>;
  walletAddress?: string;
  onOpenNote: (id: number) => void;
}

export function DashboardView({ notes, links, tags, installedPlugins, walletAddress, onOpenNote }: DashboardViewProps) {
  const totalTags = useMemo(() => {
    const names = new Set<string>();
    notes.forEach((n) => (n.tags ?? []).forEach((t) => names.add(t.name)));
    tags.forEach((t) => names.add(t.name));
    return names.size;
  }, [notes, tags]);

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
    { label: 'Notes', value: notes.length },
    { label: 'On-Chain', value: notes.filter(isAnchored).length, tone: 'text-success' },
    { label: 'Tags', value: totalTags },
    { label: 'Connections', value: links.length, tone: 'text-primary-hover' },
  ];

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto p-5 md:px-10 md:py-9">
      <header className="mb-7">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground">Your knowledge base at a glance</p>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, tone }) => (
          <Card key={label} className="px-5 py-4">
            <SectionLabel className="mb-2.5">{label}</SectionLabel>
            <div className={cn('text-3xl font-semibold tracking-tight text-foreground', tone)}>{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  );
}

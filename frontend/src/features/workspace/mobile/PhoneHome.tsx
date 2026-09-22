/**
 * The phone home screen.
 *
 * The desktop dashboard is a terminal broadsheet: a mono stat sentence, flat
 * section rules, a right rail of small print, and links drawn as 12px words
 * inside 16px-tall rows. Every one of those choices is right on a 1440px
 * display with a mouse, and wrong on a 360dp screen with a thumb — the rail
 * lands in a heap under the fold, the stats read as prose rather than numbers,
 * and half the controls are below any usable target size.
 *
 * So the phone gets its own home rather than a narrowed copy: what you have,
 * what you can do about it, and what you were last working on, in that order,
 * every row a real target.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Link2,
  Plus,
  Search,
  Store,
  Waypoints,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { CoreNote } from '@modulo/core';
import { Badge, Skeleton, cn } from '@/ui';
import { isAnchored, relativeTime } from '../workspaceUtils';
import { PLUGINS } from '../plugins';
import { listBlueprints, type BlueprintListItem } from '../../blueprint/blueprintService';
import { getRunSummary } from '../../executions/runService';

export interface PhoneHomeProps {
  notes: CoreNote[];
  installedPlugins: Set<string>;
  walletAddress?: string;
  userName?: string;
  onOpenNote: (id: number) => void;
  onNewNote: () => void;
  onOpenSearch: () => void;
  onOpenBlueprints: () => void;
  onOpenMarketplace: () => void;
  navigateView: (view: string) => void;
}

/** Morning / afternoon / evening, because a phone home says hello. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function PhoneHome({
  notes,
  installedPlugins,
  walletAddress,
  userName,
  onOpenNote,
  onNewNote,
  onOpenSearch,
  onOpenBlueprints,
  onOpenMarketplace,
  navigateView,
}: PhoneHomeProps) {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<BlueprintListItem[] | null>(null);
  const [runCount, setRunCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBlueprints()
      .then((list) => !cancelled && setWorkflows(list))
      .catch(() => !cancelled && setWorkflows([]));
    const controller = new AbortController();
    getRunSummary(controller.signal)
      .then((summary) => {
        if (!controller.signal.aborted) setRunCount(summary.counts.reduce((sum, row) => sum + Number(row.count), 0));
      })
      .catch(() => {
        // A workspace with no execution history is the normal case, not an error
        // worth a banner on the home screen.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const anchored = useMemo(() => notes.filter(isAnchored).length, [notes]);
  const recent = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
        .slice(0, 5),
    [notes],
  );
  const plugins = useMemo(
    () => [...installedPlugins].map((id) => PLUGINS.find((p) => p.id === id)?.name ?? id),
    [installedPlugins],
  );

  const firstName = userName?.trim().split(/\s+/)[0];

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-4">
        <header>
          <h2 className="text-[22px] font-semibold leading-tight tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </header>

        {/* What you have. Numbers as numbers, in targets you can actually hit. */}
        <section aria-label="Workspace at a glance" className="grid grid-cols-2 gap-2.5">
          <Stat label="Notes" value={notes.length} icon={FileText} onClick={() => navigateView('notes')} />
          <Stat
            label="On-chain"
            value={anchored}
            icon={Link2}
            tone={anchored > 0 ? 'success' : undefined}
            onClick={() => navigateView('notes')}
          />
          <Stat label="Workflows" value={workflows?.length ?? null} icon={Workflow} onClick={onOpenBlueprints} />
          <Stat label="Plugins" value={installedPlugins.size} icon={Store} onClick={onOpenMarketplace} />
        </section>

        {/* What you can do. A phone's primary actions belong on the home
            screen, not behind a menu the way a desktop toolbar can afford. */}
        <section aria-label="Quick actions" className="scroll-strip -mx-4 flex gap-2 px-4">
          <Action label="New note" icon={Plus} primary onClick={onNewNote} />
          <Action label="Search" icon={Search} onClick={onOpenSearch} />
          <Action label="Graph" icon={Waypoints} onClick={() => navigateView('graph')} />
          <Action label="Workflow" icon={Workflow} onClick={onOpenBlueprints} />
          <Action label="Plugins" icon={Store} onClick={onOpenMarketplace} />
        </section>

        <Section
          title="Jump back in"
          action={notes.length > 0 ? { label: 'All notes', onClick: () => navigateView('notes') } : undefined}
        >
          {recent.length === 0 ? (
            <Empty
              text="No notes yet. Your first one is a tap away."
              actionLabel="New note"
              onAction={onNewNote}
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border bg-surface">
              {recent.map((note, index) => (
                <li key={note.id} className={cn(index > 0 && 'border-t border-border')}>
                  <button
                    type="button"
                    onClick={() => onOpenNote(note.id)}
                    className="flex min-h-touch w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{note.title || 'Untitled'}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {relativeTime(note.updatedAt ?? note.createdAt ?? '')}
                        {note.tags?.length ? ` · ${note.tags.map((tag) => tag.name).join(', ')}` : ''}
                      </span>
                    </span>
                    {isAnchored(note) && (
                      <Badge variant="success" className="shrink-0">
                        chain
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Workflows"
          action={workflows?.length ? { label: 'Editor', onClick: onOpenBlueprints } : undefined}
        >
          {workflows === null ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : workflows.length === 0 ? (
            <Empty
              text="Automate the workspace — summarize notes on save, tag them, anchor them."
              actionLabel="Open the editor"
              onAction={onOpenBlueprints}
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border bg-surface">
              {workflows.slice(0, 4).map((workflow, index) => (
                <li key={workflow.id} className={cn(index > 0 && 'border-t border-border')}>
                  <button
                    type="button"
                    onClick={onOpenBlueprints}
                    className="flex min-h-touch w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{workflow.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        v{workflow.version} · {relativeTime(workflow.updatedAt)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Workspace"
          action={{ label: 'Marketplace', onClick: onOpenMarketplace }}
        >
          <dl className="overflow-hidden rounded-xl border border-border bg-surface text-sm">
            <Row term="Plugins" detail={plugins.length ? plugins.join(', ') : 'None installed'} />
            <Row
              term="Wallet"
              detail={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Not connected'}
              mono={Boolean(walletAddress)}
            />
            <Row
              term="Workflow runs"
              detail={runCount === null ? 'None retained' : `${runCount} retained`}
              onClick={runCount ? () => navigate('/app/executions') : undefined}
            />
          </dl>
        </Section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  tone?: 'success';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className={cn('font-mono text-2xl font-semibold leading-none', tone === 'success' ? 'text-success' : 'text-foreground')}>
        {value ?? '–'}
      </span>
    </button>
  );
}

function Action({
  label,
  icon: Icon,
  primary,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-touch shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        primary
          ? 'bg-primary text-primary-foreground active:opacity-80'
          : 'border border-border-strong bg-surface text-subtle-foreground active:bg-surface-2',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="-mr-2 flex min-h-touch items-center gap-1 px-2 text-[13px] font-medium text-primary transition-colors active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text, actionLabel, onAction }: { text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-center">
      <p className="text-[13px] text-muted-foreground">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-2 inline-flex min-h-touch items-center gap-1.5 px-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {actionLabel}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function Row({
  term,
  detail,
  mono,
  onClick,
}: {
  term: string;
  detail: string;
  mono?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd className={cn('min-w-0 flex-1 truncate text-right text-subtle-foreground', mono && 'font-mono text-xs')}>
        {detail}
      </dd>
    </>
  );
  const className =
    'flex min-h-touch items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0';
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, 'w-full text-left active:bg-surface-2')}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

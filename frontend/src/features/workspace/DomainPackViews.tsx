import { dayKey } from './noteDates';
import { ArrowRight, CalendarClock, CalendarDays, ClockAlert, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button } from '@/ui';
import { domainConfig, domainDefinition } from './domainConfigs';
import type { LifePluginConfig } from './lifeConfigs';
import type { LifeRecord } from './lifeStore';
import { useLifeCollections } from './useLifeCollection';
import type { WorkspaceViewProps } from './plugins/types';
import {
  EmptyPanel,
  ListRow,
  ListRows,
  Metric,
  MetricRow,
  Panel,
  StatusBadge,
  ViewShell,
  statusVariant,
  type MetricProps,
  type StatusVariant,
} from './viewkit';

/** A record paired with the collection config that defines its vocabulary. */
interface DomainEntry {
  config: LifePluginConfig;
  record: LifeRecord;
}

/**
 * Domain-pack statuses the shared status vocabulary does not already cover.
 * Used both for the badge tone and for the "needs attention" rule, so the two
 * never disagree — previously the filter was a regex over free text
 * (`/due|risk|fail|blocked|…/i`) that also matched "Not applicable".
 */
const DOMAIN_STATUS_TONES: Record<string, StatusVariant> = {
  'review due': 'warning',
  'renewal due': 'warning',
  'at risk': 'warning',
  'changes requested': 'warning',
  'waiting for feedback': 'warning',
  deferred: 'warning',
  partial: 'warning',
  maintenance: 'warning',
  recovering: 'warning',
  interviewing: 'info',
  applied: 'info',
  preparing: 'info',
  submitted: 'info',
  drafting: 'info',
  revising: 'info',
  queued: 'warning',
  ready: 'success',
  reproduced: 'success',
  contained: 'success',
  cited: 'success',
  extracted: 'success',
  'target met': 'success',
  cleared: 'success',
  current: 'success',
  published: 'success',
  stored: 'outline',
  shelved: 'outline',
  target: 'outline',
  inbox: 'info',
  reading: 'info',
};

/** A record is done when its own collection says the status means done. */
function isComplete(entry: DomainEntry): boolean {
  return entry.config.completedStatuses.includes(entry.record.status);
}

/** Open work that is either past its date or carries a warning/danger status. */
function needsAttention(entry: DomainEntry, today: string): boolean {
  if (isComplete(entry)) return false;
  if (entry.record.date && entry.record.date < today) return true;
  const tone = statusVariant(entry.record.status, DOMAIN_STATUS_TONES);
  return tone === 'warning' || tone === 'destructive';
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const count = (entries: DomainEntry[], predicate: (entry: DomainEntry) => boolean) =>
  entries.filter(predicate).length;

/**
 * The one metric that is specific to each domain. A lookup table rather than
 * the previous `if (domainId === …)` chain, so adding a domain is data.
 */
const DOMAIN_METRIC: Record<string, (entries: DomainEntry[]) => MetricProps> = {
  wealth: (entries) => {
    const value = (predicate: (entry: DomainEntry) => boolean) =>
      sum(entries.filter(predicate).map((entry) => entry.record.amount ?? 0));
    const liability = (entry: DomainEntry) => entry.record.category === 'Liability';
    const net = value((entry) => !liability(entry)) - value(liability);
    return {
      label: 'Tracked net value',
      value: net.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      detail: 'Assets minus liabilities',
      tone: net < 0 ? 'warning' : 'default',
    };
  },
  writing: (entries) => ({
    label: 'Tracked words',
    value: sum(entries.map((entry) => Number(entry.record.values.wordCount) || 0)).toLocaleString(),
    detail: 'Across all manuscripts',
  }),
  security: (entries) => ({
    label: 'Verified posture',
    value: count(entries, (entry) => ['Verified', 'Ready', 'Contained', 'Closed'].includes(entry.record.status)),
    detail: 'Verified, ready, contained or closed',
  }),
  evidence: (entries) => ({
    label: 'Supported claims',
    value: count(entries, (entry) => entry.record.category === 'Claim' && entry.record.status === 'Supported'),
    detail: 'Claims with backing evidence',
  }),
  career: (entries) => ({
    label: 'Active opportunities',
    value: count(entries, (entry) =>
      ['Interested', 'Preparing', 'Applied', 'Interviewing'].includes(entry.record.status),
    ),
    detail: 'In the application pipeline',
  }),
};

const defaultMetric = (entries: DomainEntry[]): MetricProps => ({
  label: 'Completed',
  value: count(entries, isComplete),
  detail: 'Records in a completed status',
});

/** Standing policy notices, keyed by domain instead of inlined as `&&` branches. */
const DOMAIN_NOTICE: Record<string, { title: string; body: string }> = {
  security: {
    title: 'No-secret boundary',
    body:
      'This pack stores posture metadata and references only. Secret-looking password, passphrase, seed, mnemonic, and private-key values are rejected.',
  },
};

/** Cross-pack hand-offs, keyed by domain instead of inlined as `&&` branches. */
const DOMAIN_HANDOFF: Record<string, { title: string; description: string; viewId: string; action: string }> = {
  mobility: {
    title: 'Trips',
    description: 'Trips, bookings, and itineraries remain owned by the existing Travel Planner.',
    viewId: 'travel-planner',
    action: 'Open Travel Planner',
  },
};

const QUEUE_LIMIT = 10;

export function DomainDashboardView({ domainId, navigateView }: WorkspaceViewProps & { domainId: string }) {
  const definition = domainDefinition(domainId)!;
  const configs = definition.configIds
    .map(domainConfig)
    .filter((value): value is LifePluginConfig => Boolean(value));
  const collections = useLifeCollections(definition.configIds);
  const entries: DomainEntry[] = configs.flatMap((config) =>
    (collections[config.id]?.records ?? []).map((record) => ({ config, record })),
  );

  const today = dayKey(new Date());
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonDate = dayKey(horizon);

  const byDate = (a: DomainEntry, b: DomainEntry) => (a.record.date ?? '').localeCompare(b.record.date ?? '');
  const upcoming = entries
    .filter(
      (entry) =>
        entry.record.date &&
        entry.record.date >= today &&
        entry.record.date <= horizonDate &&
        !isComplete(entry),
    )
    .sort(byDate);
  const overdue = entries
    .filter((entry) => entry.record.date && entry.record.date < today && !isComplete(entry))
    .sort(byDate);
  const attention = entries.filter((entry) => needsAttention(entry, today));

  const notice = DOMAIN_NOTICE[domainId];
  const handoff = DOMAIN_HANDOFF[domainId];
  const domainMetric = (DOMAIN_METRIC[domainId] ?? defaultMetric)(entries);

  return (
    <ViewShell
      title={definition.title}
      subtitle={definition.description}
      icon={definition.icon}
      bodyClassName="space-y-4 p-4"
    >
      {notice && (
        <Alert variant="warning">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.body}</AlertDescription>
        </Alert>
      )}

      <MetricRow className="lg:grid-cols-5">
        <Metric label="Records" value={entries.length} detail={`${configs.length} collections`} />
        <Metric
          label="Needs attention"
          value={attention.length}
          tone={attention.length ? 'warning' : 'default'}
          detail="Open, overdue or flagged"
        />
        <Metric
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? 'danger' : 'default'}
          detail="Past their date"
        />
        <Metric label="Next 30 days" value={upcoming.length} detail={`Through ${horizonDate}`} />
        <Metric {...domainMetric} />
      </MetricRow>

      <section className="divide-y divide-border border-y border-border">
        {configs.map((config) => {
          const items = collections[config.id]?.records ?? [];
          const open = items.filter((item) => !config.completedStatuses.includes(item.status)).length;
          const ConfigIcon = config.icon;
          return (
            <button
              key={config.id}
              type="button"
              onClick={() => navigateView(config.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <ConfigIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <strong className="min-w-0 flex-1 truncate text-sm">{config.title}</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                {items.length} record{items.length === 1 ? '' : 's'} · {open} open
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </section>

      {handoff && (
        <Panel title={handoff.title} icon={CalendarClock}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">{handoff.description}</p>
            <Button size="sm" variant="outline" onClick={() => navigateView(handoff.viewId)}>
              {handoff.action}
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Queue title="Overdue" icon={ClockAlert} entries={overdue} navigateView={navigateView} />
        <Queue
          title="Upcoming 30 days"
          icon={CalendarDays}
          entries={upcoming}
          navigateView={navigateView}
        />
      </div>
    </ViewShell>
  );
}

/**
 * A dated queue drawn from several collections.
 *
 * The rows deliberately do not activate: `navigateView` only takes a view id,
 * so a whole-row link would have discarded `record.id` and dropped the user in
 * an unfiltered collection. The row shows the record; the trailing button says
 * exactly where it goes.
 */
function Queue({
  title,
  icon: Icon,
  entries,
  navigateView,
}: {
  title: string;
  icon: typeof CalendarDays;
  entries: DomainEntry[];
  navigateView: (view: string) => void;
}) {
  const shown = entries.slice(0, QUEUE_LIMIT);
  const hidden = entries.length - shown.length;
  return (
    <Panel
      title={title}
      icon={Icon}
      description={`${entries.length} record${entries.length === 1 ? '' : 's'}`}
      bodyClassName="p-0"
    >
      {entries.length === 0 ? (
        <EmptyPanel icon={Icon} title="Nothing here" description="No records fall into this queue." />
      ) : (
        <>
          <ListRows>
            {shown.map(({ config, record }) => (
              <ListRow
                key={`${config.id}:${record.id}`}
                title={record.title}
                detail={`${config.title}${record.date ? ` · ${record.date}` : ''}`}
                meta={
                  <StatusBadge
                    status={record.status}
                    completedStatuses={config.completedStatuses}
                    overrides={DOMAIN_STATUS_TONES}
                  />
                }
                actions={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title={`Open ${config.title}`}
                    aria-label={`Open ${config.title}`}
                    onClick={() => navigateView(config.id)}
                  >
                    <ArrowRight aria-hidden="true" />
                  </Button>
                }
              />
            ))}
          </ListRows>
          {hidden > 0 && (
            <p className="border-t border-border px-3 py-2 text-xxs text-muted-foreground">
              {hidden} more not shown.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

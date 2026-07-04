import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, type LucideIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
  useToast,
} from '@/ui';
import { PLUGINS, type PluginInfo } from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import { isRunnable } from './plugins/types';
import { PacksView } from './PacksView';

type MarketplaceTab = 'plugins' | 'packs';

/** '12.4k' -> 12400, for sorting. */
function parseDownloads(d: string): number {
  const n = parseFloat(d);
  return d.endsWith('k') ? n * 1000 : n;
}

/** Renders a plugin's lucide icon inside its marketplace tile. */
function PluginIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} aria-hidden="true" />;
}

/**
 * Install/uninstall control backed by the plugin runtime. Handles the three
 * real states — installable, installed (removable), and metadata-only ("coming
 * soon") — plus the in-flight installing/removing phases and dependency errors.
 */
function PluginActionButton({ id, full = false }: { id: string; full?: boolean }) {
  const plugins = usePlugins();
  const { toast } = useToast();
  const manifest = plugins.manifest(id);
  const runnable = manifest ? isRunnable(manifest) : false;
  const installed = plugins.isInstalled(id);
  const phase = plugins.phaseOf(id);
  const busy = phase === 'installing' || phase === 'uninstalling';
  const size = full ? 'md' : 'sm';
  const shape = full ? 'w-full' : 'h-7 shrink-0 px-3 text-xxs';

  if (!runnable) {
    return (
      <Button size={size} variant="outline" disabled className={shape} title="Not yet available">
        Coming soon
      </Button>
    );
  }

  const act = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (installed) await plugins.uninstall(id);
      else await plugins.install(id);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: installed ? 'Cannot uninstall' : 'Install failed',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Button
      size={size}
      variant={installed ? 'outline' : 'primary'}
      disabled={busy}
      onClick={act}
      aria-pressed={installed}
      aria-label={`${installed ? 'Uninstall' : 'Install'} ${manifest?.name ?? id}`}
      className={shape}
    >
      {busy ? (
        <>
          <Spinner className={full ? 'size-4' : 'size-3'} /> {phase === 'installing' ? 'Installing…' : 'Removing…'}
        </>
      ) : installed ? (
        full ? (
          <>
            <Check className="size-4" /> Installed — remove
          </>
        ) : (
          'Installed'
        )
      ) : (
        'Install'
      )}
    </Button>
  );
}

/** One row in the vertical category rail: label plus a plugin count. */
function CategoryItem({
  label,
  count,
  active,
  mono,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        active ? 'bg-surface-3 font-medium text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      <span className={cn('truncate', mono && 'font-mono text-xs')}>{label}</span>
      <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

export function MarketplaceView() {
  const plugins = usePlugins();
  const [tab, setTab] = useState<MarketplaceTab>('plugins');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [detail, setDetail] = useState<PluginInfo | null>(null);

  const categories = useMemo(() => [...new Set(PLUGINS.map((p) => p.category))].sort(), []);
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PLUGINS) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLUGINS.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)),
    ).sort((a, b) => parseDownloads(b.downloads) - parseDownloads(a.downloads));
  }, [query, category]);

  // Featured: the three most-installed plugins, Play-store style hero cards.
  // Hidden while searching/filtering so results stay a single flat grid.
  const featured = useMemo(() => (query || category ? [] : filtered.slice(0, 3)), [filtered, query, category]);
  const rest = useMemo(() => (featured.length ? filtered.slice(3) : filtered), [filtered, featured]);

  const isInstalled = (p: PluginInfo) => plugins.isInstalled(p.id);

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto p-5 md:px-10 md:py-9">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-foreground">Marketplace</h1>
          <p className="text-[13px] text-muted-foreground">Extend Modulo with plugins and blueprint packs</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/plugins/submit">Submit a plugin</Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as MarketplaceTab)}>
        <TabsList variant="underline" className="mb-5">
          <TabsTrigger value="plugins">Plugins ({plugins.installedIds.size} installed)</TabsTrigger>
          <TabsTrigger value="packs">Packs</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'plugins' && (
        <>
          {/* A vertical category rail (md+) scales better than a wrapping pill
              row as categories grow; on mobile it collapses to a dropdown. */}
          <div className="flex gap-6 md:gap-8">
            <aside className="hidden w-40 shrink-0 md:block" aria-label="Filter by category">
              <div className="sticky top-0">
                <div className="mb-2 px-2.5 font-mono text-xxs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Categories
                </div>
                <nav className="flex flex-col gap-0.5">
                  <CategoryItem label="All" count={PLUGINS.length} active={category === null} onClick={() => setCategory(null)} />
                  {categories.map((c) => (
                    <CategoryItem
                      key={c}
                      label={c}
                      count={countByCategory[c] ?? 0}
                      mono
                      active={category === c}
                      onClick={() => setCategory(c)}
                    />
                  ))}
                </nav>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <div className="mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search plugins…"
                    aria-label="Search plugins"
                    className="pl-9"
                  />
                </div>
                {/* Category picker for < md, where the rail is hidden. */}
                <div className="md:hidden">
                  <Select value={category ?? 'all'} onValueChange={(v) => setCategory(v === 'all' ? null : v)}>
                    <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

          {/* Featured row */}
          {featured.length > 0 && (
            <section className="mb-8" aria-label="Featured plugins">
              <h2 className="mb-3 font-mono text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Featured
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {featured.map((p) => (
                  <Card
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetail(p);
                      }
                    }}
                    className="group cursor-pointer bg-gradient-to-br from-surface-2 to-surface p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
                        <PluginIcon icon={p.icon} className="size-6" />
                      </div>
                      {isInstalled(p) && (
                        <Badge variant="success" className="gap-1">
                          <Check className="size-3" /> installed
                        </Badge>
                      )}
                    </div>
                    <div className="mb-1 text-sm font-semibold text-foreground">{p.name}</div>
                    <p className="mb-3 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                    <div className="flex items-center text-xxs text-muted-foreground">
                      <span className="ml-auto font-mono">{p.category}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* All plugins: dense Obsidian-style rows */}
          <section aria-label="All plugins">
            {featured.length > 0 && (
              <h2 className="mb-3 font-mono text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                All plugins
              </h2>
            )}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No plugins match “{query}”.</p>
            )}
            <ul className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
              {rest.map((p) => (
                <li key={p.id} className="border-b border-border">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetail(p);
                      }
                    }}
                    className="group flex w-full cursor-pointer items-center gap-3.5 px-1 py-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary-hover" aria-hidden="true">
                      <PluginIcon icon={p.icon} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-foreground">{p.name}</div>
                      <div className="mt-0.5 truncate text-xxs text-muted-foreground">{p.desc}</div>
                    </div>
                    <PluginActionButton id={p.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
            </div>
          </div>

          {/* Play-style detail dialog */}
          <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
            <DialogContent className="max-w-md">
              {detail && (
                <>
                  <DialogHeader>
                    <div className="mb-2 flex items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden="true">
                        <PluginIcon icon={detail.icon} className="size-8" />
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="text-base">{detail.name}</DialogTitle>
                        <DialogDescription className="mt-0.5 font-mono">{detail.category}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <p className="text-[13px] leading-relaxed text-subtle-foreground">{detail.desc}</p>

                  {(plugins.manifest(detail.id)?.dependencies?.length ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Requires:{' '}
                      {plugins
                        .manifest(detail.id)!
                        .dependencies!.map((d) => plugins.manifest(d)?.name ?? d)
                        .join(', ')}
                    </p>
                  )}

                  <PluginActionButton id={detail.id} full />
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {tab === 'packs' && <PacksView />}
    </div>
  );
}

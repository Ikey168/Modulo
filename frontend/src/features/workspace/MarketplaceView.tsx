import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Blocks,
  Brain,
  Check,
  ChevronRight,
  Download,
  Heart,
  LayoutGrid,
  RefreshCw,
  Rocket,
  Search,
  Shapes,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react';
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
import { usePhoneLayout } from './mobile/usePhoneLayout';
import { isRunnable } from './plugins/types';
import { PacksView } from './PacksView';
import { authenticatedRequest } from '../../services/authenticatedRequest';
import { TrustCenterView } from '../knowledge/TrustCenterView';

type MarketplaceTab = 'plugins' | 'packs' | 'trust';

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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [trust, setTrust] = useState<null | {
    id: string; version: string; image_digest?: string; trustStatus?: string;
    publisher?: string; verification_level?: string; permissions?: string[];
    evidence?: { evidence_type: string; status: string; summary?: string }[];
  }>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  if (!runnable) {
    return (
      <Button size={size} variant="outline" disabled className={shape} title="Not yet available">
        Coming soon
      </Button>
    );
  }

  const perform = async () => {
    if (installed) await plugins.uninstall(id);
    else await plugins.install(id);
  };
  const act = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (installed) { if (window.confirm('Uninstall this plugin? Your saved plugin data will be retained.')) await perform(); return; }
      setReviewBusy(true);
      const releasesResponse = await authenticatedRequest(`/api/marketplace/trust/plugins/${encodeURIComponent(id)}/releases`);
      if (releasesResponse.ok) {
        const releases = await releasesResponse.json() as { id: string }[];
        if (releases.length > 0) {
          const detailResponse = await authenticatedRequest(`/api/marketplace/trust/releases/${releases[0].id}`);
          if (!detailResponse.ok) throw new Error('Trust details are unavailable for this release.');
          setTrust(await detailResponse.json()); setReviewOpen(true); return;
        }
      }
      // Bundled client-side plugins have no OCI release. Their source ships as
      // part of the Modulo application and therefore bypasses external-artifact
      // verification while still using the ordinary permission/runtime model.
      await perform();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: installed ? 'Cannot uninstall' : 'Install failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally { setReviewBusy(false); }
  };

  return (<>
    <Button
      size={size}
      variant={installed ? 'outline' : 'primary'}
      disabled={busy || reviewBusy}
      onClick={act}
      aria-pressed={installed}
      aria-label={`${installed ? 'Uninstall' : 'Install'} ${manifest?.name ?? id}`}
      className={shape}
    >
      {busy || reviewBusy ? (
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
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent className="max-w-lg" onClick={(event) => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Review exact plugin release</DialogTitle><DialogDescription>External releases are installed only after reviewing the digest, publisher, permissions and current trust evidence.</DialogDescription></DialogHeader>
        {trust && <div className="space-y-3 text-xs"><dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1"><dt>Version</dt><dd className="font-mono">{trust.version}</dd><dt>Digest</dt><dd className="break-all font-mono">{trust.image_digest ?? 'unknown'}</dd><dt>Trust</dt><dd><Badge variant={trust.trustStatus === 'VERIFIED' ? 'success' : 'destructive'}>{trust.trustStatus ?? 'UNKNOWN'}</Badge></dd><dt>Publisher</dt><dd>{trust.publisher ?? 'Unverified publisher'} · {trust.verification_level ?? 'UNVERIFIED'}</dd></dl>
          <div><p className="font-medium">Requested permissions</p><ul className="mt-1 list-inside list-disc text-muted-foreground">{(trust.permissions ?? []).length ? trust.permissions!.map((permission) => <li key={permission}>{permission}</li>) : <li>No additional permissions declared</li>}</ul></div>
          <div><p className="font-medium">Evidence</p><ul className="mt-1 space-y-1">{trust.evidence?.map((item) => <li key={item.evidence_type} className="flex items-center gap-2"><Badge variant={item.status === 'VERIFIED' ? 'success' : 'outline'}>{item.status}</Badge><span>{item.evidence_type}</span><span className="truncate text-muted-foreground">{item.summary}</span></li>)}</ul></div>
          {trust.trustStatus !== 'VERIFIED' && <p role="alert" className="text-destructive">Install is blocked until signature, provenance, SBOM and vulnerability evidence all verify and are fresh.</p>}
          <Button className="w-full" disabled={trust.trustStatus !== 'VERIFIED' || busy} onClick={async () => { try { const check = await authenticatedRequest(`/api/marketplace/trust/releases/${trust.id}/install-check`, { method: 'POST' }); if (!check.ok) throw new Error('Install-time trust recheck failed.'); const approval = await authenticatedRequest(`/api/marketplace/trust/plugins/${encodeURIComponent(id)}/install`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({release:trust.id,consented:true}) }); if (!approval.ok) throw new Error('Release approval failed.'); await perform(); setReviewOpen(false); } catch (err) { toast({ variant:'destructive', title:'Install blocked', description:err instanceof Error ? err.message : String(err) }); } }}>Confirm verified release and install</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>);
}

interface TrustHealth {
  trustStatus?: string;
  runtime?: { status?: string; endpoint?: string; updated_at?: string };
  latest?: { id: string; version: string; image_digest?: string; publisher?: string; verification_level?: string; evidence?: { evidence_type: string; status: string; summary?: string; evaluated_at?: string }[] };
  desired?: TrustHealth['latest'];
  releases?: { id: string; version: string; image_digest?: string }[];
  history?: { id: string; action: string; status: string; failure?: string; created_at?: string }[];
}
function PluginTrustHealth({ id }: { id: string }) {
  const plugins = usePlugins(); const { toast } = useToast();
  const [health,setHealth]=useState<TrustHealth|null>(null); const [loading,setLoading]=useState(true); const [reporting,setReporting]=useState(false);
  const refresh=useCallback(async()=>{setLoading(true);try{const response=await authenticatedRequest(`/api/marketplace/trust/plugins/${encodeURIComponent(id)}/health`);if(response.ok)setHealth(await response.json());else setHealth(null);}catch{setHealth(null);}finally{setLoading(false);}},[id]);
  useEffect(()=>{void refresh();},[refresh]);
  if(loading)return <p className="text-xs text-muted-foreground">Loading trust and health…</p>;
  if(!health)return <p role="alert" className="text-xs">Trust information is unavailable. Retry when the service is reachable.</p>;
  if(!health.latest)return <section className="rounded border border-border p-3 text-xs"><p className="font-medium">Bundled plugin</p><p className="mt-1 text-muted-foreground">This catalog entry ships with the Modulo application rather than as an external OCI marketplace release. External signature/provenance evidence is therefore not applicable.</p>{plugins.isInstalled(id)&&<Button size="sm" variant="outline" className="mt-2" onClick={()=>void plugins.setEnabled(id,!plugins.isEnabled(id))}>{plugins.isEnabled(id)?'Disable plugin':'Enable plugin'}</Button>}</section>;
  const displayed=health.desired??health.latest;
  const previous=health.releases?.find((release)=>release.id!==displayed.id);
  return <section className="space-y-3 rounded border border-border p-3 text-xs" aria-label="Plugin trust and health"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">Trust Center</span><Badge variant={health.trustStatus==='VERIFIED'?'success':'destructive'}>{health.trustStatus??'UNKNOWN'}</Badge><Badge variant="outline">runtime {health.runtime?.status??'UNKNOWN'}</Badge></div><dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1"><dt>Version</dt><dd className="font-mono">{displayed.version}</dd><dt>Digest</dt><dd className="break-all font-mono">{displayed.image_digest}</dd><dt>Publisher</dt><dd>{displayed.publisher??'Unverified'} · {displayed.verification_level??'UNVERIFIED'}</dd>{health.runtime?.endpoint&&<><dt>Endpoint</dt><dd className="break-all font-mono">{health.runtime.endpoint}</dd></>}</dl><ul className="space-y-1">{displayed.evidence?.map((entry)=><li key={entry.evidence_type} className="flex gap-2"><Badge variant={entry.status==='VERIFIED'?'success':'outline'}>{entry.status}</Badge><span>{entry.evidence_type}</span><span className="truncate text-muted-foreground">{entry.summary}</span></li>)}</ul>{health.history?.length?<details><summary className="cursor-pointer">Install / rollback history</summary><ul className="mt-1 space-y-1">{health.history.slice(0,8).map((item)=><li key={item.id}>{item.action} · {item.status}{item.failure?` · ${item.failure}`:''}</li>)}</ul></details>:null}<div className="flex flex-wrap gap-2">{plugins.isInstalled(id)&&<Button size="sm" variant="outline" onClick={()=>void plugins.setEnabled(id,!plugins.isEnabled(id))}>{plugins.isEnabled(id)?'Disable plugin':'Enable plugin'}</Button>}{previous&&<Button size="sm" variant="outline" onClick={async()=>{if(!window.confirm('Approve rollback to this previous release? Its trust evidence will be checked again.'))return;const response=await authenticatedRequest(`/api/marketplace/trust/plugins/${encodeURIComponent(id)}/rollback/${previous.id}`,{method:'POST'});if(response.ok){toast({title:'Rollback release verified',description:`Release ${previous.version} is recorded as the rollback target. Redeploy the pinned workload before reattaching it.`});void refresh();}else toast({variant:'destructive',title:'Rollback blocked',description:'The target release did not pass its current trust check.'});}}>Verify rollback to {previous.version}</Button>}<Button size="sm" variant="ghost" disabled={reporting} onClick={async()=>{setReporting(true);try{const response=await authenticatedRequest(`/api/marketplace/trust/plugins/${encodeURIComponent(id)}/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({release:health.latest?.id,reason:'USER_REPORT',detail:'Reported from Marketplace Trust Center'})});toast({title:response.ok?'Report recorded':'Report failed',variant:response.ok?'default':'destructive'});}finally{setReporting(false);}}}>Report release</Button></div><p className="text-muted-foreground">Rollback verification does not pretend a deployment changed: the previous digest must be redeployed and pass the same install-time recheck before attachment.</p></section>;
}

/** Icon per top-level category; unknown categories fall back to a tag. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ai: Brain,
  analytics: BarChart3,
  automation: Zap,
  export: Download,
  life: Heart,
  productivity: Rocket,
  render: Shapes,
  sync: RefreshCw,
  web3: Blocks,
};
const iconForCategory = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag;

interface CategoryItemProps {
  label: string;
  count: number;
  active: boolean;
  mono?: boolean;
  icon?: LucideIcon;
  /** Nesting depth: 0 = category, 1 = subcategory (indented). */
  depth?: number;
  /** Categories with subcategories get an expand chevron. */
  expandable?: boolean;
  expanded?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
}

/** One row in the vertical category rail: an optional expand chevron, a label,
 *  and a plugin count. Subcategories render nested and indented under it. */
function CategoryItem({ label, count, active, mono, icon: Icon, depth = 0, expandable, expanded, onSelect, onToggle }: CategoryItemProps) {
  return (
    <div
      className={cn('flex items-center rounded-md pr-2.5 transition-colors', active ? 'bg-surface-3' : 'hover:bg-surface-2')}
      // Indent subcategories so they line up under the parent's label text.
      style={depth > 0 ? { paddingLeft: 46 } : undefined}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
        </button>
      ) : (
        depth === 0 && <span className="w-6 shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {Icon && <Icon className={cn('size-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />}
        <span className={cn('min-w-0 flex-1 truncate', mono && 'font-mono text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {label}
        </span>
        <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{count}</span>
      </button>
    </div>
  );
}

export function MarketplaceView() {
  const plugins = usePlugins();
  const phoneLayout = usePhoneLayout();
  const [tab, setTab] = useState<MarketplaceTab>('plugins');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<PluginInfo | null>(null);

  const categories = useMemo(() => [...new Set(PLUGINS.map((p) => p.category))].sort(), []);
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PLUGINS) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, []);
  // Distinct subcategories per category, and a count per `category/subcategory`.
  const subcatsByCategory = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const p of PLUGINS) {
      if (!p.subcategory) continue;
      (m[p.category] ??= []);
      if (!m[p.category].includes(p.subcategory)) m[p.category].push(p.subcategory);
    }
    for (const k of Object.keys(m)) m[k].sort();
    return m;
  }, []);
  const countBySubcategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of PLUGINS) if (p.subcategory) m[`${p.category}/${p.subcategory}`] = (m[`${p.category}/${p.subcategory}`] ?? 0) + 1;
    return m;
  }, []);

  const selectAll = () => {
    setCategory(null);
    setSubcategory(null);
  };
  const selectCategory = (c: string) => {
    setCategory(c);
    setSubcategory(null);
    setExpanded((prev) => new Set(prev).add(c));
  };
  const selectSubcategory = (c: string, s: string) => {
    setCategory(c);
    setSubcategory(s);
    setExpanded((prev) => new Set(prev).add(c));
  };
  const toggleExpand = (c: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLUGINS.filter(
      (p) =>
        (!category || p.category === category) &&
        (!subcategory || p.subcategory === subcategory) &&
        (!q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)),
    ).sort((a, b) => parseDownloads(b.downloads) - parseDownloads(a.downloads));
  }, [query, category, subcategory]);

  // Featured: the three most-installed plugins, Play-store style hero cards.
  // Hidden while searching/filtering so results stay a single flat grid.
  const featured = useMemo(
    () => (query || category || subcategory ? [] : filtered.slice(0, 3)),
    [filtered, query, category, subcategory],
  );
  const rest = useMemo(() => (featured.length ? filtered.slice(3) : filtered), [filtered, featured]);

  const isInstalled = (p: PluginInfo) => plugins.isInstalled(p.id);

  return (
    <div className="flex-1 animate-fade-in overflow-y-auto p-5 phone:px-4 phone:pb-4 phone:pt-3 md:px-10 md:py-9">
      {/* On a phone the app bar already says "Marketplace" and the subtitle is
          hidden, which left a lone button floating in 90px of empty header.
          Submitting a plugin is a rare, deliberate act: it moves to the end of
          the list, where it costs nothing until you are looking for it. */}
      <header className="mb-5 flex items-end justify-between gap-4 phone:hidden">
        <div>
          {/* Duplicated by the phone app bar directly above — see ViewShell. */}
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-foreground phone:sr-only">Marketplace</h1>
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
          <TabsTrigger value="trust">Trust Center</TabsTrigger>
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
                  <CategoryItem label="All" count={PLUGINS.length} icon={LayoutGrid} active={category === null && !subcategory} onSelect={selectAll} />
                  {categories.map((c) => {
                    const subs = subcatsByCategory[c] ?? [];
                    const hasSubs = subs.length > 0;
                    const isExpanded = expanded.has(c);
                    return (
                      <div key={c}>
                        <CategoryItem
                          label={c}
                          count={countByCategory[c] ?? 0}
                          mono
                          icon={iconForCategory(c)}
                          active={category === c && !subcategory}
                          expandable={hasSubs}
                          expanded={isExpanded}
                          onSelect={() => selectCategory(c)}
                          onToggle={() => toggleExpand(c)}
                        />
                        {hasSubs &&
                          isExpanded &&
                          subs.map((s) => (
                            <CategoryItem
                              key={s}
                              label={s}
                              count={countBySubcategory[`${c}/${s}`] ?? 0}
                              depth={1}
                              active={category === c && subcategory === s}
                              onSelect={() => selectSubcategory(c, s)}
                            />
                          ))}
                      </div>
                    );
                  })}
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
                {/* Category picker for < md, where the rail is hidden. Categories
                    and their subcategories are flattened into one list. */}
                <div className="md:hidden">
                  <Select
                    value={subcategory ? `${category}/${subcategory}` : category ?? 'all'}
                    onValueChange={(v) => {
                      if (v === 'all') selectAll();
                      else if (v.includes('/')) {
                        const [c, s] = v.split('/');
                        selectSubcategory(c, s);
                      } else selectCategory(v);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <Fragment key={c}>
                          <SelectItem value={c}>{c}</SelectItem>
                          {(subcatsByCategory[c] ?? []).map((s) => (
                            <SelectItem key={s} value={`${c}/${s}`}>
                              {'  '}
                              {s}
                            </SelectItem>
                          ))}
                        </Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

          {/* Featured row */}
          {/* A featured grid of 5rem-tall cards costs three screens on a phone
              to say what the list below says in three rows, so the phone gets
              one list with the featured entries at the top of it. */}
          {featured.length > 0 && !phoneLayout && (
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
            {featured.length > 0 && !phoneLayout && (
              <h2 className="mb-3 font-mono text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                All plugins
              </h2>
            )}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No plugins match “{query}”.</p>
            )}
            <ul className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
              {(phoneLayout ? filtered : rest).map((p) => (
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
                    className="group flex w-full cursor-pointer items-center gap-3.5 px-1 py-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring coarse:gap-3 coarse:px-0.5 coarse:active:bg-surface-2"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary-hover" aria-hidden="true">
                      <PluginIcon icon={p.icon} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-foreground coarse:text-[15px]">{p.name}</div>
                      <div className="mt-0.5 truncate text-xxs text-muted-foreground coarse:text-xs">{p.desc}</div>
                    </div>
                    <PluginActionButton id={p.id} />
                  </div>
                </li>
              ))}
            </ul>
            {phoneLayout && (
              <div className="pt-4">
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/plugins/submit">Submit a plugin</Link>
                </Button>
              </div>
            )}
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

                  <PluginTrustHealth id={detail.id} />

                  <PluginActionButton id={detail.id} full />
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {tab === 'packs' && <PacksView />}
      {tab === 'trust' && <TrustCenterView />}
    </div>
  );
}

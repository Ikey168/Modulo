import { OfflineNotesNotice } from './OfflineNotesNotice';
import { SessionOfflineNotice } from '../auth/SessionOfflineNotice';
import { WorkspaceEntityContext } from './WorkspaceEntityContext';
import { WorkspaceCommandPalette } from './WorkspaceCommandPalette';
import { WorkspaceRecoveryView } from './WorkspaceRecoveryView';
import { WorkspaceRecordView } from './WorkspaceRecordView';
import { useWorkspaceIndex } from './useWorkspaceIndex';
import { flushNoteDrafts, hasUnsavedNotes } from './noteDrafts';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Undo2,
  CalendarDays,
  FileText,
  FolderSearch,
  Frame,
  History,
  LayoutDashboard,
  LogOut,
  Store,
  Tags,
  Waypoints,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import {
  Avatar,
  AvatarFallback,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from '@/ui';
import { PhoneBottomNav, PhoneFab, PhoneNavDrawer, PhoneTopBar } from './mobile/PhoneChrome';
import { phoneDestinations } from './mobile/phoneNav';
import { useEdgeSwipe } from './mobile/useEdgeSwipe';
import { usePullToRefresh } from './mobile/usePullToRefresh';
import { PullIndicator } from './mobile/PullIndicator';
import { BannerSlot } from './mobile/SystemBanner';
import { PhoneHome } from './mobile/PhoneHome';
import { usePhoneLayout } from './mobile/usePhoneLayout';
import { PhoneScreenProvider } from './mobile/PhoneScreenProvider';
import { usePhoneScreen } from './mobile/phoneScreen';
import { DashboardView } from './DashboardView';
import { MarketplaceView } from './MarketplaceView';
import { AuditPack } from '../packs/AuditPack';
import { PackStudio } from '../packs/PackStudio';
import { WorkspacePacks } from '../packs/WorkspacePacks';
import { ApprovalInbox } from '../approvals/ApprovalInbox';
import { ExecutionCenter } from '../executions/ExecutionCenter';
import { PropertyQueries } from '../knowledge/PropertyQueryView';
import {
  CALENDAR_PLUGIN_ID,
  CANVAS_PLUGIN_ID,
  GRAPH_PLUGIN_ID,
  NOTES_PLUGIN_ID,
  SAVED_SEARCHES_PLUGIN_ID,
  TAGS_PLUGIN_ID,
  TIMELINE_PLUGIN_ID,
} from './plugins';
import { PluginProvider, usePlugins } from './plugins/PluginProvider';
import { PluginErrorBoundary } from './plugins/PluginErrorBoundary';
import { HubView } from './plugins/HubView';
import {
  activeModes,
  hubTabs,
  isHubMode,
  modeInfo,
  modeOfView,
  resolveHubTab,
  sidebarViews,
} from './plugins/modes';
import type { WorkspaceViewProps } from './plugins/types';
import { useCoreWorkspace } from './useCoreWorkspace';

// Heavy React Flow editor loads on demand when the Blueprints view is opened.
const BlueprintEditor = lazy(() => import('../blueprint/editor/BlueprintEditor'));
import { mergeWithWikiLinks } from './deriveWikiLinks';

// Views the shell always provides. Notes and Graph are no longer here — they
// are contributed by installed plugins and merged into the nav at render time.
interface NavEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  order: number;
}
const BUILTIN_VIEWS: NavEntry[] = [
  { id: 'recovery', label: 'Recovery', icon: Undo2, order: 95 },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10 },
  { id: 'blueprints', label: 'Blueprints', icon: Workflow, order: 80 },
  { id: 'marketplace', label: 'Marketplace', icon: Store, order: 90 },
];
const BUILTIN_IDS = new Set([
  ...BUILTIN_VIEWS.map((v) => v.id),
  'executions', 'approvals', 'audit-pack', 'property-queries', 'packs', 'pack-studio',
]);

// Which plugin backs a given view id, so a not-installed view can offer to
// install the plugin that provides it. Icons for the "not installed" prompts.
const VIEW_PLUGIN: Record<string, { pluginId: string; icon: LucideIcon }> = {
  notes: { pluginId: NOTES_PLUGIN_ID, icon: FileText },
  graph: { pluginId: GRAPH_PLUGIN_ID, icon: Waypoints },
  canvas: { pluginId: CANVAS_PLUGIN_ID, icon: Frame },
  calendar: { pluginId: CALENDAR_PLUGIN_ID, icon: CalendarDays },
  timeline: { pluginId: TIMELINE_PLUGIN_ID, icon: History },
  tags: { pluginId: TAGS_PLUGIN_ID, icon: Tags },
  'saved-searches': { pluginId: SAVED_SEARCHES_PLUGIN_ID, icon: FolderSearch },
};

/** Modulo percent-sign brand mark (icon only), tinted by the primary token. */
function ModuloMark({ className }: { className?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" className={cn('shrink-0 text-primary', className)} aria-hidden="true">
      <line x1={5} y1={17.5} x2={17} y2={4.5} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={6.2} cy={6.2} r={3.4} fill="currentColor" />
      <circle cx={15.8} cy={15.8} r={3.4} fill="currentColor" opacity={0.7} />
    </svg>
  );
}

/** Icon-only nav button on the md+ rail; label lives in a right-side tooltip. */
function RailItem({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex h-10 w-full items-center justify-center transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            active
              ? 'text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Shown when the user navigates to a view whose plugin isn't installed. */
function NotInstalledView({
  viewId,
  onInstall,
  onOpenMarketplace,
}: {
  viewId: string;
  onInstall: (id: string) => Promise<void>;
  onOpenMarketplace: () => void;
}) {
  const backing = VIEW_PLUGIN[viewId];
  const Icon = backing?.icon ?? Store;
  const label = viewId.charAt(0).toUpperCase() + viewId.slice(1);
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <EmptyState
        icon={<Icon className="size-5" />}
        title={`${label} is not installed`}
        description="This view is provided by a plugin. Install it to use it, or browse the marketplace."
        action={
          <div className="flex gap-2">
            {backing && (
              <Button size="sm" onClick={() => void onInstall(backing.pluginId)}>
                Install plugin
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onOpenMarketplace}>
              Open marketplace
            </Button>
          </div>
        }
      />
    </div>
  );
}

export default function Workspace() {
  // The plugin runtime lives above the shell so every surface (nav, views,
  // marketplace) reads one source of truth for what is installed and active.
  return (
    <PluginProvider>
      <PhoneScreenProvider>
        <WorkspaceShell />
      </PhoneScreenProvider>
    </PluginProvider>
  );
}

function WorkspaceShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const recordUid = params.get('record');
  const noteParam = params.get('note');
  const { view: viewParam } = useParams<{ view: string }>();

  const { user, logout } = useAuth();
  const { toast } = useToast();
  const data = useCoreWorkspace();
  const plugins = usePlugins();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchParams]=useSearchParams();
  const linkedNote=searchParams.get("note");
  useEffect(()=>{if(linkedNote&&/^[1-9][0-9]*$/.test(linkedNote)&&data.notes.some(note=>note.id===Number(linkedNote)))setSelectedId(Number(linkedNote));},[linkedNote,data.notes]);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  const phoneLayout = usePhoneLayout();
  // A view showing a full-screen detail folds the shell's bars away; see
  // mobile/phoneScreen.tsx.
  const immersive = usePhoneScreen() && phoneLayout;
  const contentRef = useRef<HTMLDivElement>(null);
  // Pull down at the top of a view to resynchronize it. Enabled for touch only:
  // a mouse wheel cannot express the gesture and would fire it by accident.
  const pull = usePullToRefresh(
    contentRef,
    () => data.refresh(),
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  );

  const [commandOpen, setCommandOpen] = useState(false);
  // Android's drawer opens by swiping in from the left edge, not only by
  // finding the menu button. Suppressed while an overlay already owns the
  // gesture.
  useEdgeSwipe(() => setNavOpen(true), !navOpen && !commandOpen && recordUid == null);
  const [, refreshIndex] = useState(0);
  useEffect(() => {
    const refresh = (event: Event) => {
      const key = event instanceof CustomEvent ? String(event.detail) : '';
      if (!key.startsWith('modulo-note-draft-') && key !== 'modulo-quick-capture-v1') refreshIndex((value) => value + 1);
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey && !event.repeat && !event.isComposing) {
        event.preventDefault(); setCommandOpen((open) => !open);
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (hasUnsavedNotes()) { event.preventDefault(); event.returnValue = ''; } };
    const online = () => { void flushNoteDrafts(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('online', online);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('online', online); window.removeEventListener('storage', refresh);
    };
  }, []);
  useEffect(() => {
    if (noteParam && Number.isSafeInteger(Number(noteParam))) setSelectedId(Number(noteParam));
  }, [noteParam]);
  const entities = useWorkspaceIndex(data.notes);

  // Default the selection to the first note once data loads, so the desktop's
  // two-pane layout never shows an empty right half. A phone has one pane: the
  // same default opened *a* note instead of showing the list you asked for, so
  // "Notes" landed you inside whichever note happened to sort first.
  useEffect(() => {
    if (!phoneLayout && selectedId == null && data.notes.length > 0) {
      setSelectedId(data.notes[0].id);
    }
  }, [data.notes, selectedId, phoneLayout]);

  // Surface workspace errors as dismissible toasts instead of a fixed banner.
  useEffect(() => {
    if (data.error) {
      toast({ variant: 'destructive', title: 'Something went wrong', description: data.error });
    }
  }, [data.error, toast]);

  // [[wiki-links]] in note bodies become graph edges alongside explicit links.
  const graphLinks = useMemo(
    () => mergeWithWikiLinks(data.notes, data.links),
    [data.notes, data.links],
  );

  const goTo = (target: string) => {
    setNavOpen(false);
    navigate(`/app/${target}`);
  };

  /**
   * Tapping the destination you are already on scrolls that screen back to the
   * top rather than re-navigating to it — the gesture every phone app answers,
   * and the only way back up a long list without swiping a dozen times.
   */
  const goToOrTop = (target: string) => {
    if (target === activeNavId) {
      const scroller = contentRef.current?.querySelector<HTMLElement>(
        '[class*="overflow-y-auto"], [class*="overflow-auto"]',
      );
      (scroller ?? contentRef.current)?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    goTo(target);
  };

  const openNote = (id: number) => {
    setSelectedId(id);
    goTo(`notes?note=${id}`);
  };

  const handleNewNote = async () => {
    const created = await data.createNote();
    if (created) {
      setSelectedId(created.id);
      setEditMode(true);
      goTo(`notes?note=${created.id}`);
    }
  };

  // Nav = built-in views + exceptional mode-less views + one entry per active
  // umbrella hub. Fine-grained plugin modes remain sections inside those hubs,
  // so installing a large pack never floods the main rail.
  const contributedViews = plugins.contributions.views;
  const navItems = useMemo<NavEntry[]>(() => {
    const contributed = sidebarViews(contributedViews).map((v) => ({ id: v.id, label: v.label, icon: v.icon, order: v.order }));
    const modes = activeModes(contributedViews).map((m) => ({ id: m.id, label: m.label, icon: m.icon, order: m.order }));
    return [...BUILTIN_VIEWS, ...contributed, ...modes].sort((a, b) => a.order - b.order);
  }, [contributedViews]);

  // A view id from the URL is valid if it is built-in, a hub mode, contributed
  // by an active plugin, or a known plugin-backed view we can offer to install.
  const isKnownPluginView = viewParam != null && viewParam in VIEW_PLUGIN;
  const view =
    viewParam &&
    (BUILTIN_IDS.has(viewParam) ||
      isHubMode(viewParam) ||
      contributedViews.some((v) => v.id === viewParam) ||
      isKnownPluginView)
      ? viewParam
      : 'dashboard';
  const activeView = contributedViews.find((v) => v.id === view);
  const ActiveViewComponent = activeView?.component;

  // Hub resolution (#369): `/app/<mode>` opens the mode's remembered (or first)
  // tab; `/app/<tabView>` deep links open the tab's hub with that tab active.
  const hubModeId = isHubMode(view) ? view : activeView?.mode;
  const hubMode = hubModeId ? modeInfo(hubModeId) : undefined;
  const hubViewTabs = hubModeId ? hubTabs(contributedViews, hubModeId) : [];
  const activeHubTab = hubMode
    ? (activeView?.parentViewId
      ? hubViewTabs.find((tab) => tab.id === activeView.parentViewId) ?? activeView
      : activeView?.mode ? activeView : resolveHubTab(hubViewTabs, hubMode.id, typeof plugins.preferences?.get(`tab.${hubMode.id}`)?.value === 'string'
        ? plugins.preferences.get(`tab.${hubMode.id}`)!.value as string : null))
    : undefined;

  // The nav entry to highlight: for a hub tab that's the mode's entry.
  const activeNavId = modeOfView(contributedViews, view) ?? (isHubMode(view) ? modeInfo(view)?.id ?? view : view);

  const viewProps: WorkspaceViewProps = {
    data,
    selectedId,
    setSelectedId,
    editMode,
    setEditMode,
    searchQuery,
    setSearchQuery,
    onNewNote: handleNewNote,
    onOpenNote: openNote,
    graphLinks,
    navigateView: goTo,
    currentView: view,
    contributions: plugins.contributions,
  };

  // The phone top bar names the screen. A hub tab's own label ("Reading
  // List") says far more than the hub's ("Knowledge") or the raw route id,
  // which is what the old bar showed.
  const screenTitle =
    activeView?.label ??
    navItems.find((item) => item.id === view)?.label ??
    view.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

  const phoneNav = phoneDestinations(navItems, activeNavId);
  const phoneNavHasActive = phoneNav.some((item) => item.id === activeNavId);

  const userLabel = user?.name || user?.email || 'Account';
  const userSub = user?.name && user?.email ? user.email : undefined;
  const walletAddress = user?.walletAddress;
  const initials = userLabel
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');

  return (
    <WorkspaceEntityContext.Provider value={entities}><div className="flex h-app flex-col overflow-hidden bg-background font-sans text-[13.5px] text-foreground md:flex-row">
      {/* <md: phone app bar, drawer and bottom navigation (mobile/PhoneChrome) */}
      {!immersive && <PhoneTopBar
        title={screenTitle}
        onOpenNav={() => setNavOpen(true)}
        onOpenSearch={() => setCommandOpen(true)}
        userLabel={userLabel}
        userSub={userSub}
        initials={initials}
        onLogout={() => void logout()}
      />}
      <PhoneNavDrawer
        open={navOpen}
        onOpenChange={setNavOpen}
        items={navItems}
        activeId={activeNavId}
        onSelect={goTo}
        userLabel={userLabel}
        userSub={userSub}
        initials={initials}
        onLogout={() => void logout()}
      />

      {/* md+: icon-only rail */}
      <aside className="hidden w-14 shrink-0 flex-col border-r border-border md:flex">
        <div className="flex h-12 shrink-0 items-center justify-center">
          <ModuloMark />
        </div>
        <Button className="mx-auto" variant="ghost" size="icon-sm" onClick={() => setCommandOpen(true)} aria-label="Search and commands" title="Search and commands (Ctrl/Cmd+K)"><Search /></Button>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2" aria-label="Workspace">
          {navItems.map((item) => (
            <RailItem
              key={item.id}
              active={item.id === activeNavId}
              label={item.label}
              icon={item.icon}
              onClick={() => goTo(item.id)}
            />
          ))}
        </nav>
        <div className="flex shrink-0 justify-center pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Account: ${userLabel}`}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-xxs">{initials || '?'}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="min-w-44">
              <DropdownMenuLabel>
                <span className="block truncate text-xs">{userLabel}</span>
                {userSub && <span className="block truncate text-xxs font-normal text-muted-foreground">{userSub}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <WorkspaceCommandPalette open={commandOpen} onOpenChange={setCommandOpen} data={data} views={[...navItems, ...contributedViews.filter((item) => !navItems.some((nav) => nav.id === item.id))]} entities={entities} navigate={goTo} />
      {recordUid && <WorkspaceRecordView uid={recordUid} entities={entities} onClose={() => goTo(view)} navigate={goTo} /> }
      {/* `pb-app-bottom` is the bottom navigation plus the action button, each
          0 unless it is mounted (and both 0 above `md` or while the keyboard is
          open), so the view's own scroll container always ends where the phone
          chrome begins instead of underneath it. */}
      <div ref={contentRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-app-bottom">
        {/* Session banners land here — under the app bar, above the view —
            instead of above the shell, where they pushed the app bar off the
            top of a phone screen. */}
        <BannerSlot />
        <PullIndicator {...pull} />
        <SessionOfflineNotice />
        <OfflineNotesNotice refresh={data.refresh} />
        {/* One home screen per shape, chosen at runtime rather than rendered
            twice and hidden with `md:`, so neither version fetches the other's
            workflow list. */}
        {view === 'dashboard' && (phoneLayout ? (
          <PhoneHome
            notes={data.notes}
            installedPlugins={plugins.installedIds}
            walletAddress={walletAddress}
            userName={user?.name}
            onOpenNote={openNote}
            onNewNote={() => void handleNewNote()}
            onOpenSearch={() => setCommandOpen(true)}
            onOpenBlueprints={() => goTo('blueprints')}
            onOpenMarketplace={() => goTo('marketplace')}
            navigateView={goTo}
          />
        ) : (
          <DashboardView notes={data.notes} installedPlugins={plugins.installedIds} walletAddress={walletAddress} onOpenNote={openNote} onOpenBlueprints={() => goTo('blueprints')} onOpenMarketplace={() => goTo('marketplace')} />
        ))}
        {view === 'recovery' && <WorkspaceRecoveryView data={data} />}
        {view === 'executions' && <ExecutionCenter />}
        {view === 'approvals' && <ApprovalInbox />}
        {view === 'audit-pack' && <AuditPack />}
        {view === 'property-queries' && <PropertyQueries />}
        {view === 'packs' && <WorkspacePacks />}
        {view === 'pack-studio' && <PackStudio />}
        {view === 'marketplace' && <MarketplaceView />}
        {view === 'blueprints' && (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted-foreground">Loading editor…</div>}>
            <BlueprintEditor extraNodes={plugins.contributions.blueprintNodes} />
          </Suspense>
        )}

        {/* Mode hubs (#369) and plugin-contributed views (Notes, Graph, …). */}
        {!BUILTIN_IDS.has(view) &&
          (hubMode && activeHubTab ? (
            <HubView
              key={plugins.stateSessionKey}
              mode={hubMode}
              tabs={hubViewTabs}
              activeTab={activeHubTab}
              viewProps={viewProps}
              onSelectTab={goTo}
            />
          ) : ActiveViewComponent ? (
            <PluginErrorBoundary key={`${plugins.stateSessionKey}:${view}`} name={activeView?.label ?? view}>
              <ActiveViewComponent {...viewProps} />
            </PluginErrorBoundary>
          ) : !plugins.ready ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : (
            <NotInstalledView viewId={view} onInstall={plugins.install} onOpenMarketplace={() => goTo('marketplace')} />
          ))}
      </div>

      <PhoneBottomNav
        items={phoneNav}
        activeId={activeNavId}
        onSelect={goToOrTop}
        onOpenMore={() => setNavOpen(true)}
        moreActive={!phoneNavHasActive}
      />
      {/* Capture is the one action worth a permanent, thumb-reachable button;
          it is offered only where a new note is what "add" means here. Notes
          usually renders as a tab inside the Knowledge hub, so the route id
          alone would miss the one screen that needs it most. */}
      {/* …and not while a view owns the screen: a note you have opened offers
          Edit in its own bar, so a "New note" button docked over it is an
          invitation to lose your place. */}
      {!immersive && (view === 'dashboard' || view === 'notes' || activeHubTab?.id === 'notes') && (
        <PhoneFab label="New note" icon={Plus} onClick={() => void handleNewNote()} />
      )}
    </div></WorkspaceEntityContext.Provider>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  FileText,
  FolderSearch,
  Frame,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from '@/ui';
import { NavItem, UserPill } from './atoms';
import { DashboardView } from './DashboardView';
import { MarketplaceView } from './MarketplaceView';
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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10 },
  { id: 'marketplace', label: 'Marketplace', icon: Store, order: 20 },
  { id: 'blueprints', label: 'Blueprints', icon: Workflow, order: 30 },
];
const BUILTIN_IDS = new Set(BUILTIN_VIEWS.map((v) => v.id));

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
      <WorkspaceShell />
    </PluginProvider>
  );
}

function WorkspaceShell() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();

  const { user, logout } = useAuth();
  const { toast } = useToast();
  const data = useCoreWorkspace();
  const plugins = usePlugins();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  // Default the selection to the first note once data loads.
  useEffect(() => {
    if (selectedId == null && data.notes.length > 0) {
      setSelectedId(data.notes[0].id);
    }
  }, [data.notes, selectedId]);

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

  const openNote = (id: number) => {
    setSelectedId(id);
    goTo('notes');
  };

  const handleNewNote = async () => {
    const created = await data.createNote();
    if (created) {
      setSelectedId(created.id);
      setEditMode(true);
    }
  };

  // Nav = built-in views + views contributed by active plugins, ordered.
  const contributedViews = plugins.contributions.views;
  const navItems = useMemo<NavEntry[]>(() => {
    const contributed = contributedViews.map((v) => ({ id: v.id, label: v.label, icon: v.icon, order: v.order }));
    return [...BUILTIN_VIEWS, ...contributed].sort((a, b) => a.order - b.order);
  }, [contributedViews]);

  // A view id from the URL is valid if it is built-in, contributed by an active
  // plugin, or a known plugin-backed view we can offer to install.
  const isKnownPluginView = viewParam != null && viewParam in VIEW_PLUGIN;
  const view =
    viewParam &&
    (BUILTIN_IDS.has(viewParam) || navItems.some((n) => n.id === viewParam) || isKnownPluginView)
      ? viewParam
      : 'dashboard';
  const activeView = contributedViews.find((v) => v.id === view);
  const ActiveViewComponent = activeView?.component;

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
    contributions: plugins.contributions,
  };

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
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans text-[13.5px] text-foreground md:flex-row">
      {/* <md: slim top bar with the nav in a sheet */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col gap-0 bg-surface p-0">
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-[15px] tracking-tight">
                <ModuloMark />
                Modulo
              </SheetTitle>
              <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Workspace">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavItem
                    key={item.id}
                    active={item.id === view}
                    onClick={() => goTo(item.id)}
                    icon={<Icon aria-hidden="true" />}
                    label={item.label}
                  />
                );
              })}
            </nav>
            <div className="border-t border-border p-2.5">
              <UserPill label={userLabel} sublabel={userSub} onClick={() => void logout()} />
            </div>
          </SheetContent>
        </Sheet>
        <ModuloMark className="size-[18px]" />
        <span className="text-sm font-semibold tracking-tight">Modulo</span>
        <span className="ml-auto pr-1 text-xs capitalize text-muted-foreground">{view}</span>
      </header>

      {/* md+: icon-only rail */}
      <aside className="hidden w-14 shrink-0 flex-col border-r border-border md:flex">
        <div className="flex h-12 shrink-0 items-center justify-center">
          <ModuloMark />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2" aria-label="Workspace">
          {navItems.map((item) => (
            <RailItem
              key={item.id}
              active={item.id === view}
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
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {view === 'dashboard' && (
          <DashboardView notes={data.notes} installedPlugins={plugins.installedIds} walletAddress={walletAddress} onOpenNote={openNote} onOpenBlueprints={() => goTo('blueprints')} onOpenMarketplace={() => goTo('marketplace')} />
        )}
        {view === 'marketplace' && <MarketplaceView />}
        {view === 'blueprints' && (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted-foreground">Loading editor…</div>}>
            <BlueprintEditor extraNodes={plugins.contributions.blueprintNodes} />
          </Suspense>
        )}

        {/* Plugin-contributed views (Notes, Graph, …). */}
        {!BUILTIN_IDS.has(view) &&
          (ActiveViewComponent ? (
            <PluginErrorBoundary name={activeView?.label ?? view}>
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
    </div>
  );
}

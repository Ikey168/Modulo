import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Store,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from '@/ui';
import { NavItem, UserPill } from './atoms';
import { NotesView } from './NotesView';
import { GraphView } from './GraphView';
import { DashboardView } from './DashboardView';
import { MarketplaceView } from './MarketplaceView';
import { useCoreWorkspace } from './useCoreWorkspace';

// Heavy React Flow editor loads on demand when the Blueprints view is opened.
const BlueprintEditor = lazy(() => import('../blueprint/editor/BlueprintEditor'));
import { mergeWithWikiLinks } from './deriveWikiLinks';

const VIEWS = ['notes', 'graph', 'dashboard', 'marketplace', 'blueprints'] as const;
type View = (typeof VIEWS)[number];
type NavTarget = View;

const NAV_ICONS: Record<NavTarget, LucideIcon> = {
  notes: FileText,
  graph: Waypoints,
  dashboard: LayoutDashboard,
  marketplace: Store,
  blueprints: Workflow,
};

const NAV_LABELS: Record<NavTarget, string> = {
  notes: 'Notes',
  graph: 'Graph',
  dashboard: 'Dashboard',
  marketplace: 'Marketplace',
  blueprints: 'Blueprints',
};

// Plugins & blueprints are the product's center of gravity; notes follow.
const NAV_ORDER: NavTarget[] = ['dashboard', 'marketplace', 'blueprints', 'notes', 'graph'];

/** Modulo brand mark (icon only), tinted by the primary token. */
function ModuloMark({ className }: { className?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" className={cn('shrink-0 text-primary', className)} aria-hidden="true">
      <rect x={1} y={1} width={9} height={9} rx={2} fill="currentColor" />
      <rect x={12} y={1} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={1} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={12} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.7} />
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

export default function Workspace() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? '') ? (viewParam as View) : 'dashboard';

  const { user, logout } = useAuth();
  const { toast } = useToast();
  const data = useCoreWorkspace();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [installed, setInstalled] = useState<Set<string>>(new Set(['mermaid', 'github-sync']));
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

  const goTo = (target: NavTarget) => {
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

  const togglePlugin = (id: string) =>
    setInstalled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
              {NAV_ORDER.map((target) => {
                const Icon = NAV_ICONS[target];
                return (
                  <NavItem
                    key={target}
                    active={target === view}
                    onClick={() => goTo(target)}
                    icon={<Icon aria-hidden="true" />}
                    label={NAV_LABELS[target]}
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
          {NAV_ORDER.map((target) => (
            <RailItem
              key={target}
              active={target === view}
              label={NAV_LABELS[target]}
              icon={NAV_ICONS[target]}
              onClick={() => goTo(target)}
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
        {view === 'notes' && (
          <NotesView
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            editMode={editMode}
            onToggleEdit={setEditMode}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            onNewNote={handleNewNote}
          />
        )}
        {view === 'graph' && (
          <GraphView notes={data.notes} links={graphLinks} selectedId={selectedId} onSelectNode={setSelectedId} onOpenNote={() => goTo('notes')} />
        )}
        {view === 'dashboard' && (
          <DashboardView notes={data.notes} installedPlugins={installed} walletAddress={walletAddress} onOpenNote={openNote} onOpenBlueprints={() => goTo('blueprints')} onOpenMarketplace={() => goTo('marketplace')} />
        )}
        {view === 'marketplace' && <MarketplaceView installedPlugins={installed} onTogglePlugin={togglePlugin} />}
        {view === 'blueprints' && (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted-foreground">Loading editor…</div>}>
            <BlueprintEditor />
          </Suspense>
        )}
      </div>
    </div>
  );
}

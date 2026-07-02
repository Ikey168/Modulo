import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  useToast,
} from '@/ui';
import { NavItem, UserPill } from './atoms';
import { NotesView } from './NotesView';
import { GraphView } from './GraphView';
import { DashboardView } from './DashboardView';
import { MarketplaceView } from './MarketplaceView';
import { useCoreWorkspace } from './useCoreWorkspace';
import { mergeWithWikiLinks } from './deriveWikiLinks';

const VIEWS = ['notes', 'graph', 'dashboard', 'marketplace'] as const;
type View = (typeof VIEWS)[number];
type NavTarget = View | 'blueprints' | 'packs';

const NAV_ICONS: Record<NavTarget, ReactNode> = {
  notes: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <path d="M3 1.5h9a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth={1.2} fill="none" />
      <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
    </svg>
  ),
  graph: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <circle cx={7.5} cy={7.5} r={2.2} stroke="currentColor" strokeWidth={1.2} />
      <circle cx={12.5} cy={2.5} r={1.5} stroke="currentColor" strokeWidth={1.1} />
      <circle cx={2.5} cy={2.5} r={1.5} stroke="currentColor" strokeWidth={1.1} />
      <circle cx={2.5} cy={12.5} r={1.5} stroke="currentColor" strokeWidth={1.1} />
      <circle cx={12.5} cy={12.5} r={1.5} stroke="currentColor" strokeWidth={1.1} />
      <path d="M9.3 6.3L11.3 4M5.7 6.3L3.7 4M5.7 8.8L3.7 11M9.3 8.8L11.3 11" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  ),
  dashboard: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <rect x={1.5} y={1.5} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <rect x={8.5} y={1.5} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <rect x={1.5} y={8.5} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <rect x={8.5} y={8.5} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
    </svg>
  ),
  marketplace: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <path d="M1.5 3h12M3 3l1 8h7l1-8" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={5.5} cy={12.5} r={1} stroke="currentColor" strokeWidth={1.1} />
      <circle cx={9.5} cy={12.5} r={1} stroke="currentColor" strokeWidth={1.1} />
    </svg>
  ),
  blueprints: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <rect x={1.5} y={5.5} width={4} height={4} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <rect x={9.5} y={1.5} width={4} height={4} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <rect x={9.5} y={9.5} width={4} height={4} rx={1} stroke="currentColor" strokeWidth={1.2} />
      <path d="M5.5 7.5h2.2M7.7 7.5V3.5h1.8M7.7 7.5v4h1.8" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </svg>
  ),
  packs: (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <rect x={1.5} y={1.5} width={12} height={12} rx={1.5} stroke="currentColor" strokeWidth={1.2} />
      <path d="M5 7.5h5M7.5 5v5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
    </svg>
  ),
};

const NAV_LABELS: Record<NavTarget, string> = {
  notes: 'Notes',
  graph: 'Graph',
  dashboard: 'Dashboard',
  marketplace: 'Marketplace',
  blueprints: 'Blueprints',
  packs: 'Packs',
};

const NAV_ORDER: NavTarget[] = [...VIEWS, 'blueprints', 'packs'];

function Logo({ className }: { className?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" className={cn('shrink-0 text-primary', className)} aria-hidden="true">
      <rect x={1} y={1} width={9} height={9} rx={2} fill="currentColor" />
      <rect x={12} y={1} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={1} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={12} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.7} />
    </svg>
  );
}

function SidebarNav({ view, collapsed, onGo }: { view: View; collapsed?: boolean; onGo: (target: NavTarget) => void }) {
  return (
    <nav className={cn('flex flex-1 flex-col gap-0.5 overflow-y-auto p-2', collapsed && 'px-1.5')}>
      {NAV_ORDER.map((target) => (
        <NavItem
          key={target}
          active={target === view}
          collapsed={collapsed}
          onClick={() => onGo(target)}
          icon={NAV_ICONS[target]}
          label={NAV_LABELS[target]}
        />
      ))}
    </nav>
  );
}

export default function Workspace() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? '') ? (viewParam as View) : 'notes';

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
    if ((VIEWS as readonly string[]).includes(target)) {
      navigate(`/app/${target}`);
    } else {
      navigate(`/${target}`);
    }
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans text-[13.5px] text-foreground md:flex-row">
      {/* <md: top bar with the nav in a sheet */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:hidden">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
              <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M2 4h11M2 7.5h11M2 11h11" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
              </svg>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col gap-0 bg-surface p-0">
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-[15px] tracking-tight">
                <Logo />
                Modulo
              </SheetTitle>
              <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
            </SheetHeader>
            <SidebarNav view={view} onGo={goTo} />
            <div className="border-t border-border p-2.5">
              <UserPill label={userLabel} sublabel={userSub} onClick={() => void logout()} />
            </div>
          </SheetContent>
        </Sheet>
        <Logo className="size-[18px]" />
        <span className="text-sm font-semibold tracking-tight">Modulo</span>
        <span className="ml-auto text-xs capitalize text-muted-foreground">{view}</span>
      </header>

      {/* md: collapsed icon rail */}
      <aside className="hidden w-14 shrink-0 flex-col overflow-hidden border-r border-border bg-surface md:flex lg:hidden">
        <div className="flex items-center justify-center border-b border-border py-4">
          <Logo className="size-[18px]" />
        </div>
        <SidebarNav view={view} collapsed onGo={goTo} />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="w-full"
            onClick={() => void logout()}
            aria-label={`Log out (${userLabel})`}
            title="Log out"
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4.5 1.5H2.5A1 1 0 001.5 2.5v7a1 1 0 001 1h2" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
              <path d="M7 8.5L9.5 6 7 3.5M9.5 6h-6" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </aside>

      {/* ≥lg: full sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-[17px]">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Modulo</span>
        </div>
        <SidebarNav view={view} onGo={goTo} />
        <div className="border-t border-border p-2.5">
          <UserPill label={userLabel} sublabel={userSub} onClick={() => void logout()} />
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
          <DashboardView notes={data.notes} links={data.links} tags={data.tags} installedPlugins={installed} walletAddress={walletAddress} onOpenNote={openNote} />
        )}
        {view === 'marketplace' && <MarketplaceView installedPlugins={installed} onTogglePlugin={togglePlugin} />}
      </div>
    </div>
  );
}

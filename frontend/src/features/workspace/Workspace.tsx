import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './workspace.css';
import { NavItem, UserPill } from './atoms';
import { NotesView } from './NotesView';
import { GraphView } from './GraphView';
import { DashboardView } from './DashboardView';
import { MarketplaceView } from './MarketplaceView';
import { useWorkspaceData } from './useWorkspaceData';

const VIEWS = ['notes', 'graph', 'dashboard', 'marketplace'] as const;
type View = (typeof VIEWS)[number];

const NAV_ICONS: Record<View, ReactNode> = {
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
};

export default function Workspace() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? '') ? (viewParam as View) : 'notes';

  const { user, logout } = useAuth();
  const data = useWorkspaceData();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [installed, setInstalled] = useState<Set<string>>(new Set(['mermaid', 'github-sync']));

  // Default the selection to the first note once data loads.
  useEffect(() => {
    if (selectedId == null && data.notes.length > 0) {
      setSelectedId(data.notes[0].id);
    }
  }, [data.notes, selectedId]);

  const goTo = (v: View) => navigate(`/app/${v}`);

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

  const errorBanner = useMemo(
    () =>
      data.error ? (
        <div style={{ position: 'absolute', bottom: 14, right: 18, zIndex: 10, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 12, padding: '8px 12px', borderRadius: 8, maxWidth: 360 }}>
          {data.error}
        </div>
      ) : null,
    [data.error],
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0a0b', color: '#f4f4f5', fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: 13.5 }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: '#111114', borderRight: '1px solid #1e1e24', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 16px 15px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid #1e1e24' }}>
          <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
            <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
            <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
            <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.5px', color: '#f4f4f5' }}>Modulo</span>
        </div>

        <nav style={{ padding: 8, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {VIEWS.map((v) => (
            <NavItem key={v} active={view === v} onClick={() => goTo(v)} icon={NAV_ICONS[v]} label={v.charAt(0).toUpperCase() + v.slice(1)} />
          ))}
        </nav>

        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid #1e1e24' }}>
          <UserPill label={userLabel} sublabel={userSub} onClick={() => void logout()} />
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
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
          <GraphView notes={data.notes} links={data.links} selectedId={selectedId} onSelectNode={setSelectedId} onOpenNote={() => goTo('notes')} />
        )}
        {view === 'dashboard' && (
          <DashboardView notes={data.notes} links={data.links} tags={data.tags} installedPlugins={installed} walletAddress={walletAddress} onOpenNote={openNote} />
        )}
        {view === 'marketplace' && <MarketplaceView installedPlugins={installed} onTogglePlugin={togglePlugin} />}
        {errorBanner}
      </div>
    </div>
  );
}

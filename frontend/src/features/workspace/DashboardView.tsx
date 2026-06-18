import { useMemo } from 'react';
import { Hover } from './atoms';
import { PLUGINS } from './plugins';
import { isAnchored, relativeTime, type NormalizedLink, type WorkspaceNote, type WorkspaceTag } from './types';

interface DashboardViewProps {
  notes: WorkspaceNote[];
  links: NormalizedLink[];
  tags: WorkspaceTag[];
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

  const stats = [
    { label: 'Notes', value: notes.length, color: '#f4f4f5' },
    { label: 'On-Chain', value: notes.filter(isAnchored).length, color: '#22c55e' },
    { label: 'Tags', value: totalTags, color: '#f4f4f5' },
    { label: 'Connections', value: links.length, color: '#818cf8' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px', boxSizing: 'border-box', animation: 'fadeIn .15s ease' }}>
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 600, letterSpacing: '-.5px', color: '#f4f4f5' }}>Dashboard</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#52525b' }}>Your knowledge base at a glance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ background: '#111114', border: '1px solid #1e1e24', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#52525b', marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-1px', color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#111114', border: '1px solid #1e1e24', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #1e1e24' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Recent Notes</span>
          </div>
          <div style={{ padding: 8 }}>
            {recent.length === 0 && <div style={{ padding: '12px', fontSize: 12.5, color: '#52525b' }}>No notes yet.</div>}
            {recent.map((n) => (
              <Hover
                key={n.id}
                onClick={() => onOpenNote(n.id)}
                style={{ padding: '9px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                hoverStyle={{ background: '#16161a' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isAnchored(n) ? '#22c55e' : '#2a2a30', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                <span style={{ fontSize: 11, color: '#3f3f46', flexShrink: 0 }}>{relativeTime(n.updatedAt)}</span>
              </Hover>
            ))}
          </div>
        </div>

        <div style={{ background: '#111114', border: '1px solid #1e1e24', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Active Plugins</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>{installedPlugins.size}</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeNames.length === 0 && <div style={{ fontSize: 12.5, color: '#52525b' }}>No plugins installed.</div>}
            {activeNames.map((name) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: '#71717a' }}>{name}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#22c55e' }}>Active</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e24' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#52525b', marginBottom: 10 }}>Wallet</div>
            {walletAddress ? (
              <div style={{ fontSize: 12, color: '#a1a1aa', fontFamily: "'DM Mono',monospace" }}>
                {`${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#52525b' }}>No wallet connected</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

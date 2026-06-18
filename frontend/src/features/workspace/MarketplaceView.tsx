import { useState } from 'react';
import { PLUGINS, type PluginInfo } from './plugins';

interface MarketplaceViewProps {
  installedPlugins: Set<string>;
  onTogglePlugin: (id: string) => void;
}

export function MarketplaceView({ installedPlugins, onTogglePlugin }: MarketplaceViewProps) {
  const items = PLUGINS.map((p) => ({ ...p, installed: installedPlugins.has(p.id) }));
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px', boxSizing: 'border-box', animation: 'fadeIn .15s ease' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 600, letterSpacing: '-.5px', color: '#f4f4f5' }}>Marketplace</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#52525b' }}>Extend Modulo with community plugins</p>
        </div>
        <span style={{ fontSize: 12, color: '#52525b', paddingBottom: 2 }}>{installedPlugins.size} installed</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {items.map((p) => (
          <PluginCard key={p.id} plugin={p} onToggle={() => onTogglePlugin(p.id)} />
        ))}
      </div>
    </div>
  );
}

function PluginCard({ plugin, onToggle }: { plugin: PluginInfo & { installed: boolean }; onToggle: () => void }) {
  const [h, setH] = useState(false);
  const [bh, setBh] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ background: '#111114', border: `1px solid ${h ? '#2a2a30' : '#1e1e24'}`, borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color .15s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1a1a1f', border: '1px solid #2a2a30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#818cf8', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
            {plugin.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plugin.name}</div>
            <div style={{ fontSize: 11, color: '#52525b' }}>by {plugin.author}</div>
          </div>
        </div>
        <div
          onClick={onToggle}
          onMouseEnter={() => setBh(true)}
          onMouseLeave={() => setBh(false)}
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: plugin.installed ? 'transparent' : '#4f46e5', color: plugin.installed ? '#52525b' : '#fff', border: `1px solid ${plugin.installed ? '#2a2a30' : 'transparent'}`, whiteSpace: 'nowrap', flexShrink: 0, opacity: bh ? 0.8 : 1, transition: 'opacity .1s' }}
        >
          {plugin.installed ? 'Installed' : 'Install'}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.55 }}>{plugin.desc}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#52525b' }}>
        <span>↓ {plugin.downloads}</span>
        <span>★ {plugin.rating}</span>
        <span style={{ background: '#1c1c22', padding: '1px 8px', borderRadius: 4, fontFamily: "'DM Mono',monospace", fontSize: 10.5 }}>{plugin.category}</span>
      </div>
    </div>
  );
}

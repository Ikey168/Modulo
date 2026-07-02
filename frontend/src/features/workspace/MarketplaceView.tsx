import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Tabs, TabsList, TabsTrigger } from '@/ui';
import { PLUGINS, type PluginInfo } from './plugins';
import PackMarketplace from '../blueprint/pack/PackMarketplace';
import PackManager from '../blueprint/pack/PackManager';

interface MarketplaceViewProps {
  installedPlugins: Set<string>;
  onTogglePlugin: (id: string) => void;
}

type MarketplaceTab = 'plugins' | 'packs';

export function MarketplaceView({ installedPlugins, onTogglePlugin }: MarketplaceViewProps) {
  const [tab, setTab] = useState<MarketplaceTab>('plugins');
  const items = PLUGINS.map((p) => ({ ...p, installed: installedPlugins.has(p.id) }));
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
        <TabsList variant="underline" className="mb-6">
          <TabsTrigger value="plugins">Plugins ({installedPlugins.size} installed)</TabsTrigger>
          <TabsTrigger value="packs">Packs</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'plugins' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {items.map((p) => (
            <PluginCard key={p.id} plugin={p} onToggle={() => onTogglePlugin(p.id)} />
          ))}
        </div>
      )}
      {tab === 'packs' && (
        <div className="flex flex-col gap-2">
          <PackMarketplace />
          <PackManager />
        </div>
      )}
    </div>
  );
}

function PluginCard({ plugin, onToggle }: { plugin: PluginInfo & { installed: boolean }; onToggle: () => void }) {
  return (
    <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-[15px] text-primary-hover"
            aria-hidden="true"
          >
            {plugin.icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{plugin.name}</div>
            <div className="text-xxs text-muted-foreground">by {plugin.author}</div>
          </div>
        </div>
        <Button
          size="sm"
          variant={plugin.installed ? 'outline' : 'primary'}
          onClick={onToggle}
          aria-pressed={plugin.installed}
          aria-label={`${plugin.installed ? 'Uninstall' : 'Install'} ${plugin.name}`}
          className="h-7 shrink-0 px-3 text-xxs"
        >
          {plugin.installed ? 'Installed' : 'Install'}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{plugin.desc}</p>
      <div className="flex items-center gap-3 text-xxs text-muted-foreground">
        <span>↓ {plugin.downloads}</span>
        <span>★ {plugin.rating}</span>
        <Badge variant="secondary" className="rounded font-mono text-[10.5px]">
          {plugin.category}
        </Badge>
      </div>
    </Card>
  );
}

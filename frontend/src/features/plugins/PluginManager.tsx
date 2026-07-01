import React, { useState, useEffect } from 'react';
import { PluginInfo, PluginStatus } from '../../types/plugin';
import { PluginService } from '../../services/pluginService';
import { Plug, X, RefreshCw, Plus } from 'lucide-react';
import { Button, EmptyState, Spinner, cn } from '@/ui';
import PluginCard from './PluginCard';
import PluginInstaller from './PluginInstaller';

const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstaller, setShowInstaller] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const pluginData = await PluginService.getAllPlugins();
      setPlugins(pluginData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const handlePluginAction = async (pluginId: string, action: 'start' | 'stop' | 'uninstall') => {
    try {
      switch (action) {
        case 'start':
          await PluginService.startPlugin(pluginId);
          break;
        case 'stop':
          await PluginService.stopPlugin(pluginId);
          break;
        case 'uninstall':
          await PluginService.uninstallPlugin(pluginId);
          break;
      }
      // Reload plugins to reflect changes
      await loadPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} plugin`);
    }
  };

  const handleInstallSuccess = () => {
    setShowInstaller(false);
    loadPlugins();
  };

  const filteredPlugins = plugins.filter(plugin => {
    if (filter === 'all') return true;
    if (filter === 'active') return plugin.status === PluginStatus.ACTIVE;
    if (filter === 'inactive') return plugin.status !== PluginStatus.ACTIVE;
    return true;
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="flex flex-col items-center justify-center gap-4 p-16 text-muted-foreground">
          <Spinner className="size-10 text-primary" />
          <p>Loading plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border-strong pb-4">
        <h1 className="text-3xl font-semibold text-foreground">Plugin Manager</h1>
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={() => setShowInstaller(true)}
          >
            <Plus className="size-4" />
            Install Plugin
          </Button>
          <Button
            variant="outline"
            onClick={loadPlugins}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/15 px-4 py-3 text-destructive">
          <span>❌ {error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded p-1 text-destructive transition-colors hover:bg-destructive/20"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {([
          ['all', `All (${plugins.length})`],
          ['active', `Active (${plugins.filter(p => p.status === PluginStatus.ACTIVE).length})`],
          ['inactive', `Inactive (${plugins.filter(p => p.status !== PluginStatus.ACTIVE).length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={cn(
              'rounded-md border px-4 py-2 text-[13px] font-medium transition-colors',
              filter === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border-strong bg-surface text-subtle-foreground hover:bg-surface-2 hover:text-foreground',
            )}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-6">
        {filteredPlugins.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<Plug />}
              title="No plugins found"
              description={
                filter === 'all'
                  ? 'Get started by installing your first plugin.'
                  : `No ${filter} plugins found.`
              }
              action={
                filter === 'all' ? (
                  <Button
                    variant="primary"
                    onClick={() => setShowInstaller(true)}
                  >
                    <Plus className="size-4" />
                    Install Plugin
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          filteredPlugins.map(plugin => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onAction={handlePluginAction}
            />
          ))
        )}
      </div>

      {showInstaller && (
        <PluginInstaller
          onClose={() => setShowInstaller(false)}
          onSuccess={handleInstallSuccess}
        />
      )}
    </div>
  );
};

export default PluginManager;

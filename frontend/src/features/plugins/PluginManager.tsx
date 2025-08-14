import React, { useState, useEffect } from 'react';
import { PluginInfo, PluginStatus } from '../../types/plugin';
import { PluginService } from '../../services/pluginService';
import PluginCard from './PluginCard';
import PluginInstaller from './PluginInstaller';
import './PluginManager.css';

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
      <div className="plugin-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-manager">
      <header className="plugin-manager-header">
        <h1>Plugin Manager</h1>
        <div className="plugin-manager-actions">
          <button 
            className="install-btn"
            onClick={() => setShowInstaller(true)}
          >
            Install Plugin
          </button>
          <button 
            className="refresh-btn"
            onClick={loadPlugins}
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="plugin-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({plugins.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({plugins.filter(p => p.status === PluginStatus.ACTIVE).length})
        </button>
        <button 
          className={`filter-btn ${filter === 'inactive' ? 'active' : ''}`}
          onClick={() => setFilter('inactive')}
        >
          Inactive ({plugins.filter(p => p.status !== PluginStatus.ACTIVE).length})
        </button>
      </div>

      <div className="plugin-grid">
        {filteredPlugins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔌</div>
            <h3>No plugins found</h3>
            <p>
              {filter === 'all' 
                ? 'Get started by installing your first plugin.' 
                : `No ${filter} plugins found.`
              }
            </p>
            {filter === 'all' && (
              <button 
                className="install-btn"
                onClick={() => setShowInstaller(true)}
              >
                Install Plugin
              </button>
            )}
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

import React, { useState } from 'react';
import { PluginInfo, PluginStatus, PluginType } from '../../types/plugin';

interface PluginCardProps {
  plugin: PluginInfo;
  onAction: (pluginId: string, action: 'start' | 'stop' | 'uninstall') => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onAction }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getStatusColor = (status: PluginStatus) => {
    switch (status) {
      case PluginStatus.ACTIVE:
        return '#28a745';
      case PluginStatus.INACTIVE:
        return '#6c757d';
      case PluginStatus.STARTING:
        return '#ffc107';
      case PluginStatus.STOPPING:
        return '#fd7e14';
      case PluginStatus.ERROR:
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getTypeIcon = (type: PluginType) => {
    switch (type) {
      case PluginType.USER_INTERFACE:
        return '🎨';
      case PluginType.DATA_PROCESSOR:
        return '⚙️';
      case PluginType.INTEGRATION:
        return '🔗';
      case PluginType.UTILITY:
        return '🛠️';
      default:
        return '🔌';
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'uninstall') => {
    setActionLoading(action);
    try {
      await onAction(plugin.id, action);
    } finally {
      setActionLoading(null);
    }
  };

  const canStart = plugin.status === PluginStatus.INACTIVE;
  const canStop = plugin.status === PluginStatus.ACTIVE;
  const isTransitioning = plugin.status === PluginStatus.STARTING || plugin.status === PluginStatus.STOPPING;

  return (
    <div className={`plugin-card ${plugin.status.toLowerCase()}`}>
      <div className="plugin-card-header">
        <div className="plugin-icon">
          {getTypeIcon(plugin.type)}
        </div>
        <div className="plugin-info">
          <h3 className="plugin-name">{plugin.name}</h3>
          <p className="plugin-version">v{plugin.version}</p>
        </div>
        <div className="plugin-status">
          <span 
            className="status-indicator"
            style={{ backgroundColor: getStatusColor(plugin.status) }}
          >
            {plugin.status}
          </span>
        </div>
      </div>

      <div className="plugin-card-body">
        <p className="plugin-description">{plugin.description}</p>
        <div className="plugin-meta">
          <span className="plugin-author">by {plugin.author}</span>
          <span className="plugin-type">{plugin.type.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="plugin-card-actions">
        <div className="primary-actions">
          {canStart && (
            <button
              className="action-btn start-btn"
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
            >
              {actionLoading === 'start' ? 'Starting...' : 'Enable'}
            </button>
          )}
          
          {canStop && (
            <button
              className="action-btn stop-btn"
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop'}
            >
              {actionLoading === 'stop' ? 'Stopping...' : 'Disable'}
            </button>
          )}

          {isTransitioning && (
            <button className="action-btn" disabled>
              {plugin.status}...
            </button>
          )}
        </div>

        <div className="secondary-actions">
          <button
            className="action-btn details-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Details'}
          </button>
          
          <button
            className="action-btn uninstall-btn"
            onClick={() => handleAction('uninstall')}
            disabled={actionLoading === 'uninstall' || plugin.status === PluginStatus.ACTIVE}
            title={plugin.status === PluginStatus.ACTIVE ? 'Disable plugin before uninstalling' : 'Uninstall plugin'}
          >
            {actionLoading === 'uninstall' ? 'Removing...' : 'Uninstall'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="plugin-details">
          <div className="detail-row">
            <label>Runtime:</label>
            <span>{plugin.runtime}</span>
          </div>
          <div className="detail-row">
            <label>JAR Path:</label>
            <span className="jar-path">{plugin.jarPath}</span>
          </div>
          <div className="detail-row">
            <label>Registered:</label>
            <span>{new Date(plugin.registeredAt).toLocaleDateString()}</span>
          </div>
          <div className="detail-row">
            <label>Updated:</label>
            <span>{new Date(plugin.updatedAt).toLocaleDateString()}</span>
          </div>
          {plugin.requiredPermissions && plugin.requiredPermissions.length > 0 && (
            <div className="detail-row">
              <label>Permissions:</label>
              <div className="permissions-list">
                {plugin.requiredPermissions.map((permission, index) => (
                  <span key={index} className="permission-tag">
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PluginCard;

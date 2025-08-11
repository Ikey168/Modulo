import React, { useState, useEffect } from 'react';
import { networkStatusService, NetworkStatus } from '../../services/networkStatus';
import './NetworkStatusIndicator.css';

interface NetworkStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Add listener for status changes
    const handleStatusChange = (newStatus: NetworkStatus) => {
      setStatus(newStatus);
    };

    networkStatusService.addListener(handleStatusChange);
    
    // Start monitoring if not already started
    networkStatusService.startMonitoring();

    return () => {
      networkStatusService.removeListener(handleStatusChange);
    };
  }, []);

  const handleForceSync = async () => {
    if (!status?.online || isSyncing) return;

    try {
      setIsSyncing(true);
      const result = await networkStatusService.forceSync();
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleForceNetworkCheck = async () => {
    try {
      await networkStatusService.forceNetworkCheck();
    } catch (error) {
      console.error('Network check failed:', error);
    }
  };

  if (!status) {
    return (
      <div className={`network-status-indicator checking ${className}`}>
        <div className="status-dot"></div>
        <span>Checking...</span>
      </div>
    );
  }

  const getStatusClass = () => {
    if (!status.online) return 'offline';
    if (status.syncInProgress || isSyncing) return 'syncing';
    if (status.pendingSyncCount > 0) return 'pending';
    return 'online';
  };

  const getStatusText = () => {
    if (!status.online) return 'Offline';
    if (status.syncInProgress || isSyncing) return 'Syncing...';
    if (status.pendingSyncCount > 0) return `${status.pendingSyncCount} pending`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!status.online) return '📱';
    if (status.syncInProgress || isSyncing) return '🔄';
    if (status.pendingSyncCount > 0) return '⏳';
    return '🌐';
  };

  return (
    <div 
      className={`network-status-indicator ${getStatusClass()} ${className} ${showDetails ? 'detailed' : ''}`}
      onClick={() => showDetails && setIsExpanded(!isExpanded)}
    >
      <div className="status-basic">
        <div className="status-dot"></div>
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
        {showDetails && (
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        )}
      </div>

      {showDetails && isExpanded && (
        <div className="status-details">
          <div className="detail-row">
            <span className="label">Connection:</span>
            <span className={`value ${status.online ? 'online' : 'offline'}`}>
              {status.online ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="label">Sync Status:</span>
            <span className="value">
              {status.syncInProgress || isSyncing ? 'In Progress' : 'Idle'}
            </span>
          </div>
          
          {status.pendingSyncCount > 0 && (
            <div className="detail-row">
              <span className="label">Pending Changes:</span>
              <span className="value warning">
                {status.pendingSyncCount} item{status.pendingSyncCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          <div className="detail-actions">
            <button 
              onClick={handleForceNetworkCheck}
              className="action-btn secondary"
              title="Check network connection"
            >
              Check Network
            </button>
            
            {status.online && status.pendingSyncCount > 0 && (
              <button 
                onClick={handleForceSync}
                disabled={isSyncing || status.syncInProgress}
                className="action-btn primary"
                title="Sync pending changes now"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
          
          <div className="last-updated">
            Last updated: {new Date(status.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;

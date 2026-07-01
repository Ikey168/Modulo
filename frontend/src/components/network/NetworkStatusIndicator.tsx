import React, { useState, useEffect } from 'react';
import { networkStatusService, NetworkStatus } from '../../services/networkStatus';

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

  const containerClass =
    'network-status-indicator flex min-w-[120px] cursor-pointer flex-col items-start rounded-md ' +
    'border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-2';

  if (!status) {
    return (
      <div className={`network-status-indicator checking ${containerClass} ${className}`}>
        <div className="status-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-[13px] font-medium text-subtle-foreground">Checking...</span>
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

  const getDotClass = () => {
    if (!status.online) return 'bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.5)]';
    if (status.syncInProgress || isSyncing) return 'bg-info shadow-[0_0_6px_rgba(59,130,246,0.5)] animate-pulse';
    if (status.pendingSyncCount > 0) return 'bg-warning shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    return 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]';
  };

  return (
    <div
      className={`network-status-indicator ${getStatusClass()} ${containerClass} ${className} ${showDetails ? 'detailed' : ''}`}
      onClick={() => showDetails && setIsExpanded(!isExpanded)}
    >
      <div className="status-basic flex w-full items-center gap-2">
        <div className={`status-dot h-2 w-2 rounded-full transition-colors ${getDotClass()}`} />
        <span className="status-icon text-base leading-none">{getStatusIcon()}</span>
        <span className="status-text flex-1 text-[13px] font-medium text-foreground">{getStatusText()}</span>
        {showDetails && (
          <span className="expand-icon text-[10px] text-muted-foreground">{isExpanded ? '▼' : '▶'}</span>
        )}
      </div>

      {showDetails && isExpanded && (
        <div className="status-details mt-3 w-full animate-fade-up border-t border-border pt-3">
          <div className="detail-row mb-2 flex items-center justify-between text-xs">
            <span className="label font-medium text-muted-foreground">Connection:</span>
            <span className={`value font-semibold ${status.online ? 'text-success' : 'text-destructive'}`}>
              {status.online ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="detail-row mb-2 flex items-center justify-between text-xs">
            <span className="label font-medium text-muted-foreground">Sync Status:</span>
            <span className="value font-semibold text-foreground">
              {status.syncInProgress || isSyncing ? 'In Progress' : 'Idle'}
            </span>
          </div>

          {status.pendingSyncCount > 0 && (
            <div className="detail-row mb-2 flex items-center justify-between text-xs">
              <span className="label font-medium text-muted-foreground">Pending Changes:</span>
              <span className="value warning font-semibold text-warning">
                {status.pendingSyncCount} item{status.pendingSyncCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="detail-actions mb-2 mt-3 flex gap-2">
            <button
              onClick={handleForceNetworkCheck}
              className="action-btn secondary flex-1 rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Check network connection"
            >
              Check Network
            </button>

            {status.online && status.pendingSyncCount > 0 && (
              <button
                onClick={handleForceSync}
                disabled={isSyncing || status.syncInProgress}
                className="action-btn primary flex-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                title="Sync pending changes now"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>

          <div className="last-updated mt-2 text-center text-[10px] italic text-muted-foreground">
            Last updated: {new Date(status.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;

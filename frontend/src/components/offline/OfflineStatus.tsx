import React, { useState, useEffect } from 'react';
import { offlineNoteService, SyncStatus, useNetworkStatus } from '../../services/offlineNotes';

interface OfflineStatusProps {
  onSyncComplete?: () => void;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isOnline = useNetworkStatus();

  // Load sync status
  const loadSyncStatus = async () => {
    try {
      const status = await offlineNoteService.getSyncStatus();
      setSyncStatus(status);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load sync status:', err);
      setError('Failed to load sync status');
    }
  };

  // Force sync
  const handleForceSync = async () => {
    if (!isOnline) {
      setError('Cannot sync while offline');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await offlineNoteService.forceSync();

      // Wait a moment then refresh status
      setTimeout(async () => {
        await loadSyncStatus();
        if (onSyncComplete) {
          onSyncComplete();
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to force sync:', err);
      setError('Failed to sync with server');
    } finally {
      setLoading(false);
    }
  };

  // Load initial status and set up polling
  useEffect(() => {
    loadSyncStatus();

    // Poll for status updates every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Don't render if no sync status available
  if (!syncStatus) {
    return null;
  }

  const totalPending = syncStatus.pendingSyncCount + syncStatus.pendingDeleteCount;
  const isFullySynced = totalPending === 0 && !syncStatus.syncInProgress;

  return (
    <div
      className={`offline-status flex animate-fade-in flex-col gap-2 rounded-lg border p-3 text-sm shadow-sm transition-colors ${
        !isOnline ? 'offline border-warning/40 bg-warning/10' : 'border-border bg-surface'
      }`}
    >
      <div className="status-content flex items-center justify-between gap-4">
        {/* Network Status */}
        <div
          className={`network-indicator flex items-center gap-2 font-medium ${
            isOnline ? 'online text-success' : 'offline text-destructive'
          }`}
        >
          <span className="network-icon text-[1.1rem]">
            {isOnline ? '🌐' : '📱'}
          </span>
          <span className="network-text text-sm">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Sync Status */}
        <div className="sync-status flex flex-1 items-center justify-center gap-2">
          {syncStatus.syncInProgress ? (
            <div className="syncing flex items-center gap-2 font-medium text-info">
              <span className="sync-icon spinning inline-block animate-spin text-base">🔄</span>
              <span>Syncing...</span>
            </div>
          ) : isFullySynced ? (
            <div className="synced flex items-center gap-2 font-medium text-success">
              <span className="sync-icon text-base">✅</span>
              <span>All synced</span>
            </div>
          ) : (
            <div className="pending flex items-center gap-2 font-medium text-warning">
              <span className="sync-icon text-base">⏳</span>
              <span>{totalPending} pending</span>
            </div>
          )}
        </div>

        {/* Sync Actions */}
        <div className="sync-actions flex items-center">
          {isOnline && totalPending > 0 && (
            <button
              onClick={handleForceSync}
              disabled={loading || syncStatus.syncInProgress}
              className="sync-button flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              title="Force sync with server"
            >
              {loading ? '⟳' : '🔄'} Sync
            </button>
          )}
        </div>
      </div>

      {/* Detailed Status */}
      {(syncStatus.pendingSyncCount > 0 || syncStatus.pendingDeleteCount > 0) && (
        <div className="detailed-status flex gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
          {syncStatus.pendingSyncCount > 0 && (
            <span className="pending-item flex items-center gap-1">
              📝 {syncStatus.pendingSyncCount} to sync
            </span>
          )}
          {syncStatus.pendingDeleteCount > 0 && (
            <span className="pending-item flex items-center gap-1">
              🗑️ {syncStatus.pendingDeleteCount} to delete
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="status-error flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/15 p-2 text-xs text-destructive">
          <span className="error-icon text-base">⚠️</span>
          <span className="error-text flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="error-dismiss rounded p-0.5 leading-none text-destructive transition-colors hover:bg-destructive/20"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && !syncStatus.syncInProgress && (
        <div className="last-updated mt-1 text-center text-[0.625rem] text-muted-foreground">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default OfflineStatus;

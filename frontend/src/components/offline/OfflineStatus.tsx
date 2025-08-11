import React, { useState, useEffect } from 'react';
import { offlineNoteService, SyncStatus, useNetworkStatus } from '../../services/offlineNotes';
import './OfflineStatus.css';

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
    <div className={`offline-status ${!isOnline ? 'offline' : ''}`}>
      <div className="status-content">
        {/* Network Status */}
        <div className={`network-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="network-icon">
            {isOnline ? '🌐' : '📱'}
          </span>
          <span className="network-text">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Sync Status */}
        <div className="sync-status">
          {syncStatus.syncInProgress ? (
            <div className="syncing">
              <span className="sync-icon spinning">🔄</span>
              <span>Syncing...</span>
            </div>
          ) : isFullySynced ? (
            <div className="synced">
              <span className="sync-icon">✅</span>
              <span>All synced</span>
            </div>
          ) : (
            <div className="pending">
              <span className="sync-icon">⏳</span>
              <span>{totalPending} pending</span>
            </div>
          )}
        </div>

        {/* Sync Actions */}
        <div className="sync-actions">
          {isOnline && totalPending > 0 && (
            <button
              onClick={handleForceSync}
              disabled={loading || syncStatus.syncInProgress}
              className="sync-button"
              title="Force sync with server"
            >
              {loading ? '⟳' : '🔄'} Sync
            </button>
          )}
        </div>
      </div>

      {/* Detailed Status */}
      {(syncStatus.pendingSyncCount > 0 || syncStatus.pendingDeleteCount > 0) && (
        <div className="detailed-status">
          {syncStatus.pendingSyncCount > 0 && (
            <span className="pending-item">
              📝 {syncStatus.pendingSyncCount} to sync
            </span>
          )}
          {syncStatus.pendingDeleteCount > 0 && (
            <span className="pending-item">
              🗑️ {syncStatus.pendingDeleteCount} to delete
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="status-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button
            onClick={() => setError(null)}
            className="error-dismiss"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && !syncStatus.syncInProgress && (
        <div className="last-updated">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default OfflineStatus;

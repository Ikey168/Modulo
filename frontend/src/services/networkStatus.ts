import { api } from './api';

export interface NetworkStatus {
  online: boolean;
  syncInProgress: boolean;
  pendingSyncCount: number;
  timestamp: number;
}

export interface SyncStatus {
  syncInProgress: boolean;
  pendingSyncCount: number;
  detailed?: {
    pendingSyncCount: number;
    lastSyncTime: string;
    totalSyncedCount: number;
  };
}

class NetworkStatusService {
  private listeners: ((status: NetworkStatus) => void)[] = [];
  private currentStatus: NetworkStatus | null = null;
  private pollingInterval: number | null = null;

  /**
   * Start monitoring network status
   */
  startMonitoring(intervalMs: number = 5000) {
    if (this.pollingInterval) {
      this.stopMonitoring();
    }

    // Initial check
    this.checkNetworkStatus();

    // Set up polling
    this.pollingInterval = window.setInterval(() => {
      this.checkNetworkStatus();
    }, intervalMs);

    // Listen to browser network events
    window.addEventListener('online', this.handleBrowserOnline);
    window.addEventListener('offline', this.handleBrowserOffline);
  }

  /**
   * Stop monitoring network status
   */
  stopMonitoring() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);
  }

  /**
   * Add a listener for network status changes
   */
  addListener(listener: (status: NetworkStatus) => void) {
    this.listeners.push(listener);
    
    // Send current status immediately if available
    if (this.currentStatus) {
      listener(this.currentStatus);
    }
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (status: NetworkStatus) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Get current network status
   */
  getCurrentStatus(): NetworkStatus | null {
    return this.currentStatus;
  }

  /**
   * Check network status from the server
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    try {
      const response = await api.get('/api/network/status');
      const status = response as NetworkStatus;
      
      // Update current status and notify listeners
      this.updateStatus(status);
      
      return status;
    } catch (error) {
      console.error('Failed to check network status:', error);
      
      // Fallback to browser navigator status
      const fallbackStatus: NetworkStatus = {
        online: navigator.onLine,
        syncInProgress: false,
        pendingSyncCount: 0,
        timestamp: Date.now()
      };
      
      this.updateStatus(fallbackStatus);
      return fallbackStatus;
    }
  }

  /**
   * Force a network check on the server
   */
  async forceNetworkCheck(): Promise<NetworkStatus> {
    try {
      const response = await api.post('/api/network/check', {});
      const status = response as NetworkStatus;
      
      this.updateStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to force network check:', error);
      throw error;
    }
  }

  /**
   * Force a sync of offline changes
   */
  async forceSync(): Promise<{ status: string; message: string }> {
    try {
      const response = await api.post('/api/network/sync', {});
      
      // Refresh network status after sync
      setTimeout(() => this.checkNetworkStatus(), 1000);
      
      return response as { status: string; message: string };
    } catch (error) {
      console.error('Failed to force sync:', error);
      throw error;
    }
  }

  /**
   * Get detailed sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const response = await api.get('/api/network/sync/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  /**
   * Handle browser online event
   */
  private handleBrowserOnline = () => {
    console.log('Browser detected online status');
    this.checkNetworkStatus();
  };

  /**
   * Handle browser offline event
   */
  private handleBrowserOffline = () => {
    console.log('Browser detected offline status');
    if (this.currentStatus) {
      this.updateStatus({
        ...this.currentStatus,
        online: false,
        timestamp: Date.now()
      });
    }
  };

  /**
   * Update status and notify listeners
   */
  private updateStatus(newStatus: NetworkStatus) {
    const previousStatus = this.currentStatus;
    this.currentStatus = newStatus;

    // Check for significant changes
    const significantChange = !previousStatus || 
      previousStatus.online !== newStatus.online ||
      previousStatus.syncInProgress !== newStatus.syncInProgress ||
      previousStatus.pendingSyncCount !== newStatus.pendingSyncCount;

    if (significantChange) {
      console.log('Network status changed:', newStatus);
      
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(newStatus);
        } catch (error) {
          console.error('Error in network status listener:', error);
        }
      });
    }
  }
}

export const networkStatusService = new NetworkStatusService();

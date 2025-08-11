import { useEffect, useCallback, useState } from 'react';
import webSocketService, { NoteUpdateMessage, NoteUpdateCallback } from '../services/websocket';

export interface UseWebSocketReturn {
  isConnected: boolean;
  connectionStatus: string;
  subscribe: (callback: NoteUpdateCallback) => () => void;
}

/**
 * React hook for WebSocket note updates
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(webSocketService.isWebSocketConnected());
  const [connectionStatus, setConnectionStatus] = useState(webSocketService.getConnectionStatus());

  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(webSocketService.isWebSocketConnected());
      setConnectionStatus(webSocketService.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const subscribe = useCallback((callback: NoteUpdateCallback) => {
    return webSocketService.subscribe(callback);
  }, []);

  return {
    isConnected,
    connectionStatus,
    subscribe
  };
};

/**
 * Hook specifically for notes list synchronization
 */
export const useNotesSync = (onNoteUpdate?: (message: NoteUpdateMessage) => void) => {
  // Temporarily disable WebSocket to focus on conflict resolution testing
  return {
    isConnected: false,
    connectionStatus: 'disabled'
  };
};

export default useWebSocket;

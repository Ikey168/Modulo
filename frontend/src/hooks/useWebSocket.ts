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
  const { isConnected, connectionStatus, subscribe } = useWebSocket();

  useEffect(() => {
    if (!onNoteUpdate) return;

    const unsubscribe = subscribe((message: NoteUpdateMessage) => {
      // Filter out updates from the current user to avoid duplicate operations
      // In a real app, you'd compare with the actual current user ID
      if (message.userId === 'current-user') {
        return;
      }
      
      onNoteUpdate(message);
    });

    return unsubscribe;
  }, [subscribe, onNoteUpdate]);

  return {
    isConnected,
    connectionStatus
  };
};

export default useWebSocket;

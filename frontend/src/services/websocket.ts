import { authService } from '../features/auth/authService';
import { authenticatedStomp } from './authenticatedStomp';
import { Client, StompSubscription, IMessage, ReconnectionTimeMode } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { workspaceSocketUrl } from './workspaceSocketUrl';

// Types for WebSocket messages
export interface NoteUpdateMessage {
  eventType: 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED' | 'NOTE_LINK_CREATED' | 'NOTE_LINK_DELETED';
  noteId?: number;
  title?: string;
  content?: string;
  tagNames?: string[];
  timestamp: string;
  userId: string;
  
  // Link-specific fields
  linkId?: string;
  sourceNoteId?: number;
  targetNoteId?: number;
  linkType?: string;
}

export type NoteUpdateCallback = (message: NoteUpdateMessage) => void;

export interface PluginStateUpdateMessage {
  eventId: number;
  ownerId: number;
  workspace: string;
  namespace: string;
  key: string;
  operation: string;
  version: number;
  schemaId: string;
  schemaVersion: number;
  plugin: string;
  requestId: string;
}

export type PluginStateUpdateCallback = (message: PluginStateUpdateMessage) => void;

class WebSocketService {
  private client: Client | null = null;
  private noteSubscription: StompSubscription | null = null;
  private stateSubscription: StompSubscription | null = null;
  private isConnected = false;
  private callbacks: Set<NoteUpdateCallback> = new Set();
  private stateCallbacks: Set<PluginStateUpdateCallback> = new Set();
  private reconnectAttempts = 0;



  constructor() {
    let identity = this.account();
    authService.subscribeSession(() => {
      const next = this.account();
      if (next === identity) return;
      identity = next;
      this.disconnect();
      if (next) void this.connect();
    });
  }

  private account(): string {
    const session = authService.stateSession();
    return session ? JSON.stringify([session.issuer, session.subject]) : '';
  }

  private initializeClient() {
    const client = authenticatedStomp({
      webSocketFactory: () => new SockJS(workspaceSocketUrl()),
      reconnectDelay: 1000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 30000,
      debug: () => {},
      onConnect: () => {
        if (this.client !== client) return;
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        this.subscribeToNotes();
        this.subscribeToPluginState();
      },
      onDisconnect: () => {
        if (this.client !== client) return;
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.noteSubscription = null;
        this.stateSubscription = null;
      },
      onStompError: (frame) => {
        if (this.client !== client) return;
        console.error('WebSocket STOMP error:', frame);
        this.reconnectAttempts++;
      },
      onWebSocketClose: () => {
        if (this.client !== client) return;
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.noteSubscription = null;
        this.stateSubscription = null;
        this.reconnectAttempts++;
      },
      onWebSocketError: (error) => {
        if (this.client !== client) return;
        console.error('WebSocket error:', error);
        this.reconnectAttempts++;
      }
    });
    this.client = client;
  }

  private subscribeToNotes() {
    if (!this.client || !this.isConnected) {
      return;
    }

    this.noteSubscription = this.client.subscribe('/user/queue/notes', (message: IMessage) => {
      try {
        const noteUpdate: NoteUpdateMessage = JSON.parse(message.body);

        
        // Notify all registered callbacks
        this.callbacks.forEach(callback => {
          try {
            callback(noteUpdate);
          } catch (error) {
            console.error('Error in WebSocket callback:', error);
          }
        });
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  }

  private subscribeToPluginState() {
    if (!this.client || !this.isConnected) return;

    this.stateSubscription = this.client.subscribe('/user/queue/state', (message: IMessage) => {
      try {
        const update: PluginStateUpdateMessage = JSON.parse(message.body);
        this.stateCallbacks.forEach(callback => {
          try {
            callback(update);
          } catch (error) {
            console.error('Error in plugin state WebSocket callback:', error);
          }
        });
      } catch (error) {
        console.error('Error parsing plugin state WebSocket message:', error);
      }
    });
  }

  public async connect(): Promise<void> {
    if (!this.account() || this.isConnected || this.client?.active) return;
    if (!this.client) this.initializeClient();
    this.client!.activate();
  }

  public disconnect() {
    this.noteSubscription?.unsubscribe();
    this.noteSubscription = null;
    this.stateSubscription?.unsubscribe();
    this.stateSubscription = null;

    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }

    this.isConnected = false;
  }

  public subscribe(callback: NoteUpdateCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public subscribeState(callback: PluginStateUpdateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  public getConnectionStatus(): string {
    if (this.isConnected) {
      return 'Connected';
    } else if (this.reconnectAttempts > 0) {
      return `Reconnecting... (${this.reconnectAttempts})`;
    } else {
      return 'Disconnected';
    }
  }
}

// Create a singleton instance
export const webSocketService = new WebSocketService();

// Auto-connect when the service is imported
webSocketService.connect().catch(error => {
  console.error('Failed to connect WebSocket:', error);
});

export default webSocketService;

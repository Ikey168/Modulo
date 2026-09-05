import { authService } from '../features/auth/authService';
import { authenticatedStomp } from './authenticatedStomp';
import { Client, StompSubscription, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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

class WebSocketService {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private isConnected = false;
  private callbacks: Set<NoteUpdateCallback> = new Set();
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
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 1000,
      debug: () => {},
      onConnect: () => {
        if (this.client !== client) return;
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        this.subscribeToNotes();
      },
      onDisconnect: () => {
        if (this.client !== client) return;
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.subscription = null;
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

    this.subscription = this.client.subscribe('/user/queue/notes', (message: IMessage) => {
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

  public async connect(): Promise<void> {
    if (!this.account() || this.isConnected) return;
    if (!this.client) this.initializeClient();
    this.client!.activate();
  }

  public disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }

    this.isConnected = false;
    this.callbacks.clear();
  }

  public subscribe(callback: NoteUpdateCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
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

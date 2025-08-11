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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      debug: (str) => {
        console.log('WebSocket Debug:', str);
      },
      onConnect: () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.subscribeToNotes();
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.subscription = null;
      },
      onStompError: (frame) => {
        console.error('WebSocket STOMP error:', frame);
        this.handleReconnect();
      },
      onWebSocketClose: () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.handleReconnect();
      },
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
        this.handleReconnect();
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }

  private subscribeToNotes() {
    if (!this.client || !this.isConnected) {
      return;
    }

    this.subscription = this.client.subscribe('/topic/notes', (message: IMessage) => {
      try {
        const noteUpdate: NoteUpdateMessage = JSON.parse(message.body);
        console.log('Received note update:', noteUpdate);
        
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

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || !this.client) {
        resolve();
        return;
      }

      const originalOnConnect = this.client.onConnect;
      const originalOnError = this.client.onStompError;

      const onConnect = () => {
        this.client!.onConnect = originalOnConnect;
        resolve();
      };

      const onError = (error: any) => {
        this.client!.onStompError = originalOnError;
        reject(error);
      };

      this.client.onConnect = onConnect;
      this.client.onStompError = onError;

      try {
        this.client.activate();
      } catch (error) {
        reject(error);
      }
    });
  }

  public disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    if (this.client) {
      this.client.deactivate();
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
      return `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
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

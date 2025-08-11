// Offline service for handling note operations when server is unavailable
import React from 'react';

export interface Tag {
  name: string;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  markdownContent?: string;
  tags?: Tag[];
}

export interface OfflineNote {
  id: number;
  serverId?: number;
  title: string;
  content: string;
  markdownContent: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  lastSynced?: string;
  syncStatus: 'SYNCED' | 'PENDING_SYNC' | 'PENDING_DELETE';
  isDeleted: boolean;
  version: number;
}

export interface SyncStatus {
  pendingSyncCount: number;
  pendingDeleteCount: number;
  syncInProgress: boolean;
}

class OfflineNoteService {
  private baseUrl = '/api/offline/notes';

  // Create a note offline
  async createOfflineNote(title: string, content: string, tags: string[]): Promise<OfflineNote> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        tagNames: tags,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create offline note');
    }

    return response.json();
  }

  // Get all offline notes
  async getAllOfflineNotes(): Promise<OfflineNote[]> {
    const response = await fetch(this.baseUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch offline notes');
    }

    return response.json();
  }

  // Update an offline note
  async updateOfflineNote(id: number, title: string, content: string, tags: string[]): Promise<OfflineNote> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        tagNames: tags,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update offline note');
    }

    return response.json();
  }

  // Delete an offline note
  async deleteOfflineNote(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete offline note');
    }
  }

  // Search offline notes
  async searchOfflineNotes(query: string): Promise<OfflineNote[]> {
    const response = await fetch(`${this.baseUrl}/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to search offline notes');
    }

    return response.json();
  }

  // Get notes by tag
  async getOfflineNotesByTag(tag: string): Promise<OfflineNote[]> {
    const response = await fetch(`${this.baseUrl}/tag/${encodeURIComponent(tag)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch offline notes by tag');
    }

    return response.json();
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    const response = await fetch(`${this.baseUrl}/sync/status`);
    
    if (!response.ok) {
      throw new Error('Failed to get sync status');
    }

    return response.json();
  }

  // Force sync with server
  async forceSync(): Promise<{ message: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/sync/force`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to force sync');
    }

    return response.json();
  }

  // Convert OfflineNote to regular Note format for compatibility
  convertToNote(offlineNote: OfflineNote): Note {
    return {
      id: offlineNote.serverId || offlineNote.id,
      title: offlineNote.title,
      content: offlineNote.content,
      markdownContent: offlineNote.markdownContent,
      tags: this.parseTagsFromString(offlineNote.tags),
    };
  }

  // Convert regular Note to OfflineNote format
  convertFromNote(note: Note): Partial<OfflineNote> {
    return {
      serverId: note.id,
      title: note.title,
      content: note.content,
      markdownContent: note.markdownContent || note.content,
      tags: note.tags?.map((tag: Tag) => tag.name).join(',') || '',
      syncStatus: 'SYNCED' as const,
      isDeleted: false,
      version: 0,
    };
  }

  // Parse tags from comma-separated string
  private parseTagsFromString(tagsString: string): Array<{ name: string }> {
    if (!tagsString || tagsString.trim() === '') {
      return [];
    }

    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => ({ name: tag }));
  }

  // Check if device is online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Try online operation first, fallback to offline if failed
  async tryOnlineFirst<T>(
    onlineOperation: () => Promise<T>,
    offlineOperation: () => Promise<T>
  ): Promise<T> {
    if (!this.isOnline()) {
      return offlineOperation();
    }

    try {
      return await onlineOperation();
    } catch (error) {
      console.warn('Online operation failed, falling back to offline:', error);
      return offlineOperation();
    }
  }

  // Network status monitoring
  addNetworkStatusListener(callback: (isOnline: boolean) => void): (() => void) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

export const offlineNoteService = new OfflineNoteService();

// Helper hook for network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const cleanup = offlineNoteService.addNetworkStatusListener(setIsOnline);
    return cleanup;
  }, []);

  return isOnline;
}

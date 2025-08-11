// Conflict Resolution Types

export interface ConflictingNote {
  title: string;
  content: string;
  tags: string[];
}

export interface ConflictResolution {
  noteId: number;
  currentVersion: ConflictingNote;
  incomingVersion: ConflictingNote;
  conflictTime: string;
  lastEditorUser: string;
  currentUser: string;
  versionMismatch: boolean;
}

export interface ConflictMergeStrategy {
  title: 'current' | 'incoming' | 'custom';
  content: 'current' | 'incoming' | 'custom';
  tags: 'current' | 'incoming' | 'union' | 'custom';
}

export interface ResolvedConflict {
  noteId: number;
  title: string;
  content: string;
  tags: string[];
  strategy: ConflictMergeStrategy;
}

export interface ConflictAnalysis {
  titleConflict: boolean;
  contentConflict: boolean;
  tagsConflict: boolean;
  hasConflicts: boolean;
  suggestions: {
    title?: string;
    content?: string;
    tags?: string[];
    reasoning?: string;
  };
}

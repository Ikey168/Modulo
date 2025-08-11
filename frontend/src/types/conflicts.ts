export interface ConflictResolution {
  noteId: number;
  currentTitle: string;
  currentContent: string;
  incomingTitle: string;
  incomingContent: string;
  currentTagNames: string[];
  incomingTagNames: string[];
  lastModified: string;
  incomingTimestamp: string;
  lastEditor: string;
  currentEditor: string;
  expectedVersion: number;
  actualVersion: number;
}

export interface ConflictCheckRequest {
  noteId: number;
  expectedVersion: number;
  title: string;
  content: string;
  tagNames: string[];
  editor: string;
}

export interface ConflictUpdateRequest {
  noteId: number;
  expectedVersion: number;
  title: string;
  content: string;
  markdownContent: string;
  tagNames: string[];
  editor: string;
}

export interface ConflictResolveRequest {
  noteId: number;
  resolvedTitle: string;
  resolvedContent: string;
  resolvedMarkdownContent: string;
  resolvedTagNames: string[];
  editor: string;
}

export interface ConflictStatus {
  hasConflict: boolean;
  hasTitleConflict: boolean;
  hasContentConflict: boolean;
  hasTagConflict: boolean;
}

import { api } from './api';
import { 
  ConflictResolution, 
  ConflictCheckRequest, 
  ConflictUpdateRequest, 
  ConflictResolveRequest 
} from '../types/conflicts';

class ConflictResolutionService {
  
  /**
   * Check for conflicts before updating a note
   */
  async checkConflicts(request: ConflictCheckRequest): Promise<ConflictResolution> {
    const response = await api.post('/conflicts/check', request);
    return response;
  }

  /**
   * Update note with conflict checking
   */
  async updateWithConflictCheck(request: ConflictUpdateRequest): Promise<any> {
    try {
      const response = await api.put('/conflicts/update', request);
      return { success: true, data: response };
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Conflict detected
        return { success: false, conflict: error.response.data };
      }
      throw error;
    }
  }

  /**
   * Force update after manual conflict resolution
   */
  async resolveConflict(request: ConflictResolveRequest): Promise<any> {
    const response = await api.put('/conflicts/resolve', request);
    return response;
  }

  /**
   * Analyze conflicts and return status
   */
  analyzeConflict(conflict: ConflictResolution): {
    hasConflict: boolean;
    hasTitleConflict: boolean;
    hasContentConflict: boolean;
    hasTagConflict: boolean;
  } {
    const hasConflict = conflict.expectedVersion !== conflict.actualVersion;
    
    const hasTitleConflict = hasConflict && 
      conflict.currentTitle !== conflict.incomingTitle;
    
    const hasContentConflict = hasConflict && 
      conflict.currentContent !== conflict.incomingContent;
    
    const hasTagConflict = hasConflict && (
      !this.arraysEqual(conflict.currentTagNames || [], conflict.incomingTagNames || [])
    );

    return {
      hasConflict,
      hasTitleConflict,
      hasContentConflict,
      hasTagConflict
    };
  }

  /**
   * Merge strategies for resolving conflicts
   */
  getMergeStrategies() {
    return {
      KEEP_CURRENT: 'keep_current',
      KEEP_INCOMING: 'keep_incoming', 
      MANUAL_MERGE: 'manual_merge'
    };
  }

  /**
   * Apply merge strategy to resolve conflicts
   */
  applyMergeStrategy(
    conflict: ConflictResolution, 
    strategy: string, 
    field: 'title' | 'content' | 'tags'
  ): string | string[] {
    const strategies = this.getMergeStrategies();
    
    switch (field) {
      case 'title':
        switch (strategy) {
          case strategies.KEEP_CURRENT:
            return conflict.currentTitle;
          case strategies.KEEP_INCOMING:
            return conflict.incomingTitle;
          default:
            return conflict.incomingTitle; // Default to incoming
        }
        
      case 'content':
        switch (strategy) {
          case strategies.KEEP_CURRENT:
            return conflict.currentContent;
          case strategies.KEEP_INCOMING:
            return conflict.incomingContent;
          default:
            return conflict.incomingContent; // Default to incoming
        }
        
      case 'tags':
        switch (strategy) {
          case strategies.KEEP_CURRENT:
            return conflict.currentTagNames || [];
          case strategies.KEEP_INCOMING:
            return conflict.incomingTagNames || [];
          case strategies.MANUAL_MERGE:
            // Merge unique tags from both
            const merged = [...(conflict.currentTagNames || [])];
            (conflict.incomingTagNames || []).forEach(tag => {
              if (!merged.includes(tag)) {
                merged.push(tag);
              }
            });
            return merged;
          default:
            return conflict.incomingTagNames || [];
        }
        
      default:
        return '';
    }
  }

  /**
   * Generate automatic merge suggestions
   */
  generateMergeSuggestions(conflict: ConflictResolution): {
    title: string;
    content: string;
    tags: string[];
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    const strategies = this.getMergeStrategies();

    // Smart merge title - prefer longer, more descriptive title
    let mergedTitle = conflict.incomingTitle;
    if (conflict.currentTitle.length > conflict.incomingTitle.length) {
      mergedTitle = conflict.currentTitle;
      suggestions.push('Kept current title as it appears more descriptive');
    } else if (conflict.currentTitle !== conflict.incomingTitle) {
      suggestions.push('Used incoming title');
    }

    // Smart merge content - this is complex, for now keep incoming
    let mergedContent = conflict.incomingContent;
    if (conflict.currentContent !== conflict.incomingContent) {
      suggestions.push('Used incoming content (manual review recommended)');
    }

    // Smart merge tags - combine unique tags
    const mergedTags = this.applyMergeStrategy(conflict, strategies.MANUAL_MERGE, 'tags') as string[];
    if (mergedTags.length > (conflict.currentTagNames?.length || 0)) {
      suggestions.push('Combined tags from both versions');
    }

    return {
      title: mergedTitle,
      content: mergedContent,
      tags: mergedTags,
      suggestions
    };
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every(item => b.includes(item)) && b.every(item => a.includes(item));
  }
}

export const conflictResolutionService = new ConflictResolutionService();

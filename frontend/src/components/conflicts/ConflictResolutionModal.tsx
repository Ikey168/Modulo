import React, { useState, useEffect } from 'react';
import { ConflictResolution } from '../../types/conflicts';
import { conflictResolutionService } from '../../services/conflictResolution';
import './ConflictResolutionModal.css';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflict: ConflictResolution | null;
  onResolve: (resolution: any) => void;
  onCancel: () => void;
}

type ResolutionStrategy = 'keep_current' | 'keep_incoming' | 'manual_merge';

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflict,
  onResolve,
  onCancel,
}) => {
  const [titleStrategy, setTitleStrategy] = useState<ResolutionStrategy>('keep_incoming');
  const [contentStrategy, setContentStrategy] = useState<ResolutionStrategy>('keep_incoming');
  const [tagsStrategy, setTagsStrategy] = useState<ResolutionStrategy>('manual_merge');
  
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  
  const [mergeSuggestions, setMergeSuggestions] = useState<any>(null);

  useEffect(() => {
    if (conflict) {
      // Generate smart merge suggestions
      const suggestions = conflictResolutionService.generateMergeSuggestions(conflict);
      setMergeSuggestions(suggestions);
      
      // Initialize custom fields with suggested values
      setCustomTitle(suggestions.title);
      setCustomContent(suggestions.content);
      setCustomTags(suggestions.tags);
    }
  }, [conflict]);

  if (!isOpen || !conflict) {
    return null;
  }

  const conflictAnalysis = conflictResolutionService.analyzeConflict(conflict);

  const handleResolve = () => {
    let resolvedTitle = conflict.incomingTitle;
    let resolvedContent = conflict.incomingContent;
    let resolvedTags = conflict.incomingTagNames || [];

    // Apply resolution strategies
    if (conflictAnalysis.hasTitleConflict) {
      if (titleStrategy === 'keep_current') {
        resolvedTitle = conflict.currentTitle;
      } else if (titleStrategy === 'manual_merge') {
        resolvedTitle = customTitle;
      }
    }

    if (conflictAnalysis.hasContentConflict) {
      if (contentStrategy === 'keep_current') {
        resolvedContent = conflict.currentContent;
      } else if (contentStrategy === 'manual_merge') {
        resolvedContent = customContent;
      }
    }

    if (conflictAnalysis.hasTagConflict) {
      if (tagsStrategy === 'keep_current') {
        resolvedTags = conflict.currentTagNames || [];
      } else if (tagsStrategy === 'manual_merge') {
        resolvedTags = customTags;
      }
    }

    const resolution = {
      noteId: conflict.noteId,
      resolvedTitle,
      resolvedContent,
      resolvedMarkdownContent: resolvedContent, // Assuming markdown content matches content
      resolvedTagNames: resolvedTags,
      editor: conflict.currentEditor,
    };

    onResolve(resolution);
  };

  const handleTagChange = (tagInput: string) => {
    const tags = tagInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setCustomTags(tags);
  };

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-modal-header">
          <h2>Resolve Edit Conflict</h2>
          <p className="conflict-description">
            Another user has modified this note while you were editing. Please resolve the conflicts below.
          </p>
        </div>

        <div className="conflict-modal-body">
          {/* Conflict Summary */}
          <div className="conflict-summary">
            <div className="conflict-info">
              <span className="editor-info">
                <strong>Your changes:</strong> {conflict.currentEditor}
              </span>
              <span className="editor-info">
                <strong>Other changes:</strong> {conflict.lastEditor} ({new Date(conflict.lastModified).toLocaleString()})
              </span>
            </div>
          </div>

          {/* Smart Suggestions */}
          {mergeSuggestions && mergeSuggestions.suggestions.length > 0 && (
            <div className="smart-suggestions">
              <h3>Smart Merge Suggestions</h3>
              <ul>
                {mergeSuggestions.suggestions.map((suggestion: string, index: number) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Title Conflict */}
          {conflictAnalysis.hasTitleConflict && (
            <div className="conflict-section">
              <h3>Title Conflict</h3>
              <div className="conflict-comparison">
                <div className="conflict-version">
                  <h4>Current Version</h4>
                  <div className="version-content current">{conflict.currentTitle}</div>
                </div>
                <div className="conflict-version">
                  <h4>Incoming Version</h4>
                  <div className="version-content incoming">{conflict.incomingTitle}</div>
                </div>
              </div>
              <div className="resolution-options">
                <label>
                  <input
                    type="radio"
                    name="title-resolution"
                    value="keep_current"
                    checked={titleStrategy === 'keep_current'}
                    onChange={() => setTitleStrategy('keep_current')}
                  />
                  Keep current version
                </label>
                <label>
                  <input
                    type="radio"
                    name="title-resolution"
                    value="keep_incoming"
                    checked={titleStrategy === 'keep_incoming'}
                    onChange={() => setTitleStrategy('keep_incoming')}
                  />
                  Use incoming version
                </label>
                <label>
                  <input
                    type="radio"
                    name="title-resolution"
                    value="manual_merge"
                    checked={titleStrategy === 'manual_merge'}
                    onChange={() => setTitleStrategy('manual_merge')}
                  />
                  Custom merge
                </label>
              </div>
              {titleStrategy === 'manual_merge' && (
                <div className="custom-input">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Enter merged title..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Content Conflict */}
          {conflictAnalysis.hasContentConflict && (
            <div className="conflict-section">
              <h3>Content Conflict</h3>
              <div className="conflict-comparison">
                <div className="conflict-version">
                  <h4>Current Version</h4>
                  <div className="version-content current content-preview">
                    {conflict.currentContent}
                  </div>
                </div>
                <div className="conflict-version">
                  <h4>Incoming Version</h4>
                  <div className="version-content incoming content-preview">
                    {conflict.incomingContent}
                  </div>
                </div>
              </div>
              <div className="resolution-options">
                <label>
                  <input
                    type="radio"
                    name="content-resolution"
                    value="keep_current"
                    checked={contentStrategy === 'keep_current'}
                    onChange={() => setContentStrategy('keep_current')}
                  />
                  Keep current version
                </label>
                <label>
                  <input
                    type="radio"
                    name="content-resolution"
                    value="keep_incoming"
                    checked={contentStrategy === 'keep_incoming'}
                    onChange={() => setContentStrategy('keep_incoming')}
                  />
                  Use incoming version
                </label>
                <label>
                  <input
                    type="radio"
                    name="content-resolution"
                    value="manual_merge"
                    checked={contentStrategy === 'manual_merge'}
                    onChange={() => setContentStrategy('manual_merge')}
                  />
                  Custom merge
                </label>
              </div>
              {contentStrategy === 'manual_merge' && (
                <div className="custom-input">
                  <textarea
                    value={customContent}
                    onChange={(e) => setCustomContent(e.target.value)}
                    placeholder="Enter merged content..."
                    rows={6}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tags Conflict */}
          {conflictAnalysis.hasTagConflict && (
            <div className="conflict-section">
              <h3>Tags Conflict</h3>
              <div className="conflict-comparison">
                <div className="conflict-version">
                  <h4>Current Tags</h4>
                  <div className="version-content current">
                    <div className="tags-display">
                      {(conflict.currentTagNames || []).map((tag, index) => (
                        <span key={index} className="tag current-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="conflict-version">
                  <h4>Incoming Tags</h4>
                  <div className="version-content incoming">
                    <div className="tags-display">
                      {(conflict.incomingTagNames || []).map((tag, index) => (
                        <span key={index} className="tag incoming-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="resolution-options">
                <label>
                  <input
                    type="radio"
                    name="tags-resolution"
                    value="keep_current"
                    checked={tagsStrategy === 'keep_current'}
                    onChange={() => setTagsStrategy('keep_current')}
                  />
                  Keep current tags
                </label>
                <label>
                  <input
                    type="radio"
                    name="tags-resolution"
                    value="keep_incoming"
                    checked={tagsStrategy === 'keep_incoming'}
                    onChange={() => setTagsStrategy('keep_incoming')}
                  />
                  Use incoming tags
                </label>
                <label>
                  <input
                    type="radio"
                    name="tags-resolution"
                    value="manual_merge"
                    checked={tagsStrategy === 'manual_merge'}
                    onChange={() => setTagsStrategy('manual_merge')}
                  />
                  Merge all tags
                </label>
              </div>
              {tagsStrategy === 'manual_merge' && (
                <div className="custom-input">
                  <input
                    type="text"
                    value={customTags.join(', ')}
                    onChange={(e) => handleTagChange(e.target.value)}
                    placeholder="Enter merged tags (comma-separated)..."
                  />
                  <div className="merged-tags-preview">
                    {customTags.map((tag, index) => (
                      <span key={index} className="tag merged-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="conflict-modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleResolve}>
            Resolve Conflict
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;

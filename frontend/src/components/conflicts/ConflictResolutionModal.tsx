import React, { useState, useEffect } from 'react';
import { ConflictResolution } from '../../types/conflicts';
import { conflictResolutionService } from '../../services/conflictResolution';
import './ConflictResolutionModal.css';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflict: ConflictResolution;
  onResolve: (resolution: any) => void;
  onCancel: () => void;
  userName: string;
}

interface ResolutionData {
  resolvedTitle: string;
  resolvedContent: string;
  resolvedMarkdownContent: string;
  resolvedTagNames: string[];
  editor: string;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflict,
  onResolve,
  onCancel,
  userName
}) => {
  const [titleChoice, setTitleChoice] = useState<'current' | 'incoming' | 'custom'>('incoming');
  const [contentChoice, setContentChoice] = useState<'current' | 'incoming' | 'custom'>('incoming');
  const [tagChoice, setTagChoice] = useState<'current' | 'incoming' | 'merge'>('merge');
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [showAutoMerge, setShowAutoMerge] = useState(false);
  const [autoMergeApplied, setAutoMergeApplied] = useState(false);

  // Initialize with conflict data
  useEffect(() => {
    if (conflict) {
      setCustomTitle(conflict.incomingTitle);
      setCustomContent(conflict.incomingContent);
    }
  }, [conflict]);

  if (!isOpen || !conflict) return null;

  const conflictStatus = conflictResolutionService.analyzeConflict(conflict);
  const mergeSuggestions = conflictResolutionService.generateMergeSuggestions(conflict);

  const applyAutoMerge = () => {
    setTitleChoice(mergeSuggestions.title === conflict.currentTitle ? 'current' : 'incoming');
    setContentChoice('incoming'); // Auto-merge defaults to incoming for content
    setTagChoice('merge');
    setCustomTitle(mergeSuggestions.title);
    setCustomContent(mergeSuggestions.content);
    setAutoMergeApplied(true);
  };

  const handleResolve = () => {
    const resolutionData: ResolutionData = {
      resolvedTitle: titleChoice === 'custom' ? customTitle : 
                   titleChoice === 'current' ? conflict.currentTitle : conflict.incomingTitle,
      resolvedContent: contentChoice === 'custom' ? customContent :
                     contentChoice === 'current' ? conflict.currentContent : conflict.incomingContent,
      resolvedMarkdownContent: contentChoice === 'custom' ? customContent :
                             contentChoice === 'current' ? conflict.currentContent : conflict.incomingContent,
      resolvedTagNames: tagChoice === 'current' ? conflict.currentTagNames :
                       tagChoice === 'incoming' ? conflict.incomingTagNames :
                       mergeSuggestions.tags,
      editor: userName
    };

    onResolve({
      noteId: conflict.noteId,
      ...resolutionData
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="conflict-modal-overlay" onClick={onCancel}>
      <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
        <div className="conflict-modal-header">
          <h2>⚠️ Conflict Resolution Required</h2>
          <button 
            className="conflict-modal-close" 
            onClick={onCancel}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="conflict-modal-content">
          <div className="conflict-info">
            <div className="conflict-alert">
              <p><strong>A conflict has occurred!</strong></p>
              <p>
                This note was modified by <strong>{conflict.lastEditor}</strong> at{' '}
                {formatTimestamp(conflict.lastModified)} while you were editing it.
              </p>
              <p>Please review the changes and choose how to resolve the conflicts.</p>
            </div>

            {/* Auto-merge section */}
            <div className="auto-merge-section">
              <button
                className="btn btn-primary btn-small"
                onClick={() => setShowAutoMerge(!showAutoMerge)}
                disabled={autoMergeApplied}
              >
                {showAutoMerge ? 'Hide' : 'Show'} Smart Merge Suggestions
              </button>
              
              {!autoMergeApplied && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={applyAutoMerge}
                >
                  Apply Smart Merge
                </button>
              )}

              {autoMergeApplied && (
                <span className="option-meta">✅ Smart merge applied</span>
              )}

              {showAutoMerge && (
                <div className="merge-suggestions">
                  <h4>Smart Merge Suggestions:</h4>
                  <ul>
                    {mergeSuggestions.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Title Conflict Resolution */}
          {conflictStatus.hasTitleConflict && (
            <div className="conflict-section">
              <h3>Title Conflict</h3>
              <div className="conflict-options">
                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="title"
                      value="current"
                      checked={titleChoice === 'current'}
                      onChange={() => setTitleChoice('current')}
                    />
                    <span>
                      Keep Current Version
                      <span className="option-meta">by {conflict.lastEditor}</span>
                    </span>
                  </label>
                  <div className="content-preview">{conflict.currentTitle}</div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="title"
                      value="incoming"
                      checked={titleChoice === 'incoming'}
                      onChange={() => setTitleChoice('incoming')}
                    />
                    <span>
                      Use Your Version
                      <span className="option-meta">by {conflict.currentEditor}</span>
                    </span>
                  </label>
                  <div className="content-preview">{conflict.incomingTitle}</div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="title"
                      value="custom"
                      checked={titleChoice === 'custom'}
                      onChange={() => setTitleChoice('custom')}
                    />
                    <span>Custom Title</span>
                  </label>
                  {titleChoice === 'custom' && (
                    <input
                      type="text"
                      className="custom-input"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Enter custom title..."
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content Conflict Resolution */}
          {conflictStatus.hasContentConflict && (
            <div className="conflict-section">
              <h3>Content Conflict</h3>
              <div className="conflict-options">
                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="content"
                      value="current"
                      checked={contentChoice === 'current'}
                      onChange={() => setContentChoice('current')}
                    />
                    <span>
                      Keep Current Version
                      <span className="option-meta">by {conflict.lastEditor}</span>
                    </span>
                  </label>
                  <div className="content-preview">
                    {conflict.currentContent.substring(0, 200)}
                    {conflict.currentContent.length > 200 ? '...' : ''}
                  </div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="content"
                      value="incoming"
                      checked={contentChoice === 'incoming'}
                      onChange={() => setContentChoice('incoming')}
                    />
                    <span>
                      Use Your Version
                      <span className="option-meta">by {conflict.currentEditor}</span>
                    </span>
                  </label>
                  <div className="content-preview">
                    {conflict.incomingContent.substring(0, 200)}
                    {conflict.incomingContent.length > 200 ? '...' : ''}
                  </div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="content"
                      value="custom"
                      checked={contentChoice === 'custom'}
                      onChange={() => setContentChoice('custom')}
                    />
                    <span>Manual Merge</span>
                  </label>
                  {contentChoice === 'custom' && (
                    <textarea
                      className="custom-textarea"
                      value={customContent}
                      onChange={(e) => setCustomContent(e.target.value)}
                      placeholder="Manually merge the content..."
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tag Conflict Resolution */}
          {conflictStatus.hasTagConflict && (
            <div className="conflict-section">
              <h3>Tag Conflict</h3>
              <div className="conflict-options">
                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="tags"
                      value="current"
                      checked={tagChoice === 'current'}
                      onChange={() => setTagChoice('current')}
                    />
                    <span>
                      Keep Current Tags
                      <span className="option-meta">by {conflict.lastEditor}</span>
                    </span>
                  </label>
                  <div className="selected-tags">
                    {conflict.currentTagNames.length > 0 
                      ? conflict.currentTagNames.join(', ')
                      : 'No tags'
                    }
                  </div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="tags"
                      value="incoming"
                      checked={tagChoice === 'incoming'}
                      onChange={() => setTagChoice('incoming')}
                    />
                    <span>
                      Use Your Tags
                      <span className="option-meta">by {conflict.currentEditor}</span>
                    </span>
                  </label>
                  <div className="selected-tags">
                    {conflict.incomingTagNames.length > 0 
                      ? conflict.incomingTagNames.join(', ')
                      : 'No tags'
                    }
                  </div>
                </div>

                <div className="conflict-option">
                  <label>
                    <input
                      type="radio"
                      name="tags"
                      value="merge"
                      checked={tagChoice === 'merge'}
                      onChange={() => setTagChoice('merge')}
                    />
                    <span>Merge Tags (Recommended)</span>
                  </label>
                  <div className="selected-tags">
                    {mergeSuggestions.tags.length > 0 
                      ? mergeSuggestions.tags.join(', ')
                      : 'No tags'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No conflicts message */}
          {!conflictStatus.hasConflict && (
            <div className="conflict-section">
              <h3>Version Mismatch</h3>
              <p>The note has been updated by another user, but no content conflicts were detected.</p>
              <p>You can proceed with your changes or cancel to review the current version.</p>
            </div>
          )}
        </div>

        <div className="conflict-modal-actions">
          <button 
            className="btn btn-secondary" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleResolve}
          >
            Resolve Conflict
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
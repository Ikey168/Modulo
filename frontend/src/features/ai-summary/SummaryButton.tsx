import React, { useState } from 'react';
import { Note } from '../../types/Note';
import { SummaryPanel } from './SummaryPanel';
import './SummaryButton.css';

interface SummaryButtonProps {
  note: Note;
  className?: string;
  variant?: 'icon' | 'text' | 'full';
  size?: 'small' | 'medium' | 'large';
}

export const SummaryButton: React.FC<SummaryButtonProps> = ({
  note,
  className = '',
  variant = 'icon',
  size = 'medium'
}) => {
  const [showPanel, setShowPanel] = useState(false);

  const hasContent = note.content && note.content.trim().length > 0;
  const canSummarize = hasContent && note.content.trim().length > 100;

  const handleClick = () => {
    if (canSummarize) {
      setShowPanel(true);
    }
  };

  const getButtonContent = () => {
    switch (variant) {
      case 'text':
        return (
          <>
            <span className="button-text">Summarize</span>
          </>
        );
      case 'full':
        return (
          <>
            <span className="ai-icon">🤖</span>
            <span className="button-text">AI Summary</span>
          </>
        );
      case 'icon':
      default:
        return (
          <span className="ai-icon" title="Generate AI Summary">
            🤖
          </span>
        );
    }
  };

  const getTooltipText = () => {
    if (!hasContent) {
      return 'Add content to generate a summary';
    }
    if (!canSummarize) {
      return 'Note too short for summarization (minimum 100 characters)';
    }
    return 'Generate AI-powered summary';
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={!canSummarize}
        className={`
          summary-button 
          variant-${variant} 
          size-${size} 
          ${!canSummarize ? 'disabled' : ''}
          ${className}
        `}
        title={getTooltipText()}
        aria-label={getTooltipText()}
      >
        {getButtonContent()}
      </button>

      {showPanel && (
        <SummaryPanel
          note={note}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
};

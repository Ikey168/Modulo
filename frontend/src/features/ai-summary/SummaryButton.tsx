import React, { useState } from 'react';
import { Note } from '../../types/Note';
import { SummaryPanel } from './SummaryPanel';
import { cn } from '@/ui';

interface SummaryButtonProps {
  note: Note;
  className?: string;
  variant?: 'icon' | 'text' | 'full';
  size?: 'small' | 'medium' | 'large';
}

const VARIANT_CLASSES: Record<NonNullable<SummaryButtonProps['variant']>, string> = {
  icon: 'rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
  text: 'rounded-md border border-primary bg-transparent text-indigo-400 hover:bg-primary hover:text-primary-foreground',
  full: 'rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
};

const SIZE_CLASSES: Record<
  NonNullable<SummaryButtonProps['size']>,
  Record<NonNullable<SummaryButtonProps['variant']>, string>
> = {
  small: {
    icon: 'h-8 w-8 text-sm',
    text: 'px-3 py-1.5 text-xs',
    full: 'px-3 py-1.5 text-xs',
  },
  medium: {
    icon: 'h-9 w-9 text-base',
    text: 'px-4 py-2 text-[13px]',
    full: 'px-4 py-2 text-[13px]',
  },
  large: {
    icon: 'h-11 w-11 text-lg',
    text: 'px-6 py-2.5 text-sm',
    full: 'px-6 py-2.5 text-sm',
  },
};

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
            <span className="font-medium whitespace-nowrap">Summarize</span>
          </>
        );
      case 'full':
        return (
          <>
            <span className="leading-none" aria-hidden="true">🤖</span>
            <span className="font-medium whitespace-nowrap">AI Summary</span>
          </>
        );
      case 'icon':
      default:
        return (
          <span className="leading-none" title="Generate AI Summary" aria-hidden="true">
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
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-40',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size][variant],
          className,
        )}
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

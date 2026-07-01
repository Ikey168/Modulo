import React, { useState } from 'react';
import { Bot, Sparkles, Info, AlertTriangle, RotateCw, ChevronRight, ChevronDown } from 'lucide-react';
import { Note } from '../../types/Note';
import { Badge, Button, Spinner, cn } from '@/ui';

interface QuickSummaryProps {
  note: Note;
  className?: string;
}

interface SummaryResult {
  summary: string;
  wordCount: number;
  compressionRatio: number;
  isLoading: boolean;
  error: string | null;
  isMock: boolean;
}

export const QuickSummary: React.FC<QuickSummaryProps> = ({
  note,
  className = ''
}) => {
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const generateSummary = async () => {
    if (result?.isLoading) return;

    setResult(prev => ({
      ...prev,
      isLoading: true,
      error: null
    } as SummaryResult));

    try {
      const response = await fetch(`/api/ai-summarization/summary/${note.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          length: 'medium',
          style: 'bullet_points',
          focusAreas: ['main_topics']
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`);
      }

      const data = await response.json();
      setResult({
        summary: data.summary,
        wordCount: data.wordCount,
        compressionRatio: data.compressionRatio,
        isLoading: false,
        error: null,
        isMock: data.isMockResponse || false
      });
    } catch (error) {
      setResult(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate summary'
      } as SummaryResult));
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const hasContent = note.content && note.content.trim().length > 0;
  const canSummarize = hasContent && note.content.trim().length > 100; // Minimum content for summarization

  return (
    <div
      className={cn(
        'my-4 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Bot className="size-4 text-indigo-400" aria-hidden="true" />
          AI Summary
          {result?.isMock && (
            <Badge variant="warning" title="Mock response - OpenAI not configured">
              Demo
            </Badge>
          )}
        </div>

        {canSummarize && (
          <div className="flex items-center gap-2">
            {!result && (
              <Button
                onClick={generateSummary}
                variant="secondary"
                size="sm"
                title="Generate AI summary"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Summarize
              </Button>
            )}

            {result && (
              <Button
                onClick={toggleExpanded}
                variant="ghost"
                size="icon-sm"
                title={isExpanded ? 'Collapse summary' : 'Expand summary'}
              >
                {isExpanded
                  ? <ChevronDown className="size-4" aria-hidden="true" />
                  : <ChevronRight className="size-4" aria-hidden="true" />}
              </Button>
            )}
          </div>
        )}
      </div>

      {!canSummarize && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-4 text-[13px] text-muted-foreground">
          <Info className="size-4 shrink-0 text-info" aria-hidden="true" />
          {!hasContent
            ? 'Add content to generate a summary'
            : 'Note too short for summarization (minimum 100 characters)'
          }
        </div>
      )}

      {result?.isLoading && (
        <div className="flex items-center gap-3 border-t border-border px-4 py-4 text-[13px] text-subtle-foreground">
          <Spinner className="size-4 text-indigo-400" />
          <span>Generating summary...</span>
        </div>
      )}

      {result?.error && (
        <div className="flex items-center gap-3 border-t border-border bg-destructive/10 px-4 py-4 text-[13px] text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{result.error}</span>
          <Button
            onClick={generateSummary}
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-destructive hover:bg-destructive/15 hover:text-destructive"
            title="Retry"
          >
            <RotateCw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {result?.summary && !result.isLoading && (
        <div
          className={cn(
            'border-t border-border transition-all',
            isExpanded ? 'max-h-none' : 'max-h-[120px] overflow-hidden',
          )}
        >
          <div className="px-4 py-4 text-[13px] leading-relaxed text-subtle-foreground">
            {result.summary}
          </div>

          {isExpanded && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 text-xs">
              <div className="flex gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <strong className="text-foreground">{result.wordCount}</strong> words
                </span>
                <span className="flex items-center gap-1">
                  <strong className="text-foreground">{Math.round(result.compressionRatio * 100)}%</strong> compression
                </span>
              </div>

              <Button
                onClick={generateSummary}
                variant="outline"
                size="sm"
                disabled={result.isLoading}
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

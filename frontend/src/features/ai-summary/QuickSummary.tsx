import React, { useState } from 'react';
import { Note } from '../../types/Note';
import './QuickSummary.css';

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
    <div className={`quick-summary ${className}`}>
      <div className="quick-summary-header">
        <div className="summary-title">
          <span className="ai-icon">🤖</span>
          AI Summary
          {result?.isMock && (
            <span className="mock-indicator" title="Mock response - OpenAI not configured">
              Demo
            </span>
          )}
        </div>
        
        {canSummarize && (
          <div className="summary-actions">
            {!result && (
              <button
                onClick={generateSummary}
                className="generate-summary-btn"
                title="Generate AI summary"
              >
                ✨ Summarize
              </button>
            )}
            
            {result && (
              <button
                onClick={toggleExpanded}
                className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                title={isExpanded ? 'Collapse summary' : 'Expand summary'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
          </div>
        )}
      </div>

      {!canSummarize && (
        <div className="summary-unavailable">
          <span className="info-icon">ℹ️</span>
          {!hasContent 
            ? 'Add content to generate a summary'
            : 'Note too short for summarization (minimum 100 characters)'
          }
        </div>
      )}

      {result?.isLoading && (
        <div className="summary-loading">
          <div className="loading-spinner"></div>
          <span>Generating summary...</span>
        </div>
      )}

      {result?.error && (
        <div className="summary-error">
          <span className="error-icon">⚠️</span>
          <span>{result.error}</span>
          <button 
            onClick={generateSummary}
            className="retry-btn"
            title="Retry"
          >
            🔄
          </button>
        </div>
      )}

      {result?.summary && !result.isLoading && (
        <div className={`summary-result ${isExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="summary-content">
            {result.summary}
          </div>
          
          {isExpanded && (
            <div className="summary-meta">
              <div className="meta-stats">
                <span className="stat">
                  <strong>{result.wordCount}</strong> words
                </span>
                <span className="stat">
                  <strong>{Math.round(result.compressionRatio * 100)}%</strong> compression
                </span>
              </div>
              
              <button
                onClick={generateSummary}
                className="regenerate-btn"
                disabled={result.isLoading}
              >
                🔄 Regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Bot, Settings, X, AlertTriangle, FileText, KeyRound, Lightbulb, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from '@/ui';

interface SummaryResult {
  noteId: number;
  noteTitle: string;
  summary: string;
  error?: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  model: string;
  generatedAt: string;
  success: boolean;
  mock?: boolean;
}

interface KeyPointsResult {
  noteId: number;
  noteTitle: string;
  keyPoints: string[];
  error?: string;
  originalLength: number;
  model: string;
  generatedAt: string;
  success: boolean;
  mock?: boolean;
}

interface InsightsResult {
  noteId: number;
  noteTitle: string;
  insights: string;
  error?: string;
  originalLength: number;
  model: string;
  generatedAt: string;
  success: boolean;
  mock?: boolean;
}

interface SummaryOptions {
  length?: 'SHORT' | 'MEDIUM' | 'LONG';
  style?: 'FORMAL' | 'CASUAL' | 'TECHNICAL' | 'ACADEMIC';
  focusAreas?: string[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface SummaryPanelProps {
  noteId: number;
  noteTitle: string;
  noteContent?: string;
  isVisible: boolean;
  onClose: () => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  noteId,
  noteTitle,
  isVisible,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'keypoints' | 'insights' | 'analysis'>('summary');
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [keyPointsResult, setKeyPointsResult] = useState<KeyPointsResult | null>(null);
  const [insightsResult, setInsightsResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Summary options
  const [summaryOptions, setSummaryOptions] = useState<SummaryOptions>({
    length: 'MEDIUM',
    style: 'CASUAL'
  });

  const [maxKeyPoints, setMaxKeyPoints] = useState(5);
  const [showOptions, setShowOptions] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plugin/ai-notes-summarization/notes/${noteId}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(summaryOptions)
      });

      if (response.ok) {
        const result = await response.json();
        setSummaryResult(result);
      } else {
        const errorResult = await response.json();
        setError(errorResult.error || 'Failed to generate summary');
      }
    } catch (err) {
      setError('Network error occurred while generating summary');
      console.error('Summary generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const extractKeyPoints = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/plugin/ai-notes-summarization/notes/${noteId}/key-points?maxPoints=${maxKeyPoints}`,
        { method: 'POST' }
      );

      if (response.ok) {
        const result = await response.json();
        setKeyPointsResult(result);
      } else {
        const errorResult = await response.json();
        setError(errorResult.error || 'Failed to extract key points');
      }
    } catch (err) {
      setError('Network error occurred while extracting key points');
      console.error('Key points extraction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plugin/ai-notes-summarization/notes/${noteId}/insights`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setInsightsResult(result);
      } else {
        const errorResult = await response.json();
        setError(errorResult.error || 'Failed to generate insights');
      }
    } catch (err) {
      setError('Network error occurred while generating insights');
      console.error('Insights generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateComprehensiveAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plugin/ai-notes-summarization/notes/${noteId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summaryRequest: summaryOptions,
          maxKeyPoints: maxKeyPoints
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSummaryResult(result.summary);
        setKeyPointsResult(result.keyPoints);
        setInsightsResult(result.insights);
      } else {
        const errorResult = await response.json();
        setError(errorResult.error || 'Failed to generate comprehensive analysis');
      }
    } catch (err) {
      setError('Network error occurred while generating analysis');
      console.error('Comprehensive analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCompressionPercentage = (ratio: number) => {
    return Math.round((1 - ratio) * 100);
  };

  if (!isVisible) return null;

  const resultContentClass = 'text-[13px] leading-relaxed text-subtle-foreground [&_p]:m-0';

  const keyPointsList = (points: string[]) => (
    <ul className="m-0 list-none p-0">
      {points.map((point, index) => (
        <li
          key={index}
          className="flex items-start gap-3 border-b border-border py-3 last:border-b-0"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {index + 1}
          </span>
          <span className="flex-1 leading-relaxed text-subtle-foreground">{point}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl border border-border-strong bg-popover text-popover-foreground shadow-lg animate-scale-in">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="m-0 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
              <Bot className="size-5 text-indigo-400" aria-hidden="true" />
              AI Analysis
            </h3>
            <span className="text-[13px] text-muted-foreground">{noteTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowOptions(!showOptions)}
              variant="ghost"
              size="icon-sm"
              title="Customize options"
              aria-label="Customize options"
            >
              <Settings className="size-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {showOptions && (
          <div className="border-b border-border bg-surface px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Summary Length:</Label>
                <Select
                  value={summaryOptions.length}
                  onValueChange={(value) => setSummaryOptions({
                    ...summaryOptions,
                    length: value as any
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT">Short</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LONG">Long</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Writing Style:</Label>
                <Select
                  value={summaryOptions.style}
                  onValueChange={(value) => setSummaryOptions({
                    ...summaryOptions,
                    style: value as any
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASUAL">Casual</SelectItem>
                    <SelectItem value="FORMAL">Formal</SelectItem>
                    <SelectItem value="TECHNICAL">Technical</SelectItem>
                    <SelectItem value="ACADEMIC">Academic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Key Points Count:</Label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={maxKeyPoints}
                  onChange={(e) => setMaxKeyPoints(parseInt(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-[13px] text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
            </div>
          </div>
        )}

        <div className="border-b border-border bg-surface px-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'summary' | 'keypoints' | 'insights' | 'analysis')}
          >
            <TabsList variant="underline" className="border-b-0">
              <TabsTrigger value="summary"><FileText aria-hidden="true" />Summary</TabsTrigger>
              <TabsTrigger value="keypoints"><KeyRound aria-hidden="true" />Key Points</TabsTrigger>
              <TabsTrigger value="insights"><Lightbulb aria-hidden="true" />Insights</TabsTrigger>
              <TabsTrigger value="analysis"><Search aria-hidden="true" />Full Analysis</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-[400px] flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <Spinner className="size-12 text-indigo-400" />
              <p className="m-0 text-[13px] text-muted-foreground">Generating AI analysis...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <AlertTriangle className="size-12 text-destructive" aria-hidden="true" />
              <p className="m-0 text-[13px] text-destructive">{error}</p>
              <Button
                onClick={() => setError(null)}
                variant="destructive"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center gap-3">
                <Button
                  onClick={generateSummary}
                  disabled={loading}
                  variant="primary"
                >
                  Generate Summary
                </Button>
              </div>

              {summaryResult && (
                <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                  <div className="border-b border-border bg-surface-2 p-4">
                    <div className="flex flex-col flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex items-center gap-2 font-medium">
                        Model: {summaryResult.model}
                        {summaryResult.mock && <Badge variant="warning">DEMO</Badge>}
                      </span>
                      <span className="font-medium text-success">
                        {getCompressionPercentage(summaryResult.compressionRatio)}% shorter
                      </span>
                      <span>{formatDate(summaryResult.generatedAt)}</span>
                    </div>
                  </div>

                  <div className={cn('p-6', resultContentClass)}>
                    <p>{summaryResult.summary}</p>
                  </div>

                  <div className="flex flex-col justify-around gap-4 border-t border-border bg-surface-2 p-4 sm:flex-row sm:gap-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium uppercase text-muted-foreground">Original:</span>
                      <span className="text-base font-semibold text-foreground">{summaryResult.originalLength} chars</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium uppercase text-muted-foreground">Summary:</span>
                      <span className="text-base font-semibold text-foreground">{summaryResult.summaryLength} chars</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'keypoints' && (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center gap-3">
                <Button
                  onClick={extractKeyPoints}
                  disabled={loading}
                  variant="primary"
                >
                  Extract Key Points
                </Button>
              </div>

              {keyPointsResult && (
                <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                  <div className="border-b border-border bg-surface-2 p-4">
                    <div className="flex flex-col flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex items-center gap-2 font-medium">
                        Model: {keyPointsResult.model}
                        {keyPointsResult.mock && <Badge variant="warning">DEMO</Badge>}
                      </span>
                      <span>{formatDate(keyPointsResult.generatedAt)}</span>
                    </div>
                  </div>

                  <div className="p-6">
                    {keyPointsList(keyPointsResult.keyPoints)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center gap-3">
                <Button
                  onClick={generateInsights}
                  disabled={loading}
                  variant="primary"
                >
                  Generate Insights
                </Button>
              </div>

              {insightsResult && (
                <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                  <div className="border-b border-border bg-surface-2 p-4">
                    <div className="flex flex-col flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex items-center gap-2 font-medium">
                        Model: {insightsResult.model}
                        {insightsResult.mock && <Badge variant="warning">DEMO</Badge>}
                      </span>
                      <span>{formatDate(insightsResult.generatedAt)}</span>
                    </div>
                  </div>

                  <div className={cn('p-6', resultContentClass)}>
                    <p>{insightsResult.insights}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center gap-3">
                <Button
                  onClick={generateComprehensiveAnalysis}
                  disabled={loading}
                  variant="primary"
                >
                  Generate Full Analysis
                </Button>
              </div>

              {(summaryResult || keyPointsResult || insightsResult) && (
                <div className="flex flex-col gap-8">
                  {summaryResult && (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <h4 className="m-0 flex items-center gap-2 border-b border-border bg-surface-2 p-4 text-[15px] font-semibold text-foreground">
                        <FileText className="size-4 text-indigo-400" aria-hidden="true" />
                        Summary
                      </h4>
                      <div className={cn('p-6', resultContentClass)}>
                        <p>{summaryResult.summary}</p>
                      </div>
                    </div>
                  )}

                  {keyPointsResult && (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <h4 className="m-0 flex items-center gap-2 border-b border-border bg-surface-2 p-4 text-[15px] font-semibold text-foreground">
                        <KeyRound className="size-4 text-indigo-400" aria-hidden="true" />
                        Key Points
                      </h4>
                      <div className="p-6">
                        {keyPointsList(keyPointsResult.keyPoints)}
                      </div>
                    </div>
                  )}

                  {insightsResult && (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <h4 className="m-0 flex items-center gap-2 border-b border-border bg-surface-2 p-4 text-[15px] font-semibold text-foreground">
                        <Lightbulb className="size-4 text-indigo-400" aria-hidden="true" />
                        Insights
                      </h4>
                      <div className={cn('p-6', resultContentClass)}>
                        <p>{insightsResult.insights}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryPanel;

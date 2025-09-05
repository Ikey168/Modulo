import React, { useState } from 'react';
import './SummaryPanel.css';

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
  noteContent,
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

  return (
    <div className="summary-panel-overlay">
      <div className="summary-panel">
        <div className="summary-panel-header">
          <div className="panel-title">
            <h3>🤖 AI Analysis</h3>
            <span className="note-title">{noteTitle}</span>
          </div>
          
          <div className="header-actions">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="options-toggle"
              title="Customize options"
            >
              ⚙️
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        {showOptions && (
          <div className="options-panel">
            <div className="options-grid">
              <div className="option-group">
                <label>Summary Length:</label>
                <select
                  value={summaryOptions.length}
                  onChange={(e) => setSummaryOptions({
                    ...summaryOptions,
                    length: e.target.value as any
                  })}
                >
                  <option value="SHORT">Short</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LONG">Long</option>
                </select>
              </div>
              
              <div className="option-group">
                <label>Writing Style:</label>
                <select
                  value={summaryOptions.style}
                  onChange={(e) => setSummaryOptions({
                    ...summaryOptions,
                    style: e.target.value as any
                  })}
                >
                  <option value="CASUAL">Casual</option>
                  <option value="FORMAL">Formal</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="ACADEMIC">Academic</option>
                </select>
              </div>
              
              <div className="option-group">
                <label>Key Points Count:</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={maxKeyPoints}
                  onChange={(e) => setMaxKeyPoints(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="summary-panel-nav">
          <button
            onClick={() => setActiveTab('summary')}
            className={`nav-tab ${activeTab === 'summary' ? 'active' : ''}`}
          >
            📄 Summary
          </button>
          <button
            onClick={() => setActiveTab('keypoints')}
            className={`nav-tab ${activeTab === 'keypoints' ? 'active' : ''}`}
          >
            🔑 Key Points
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`nav-tab ${activeTab === 'insights' ? 'active' : ''}`}
          >
            💡 Insights
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`nav-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          >
            🔍 Full Analysis
          </button>
        </div>

        <div className="summary-panel-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Generating AI analysis...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button
                onClick={() => setError(null)}
                className="retry-button"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="tab-content">
              <div className="tab-actions">
                <button
                  onClick={generateSummary}
                  disabled={loading}
                  className="generate-button primary"
                >
                  Generate Summary
                </button>
              </div>
              
              {summaryResult && (
                <div className="result-container">
                  <div className="result-header">
                    <div className="result-meta">
                      <span className="model-info">
                        Model: {summaryResult.model}
                        {summaryResult.mock && <span className="mock-badge">DEMO</span>}
                      </span>
                      <span className="compression-info">
                        {getCompressionPercentage(summaryResult.compressionRatio)}% shorter
                      </span>
                      <span className="timestamp">{formatDate(summaryResult.generatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="result-content">
                    <p>{summaryResult.summary}</p>
                  </div>
                  
                  <div className="result-stats">
                    <div className="stat">
                      <span className="stat-label">Original:</span>
                      <span className="stat-value">{summaryResult.originalLength} chars</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Summary:</span>
                      <span className="stat-value">{summaryResult.summaryLength} chars</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'keypoints' && (
            <div className="tab-content">
              <div className="tab-actions">
                <button
                  onClick={extractKeyPoints}
                  disabled={loading}
                  className="generate-button primary"
                >
                  Extract Key Points
                </button>
              </div>
              
              {keyPointsResult && (
                <div className="result-container">
                  <div className="result-header">
                    <div className="result-meta">
                      <span className="model-info">
                        Model: {keyPointsResult.model}
                        {keyPointsResult.mock && <span className="mock-badge">DEMO</span>}
                      </span>
                      <span className="timestamp">{formatDate(keyPointsResult.generatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="result-content">
                    <ul className="key-points-list">
                      {keyPointsResult.keyPoints.map((point, index) => (
                        <li key={index} className="key-point">
                          <span className="point-number">{index + 1}</span>
                          <span className="point-text">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="tab-content">
              <div className="tab-actions">
                <button
                  onClick={generateInsights}
                  disabled={loading}
                  className="generate-button primary"
                >
                  Generate Insights
                </button>
              </div>
              
              {insightsResult && (
                <div className="result-container">
                  <div className="result-header">
                    <div className="result-meta">
                      <span className="model-info">
                        Model: {insightsResult.model}
                        {insightsResult.mock && <span className="mock-badge">DEMO</span>}
                      </span>
                      <span className="timestamp">{formatDate(insightsResult.generatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="result-content">
                    <p>{insightsResult.insights}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="tab-content">
              <div className="tab-actions">
                <button
                  onClick={generateComprehensiveAnalysis}
                  disabled={loading}
                  className="generate-button primary"
                >
                  Generate Full Analysis
                </button>
              </div>
              
              {(summaryResult || keyPointsResult || insightsResult) && (
                <div className="comprehensive-results">
                  {summaryResult && (
                    <div className="analysis-section">
                      <h4>📄 Summary</h4>
                      <div className="result-content">
                        <p>{summaryResult.summary}</p>
                      </div>
                    </div>
                  )}
                  
                  {keyPointsResult && (
                    <div className="analysis-section">
                      <h4>🔑 Key Points</h4>
                      <div className="result-content">
                        <ul className="key-points-list">
                          {keyPointsResult.keyPoints.map((point, index) => (
                            <li key={index} className="key-point">
                              <span className="point-number">{index + 1}</span>
                              <span className="point-text">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {insightsResult && (
                    <div className="analysis-section">
                      <h4>💡 Insights</h4>
                      <div className="result-content">
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

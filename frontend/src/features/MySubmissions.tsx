import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  clockIcon, 
  checkIcon, 
  xIcon, 
  eyeIcon, 
  uploadIcon,
  refreshIcon
} from '../components/Icons';
import { submissionService, PluginSubmission as ImportedPluginSubmission } from '../services/SubmissionService';
import '../styles/MySubmissions.css';

type PluginSubmission = ImportedPluginSubmission;

const STATUS_CONFIG = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: clockIcon
  },
  IN_REVIEW: {
    label: 'In Review',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    icon: eyeIcon
  },
  APPROVED: {
    label: 'Approved',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: checkIcon
  },
  REJECTED: {
    label: 'Rejected',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: xIcon
  },
  PUBLISHED: {
    label: 'Published',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: checkIcon
  }
};

export default function MySubmissions() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<PluginSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<PluginSubmission | null>(null);

  // Mock user email - in real app, get from auth context
  const userEmail = 'developer@example.com';

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await submissionService.getSubmissionsByDeveloper(userEmail);
      
      if (result.data) {
        setSubmissions(result.data);
      } else {
        setError(result.error || 'Failed to load submissions');
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = (submission: PluginSubmission) => {
    // Navigate to submission form with pre-filled data for resubmission
    navigate('/plugins/submit', { 
      state: { 
        resubmit: true, 
        submissionId: submission.submissionId,
        formData: {
          pluginName: submission.pluginName,
          version: submission.version,
          description: submission.description,
          category: submission.category,
          developerName: submission.developerName,
          developerEmail: submission.developerEmail
        }
      } 
    });
  };

  const handleDelete = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await submissionService.deleteSubmission(submissionId);

      if (!result.error) {
        setSubmissions(submissions.filter(s => s.submissionId !== submissionId));
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error('Error deleting submission:', err);
      alert('Failed to delete submission. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="my-submissions">
        <div className="submissions-container">
          <div className="loading-state">
            <div className="loading-spinner large"></div>
            <p>Loading your submissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-submissions">
        <div className="submissions-container">
          <div className="error-state">
            <div className="error-icon">{xIcon}</div>
            <h3>Failed to Load Submissions</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchSubmissions}>
              {refreshIcon}
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-submissions">
      <div className="submissions-container">
        <div className="submissions-header">
          <div className="header-content">
            <h1>My Plugin Submissions</h1>
            <p>Track the status of your submitted plugins and manage resubmissions.</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={fetchSubmissions}>
              {refreshIcon}
              Refresh
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/plugins/submit')}>
              {uploadIcon}
              Submit New Plugin
            </button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{uploadIcon}</div>
            <h3>No Submissions Yet</h3>
            <p>You haven't submitted any plugins yet. Share your work with the Modulo community!</p>
            <button className="btn btn-primary" onClick={() => navigate('/plugins/submit')}>
              Submit Your First Plugin
            </button>
          </div>
        ) : (
          <div className="submissions-list">
            {submissions.map((submission) => {
              const statusConfig = STATUS_CONFIG[submission.status as keyof typeof STATUS_CONFIG];
              
              return (
                <div key={submission.submissionId} className="submission-card">
                  <div className="submission-header">
                    <div className="submission-info">
                      <h3>{submission.pluginName}</h3>
                      <p className="version">v{submission.version}</p>
                      <div className="submission-meta">
                        <span className="category">{submission.category || 'Uncategorized'}</span>
                        <span className="file-size">{formatFileSize(submission.fileSize)}</span>
                      </div>
                    </div>
                    
                    <div className="submission-status">
                      <div 
                        className="status-badge"
                        style={{ 
                          color: statusConfig?.color || '#6b7280',
                          backgroundColor: statusConfig?.bgColor || '#f3f4f6'
                        }}
                      >
                        {statusConfig?.icon}
                        {statusConfig?.label || submission.status}
                      </div>
                    </div>
                  </div>

                  <div className="submission-description">
                    <p>{submission.description}</p>
                  </div>

                  <div className="submission-timeline">
                    <div className="timeline-item">
                      <strong>Submitted:</strong> {formatDate(submission.submittedAt)}
                    </div>
                    {submission.reviewStartedAt && (
                      <div className="timeline-item">
                        <strong>Review Started:</strong> {formatDate(submission.reviewStartedAt)}
                      </div>
                    )}
                    {submission.approvedAt && (
                      <div className="timeline-item">
                        <strong>Approved:</strong> {formatDate(submission.approvedAt)}
                      </div>
                    )}
                    {submission.rejectedAt && (
                      <div className="timeline-item">
                        <strong>Rejected:</strong> {formatDate(submission.rejectedAt)}
                      </div>
                    )}
                    {submission.publishedAt && (
                      <div className="timeline-item">
                        <strong>Published:</strong> {formatDate(submission.publishedAt)}
                      </div>
                    )}
                  </div>

                  {/* Validation Status */}
                  <div className="validation-status">
                    <div className="validation-checks">
                      <div className={`check-item ${submission.securityCheckPassed ? 'passed' : 'failed'}`}>
                        {submission.securityCheckPassed ? checkIcon : xIcon}
                        <span>Security Check</span>
                      </div>
                      <div className={`check-item ${submission.compatibilityCheckPassed ? 'passed' : 'failed'}`}>
                        {submission.compatibilityCheckPassed ? checkIcon : xIcon}
                        <span>Compatibility Check</span>
                      </div>
                    </div>
                  </div>

                  {/* Review Notes */}
                  {submission.reviewNotes && (
                    <div className="review-notes">
                      <h4>Review Notes:</h4>
                      <p>{submission.reviewNotes}</p>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {submission.validationErrors && (
                    <div className="validation-errors">
                      <h4>Validation Errors:</h4>
                      <p>{submission.validationErrors}</p>
                    </div>
                  )}

                  {/* Validation Warnings */}
                  {submission.validationWarnings && (
                    <div className="validation-warnings">
                      <h4>Validation Warnings:</h4>
                      <p>{submission.validationWarnings}</p>
                    </div>
                  )}

                  <div className="submission-actions">
                    <button 
                      className="btn btn-outline"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      {eyeIcon}
                      View Details
                    </button>
                    
                    {submission.status === 'REJECTED' && (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleResubmit(submission)}
                      >
                        {uploadIcon}
                        Resubmit
                      </button>
                    )}
                    
                    {submission.status === 'PUBLISHED' && (
                      <button 
                        className="btn btn-primary"
                        onClick={() => navigate(`/plugins/marketplace?plugin=${submission.submissionId}`)}
                      >
                        View in Marketplace
                      </button>
                    )}
                    
                    {(submission.status === 'PENDING_REVIEW' || submission.status === 'REJECTED') && (
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleDelete(submission.submissionId)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submission Details Modal */}
        {selectedSubmission && (
          <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedSubmission.pluginName} v{selectedSubmission.version}</h2>
                <button 
                  className="modal-close"
                  onClick={() => setSelectedSubmission(null)}
                >
                  {xIcon}
                </button>
              </div>
              
              <div className="modal-body">
                <div className="detail-section">
                  <h3>Submission Details</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Submission ID:</strong>
                      <span className="monospace">{selectedSubmission.submissionId}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Category:</strong>
                      <span>{selectedSubmission.category || 'Uncategorized'}</span>
                    </div>
                    <div className="detail-item">
                      <strong>File Size:</strong>
                      <span>{formatFileSize(selectedSubmission.fileSize)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Checksum:</strong>
                      <span className="monospace">{selectedSubmission.checksum}</span>
                    </div>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h3>Description</h3>
                  <p>{selectedSubmission.description}</p>
                </div>
                
                <div className="detail-section">
                  <h3>Timeline</h3>
                  <div className="timeline-details">
                    <div className="timeline-item">
                      <strong>Submitted:</strong> {formatDate(selectedSubmission.submittedAt)}
                    </div>
                    {selectedSubmission.reviewStartedAt && (
                      <div className="timeline-item">
                        <strong>Review Started:</strong> {formatDate(selectedSubmission.reviewStartedAt)}
                      </div>
                    )}
                    {selectedSubmission.approvedAt && (
                      <div className="timeline-item">
                        <strong>Approved:</strong> {formatDate(selectedSubmission.approvedAt)}
                      </div>
                    )}
                    {selectedSubmission.rejectedAt && (
                      <div className="timeline-item">
                        <strong>Rejected:</strong> {formatDate(selectedSubmission.rejectedAt)}
                      </div>
                    )}
                    {selectedSubmission.publishedAt && (
                      <div className="timeline-item">
                        <strong>Published:</strong> {formatDate(selectedSubmission.publishedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

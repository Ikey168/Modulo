import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadIcon, checkIcon, alertIcon, infoIcon } from '../components/Icons';
import { submissionService, SubmissionFormData as ImportedSubmissionFormData } from '../services/SubmissionService';
import '../styles/PluginSubmission.css';

type SubmissionFormData = ImportedSubmissionFormData;

interface SubmissionResponse {
  submissionId: string;
  status: string;
  pluginName: string;
  version: string;
  submittedAt: string;
}

const CATEGORIES = [
  'Development Tools',
  'Code Quality',
  'Testing',
  'Documentation',
  'UI/UX',
  'Data Analysis',
  'Security',
  'Integration',
  'Productivity',
  'Other'
];

const LICENSE_TYPES = [
  'MIT',
  'Apache 2.0',
  'GPL v3',
  'BSD 3-Clause',
  'ISC',
  'Mozilla Public License 2.0',
  'Creative Commons',
  'Proprietary',
  'Other'
];

export default function PluginSubmission() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if this is a resubmission
  const resubmitData = location.state as { 
    resubmit?: boolean; 
    submissionId?: string; 
    formData?: Partial<SubmissionFormData> 
  } | null;
  
  const [formData, setFormData] = useState<SubmissionFormData>({
    pluginName: resubmitData?.formData?.pluginName || '',
    version: resubmitData?.formData?.version || '',
    description: resubmitData?.formData?.description || '',
    category: resubmitData?.formData?.category || '',
    developerName: resubmitData?.formData?.developerName || '',
    developerEmail: resubmitData?.formData?.developerEmail || '',
    homepageUrl: resubmitData?.formData?.homepageUrl || '',
    documentationUrl: resubmitData?.formData?.documentationUrl || '',
    licenseType: resubmitData?.formData?.licenseType || '',
    tags: resubmitData?.formData?.tags || '',
    minPlatformVersion: resubmitData?.formData?.minPlatformVersion || '',
    maxPlatformVersion: resubmitData?.formData?.maxPlatformVersion || ''
  });
  
  const [jarFile, setJarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/java-archive' && !file.name.endsWith('.jar')) {
      setErrors(prev => ({ ...prev, jarFile: 'Please select a valid JAR file' }));
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setErrors(prev => ({ ...prev, jarFile: 'File size must be less than 50MB' }));
      return;
    }
    
    setJarFile(file);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.jarFile;
      return newErrors;
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.pluginName.trim()) {
      newErrors.pluginName = 'Plugin name is required';
    }
    
    if (!formData.version.trim()) {
      newErrors.version = 'Version is required';
    } else if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/.test(formData.version)) {
      newErrors.version = 'Version must follow semantic versioning (e.g., 1.0.0)';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.developerName.trim()) {
      newErrors.developerName = 'Developer name is required';
    }
    
    if (!formData.developerEmail.trim()) {
      newErrors.developerEmail = 'Developer email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.developerEmail)) {
      newErrors.developerEmail = 'Please enter a valid email address';
    }
    
    if (!jarFile) {
      newErrors.jarFile = 'JAR file is required';
    }
    
    if (formData.homepageUrl && !formData.homepageUrl.match(/^https?:\/\/.+/)) {
      newErrors.homepageUrl = 'Homepage URL must start with http:// or https://';
    }
    
    if (formData.documentationUrl && !formData.documentationUrl.match(/^https?:\/\/.+/)) {
      newErrors.documentationUrl = 'Documentation URL must start with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      let result;
      
      if (resubmitData?.resubmit && resubmitData.submissionId) {
        // This is a resubmission
        result = await submissionService.resubmitPlugin(
          resubmitData.submissionId,
          formData,
          jarFile || undefined
        );
      } else {
        // This is a new submission
        if (!jarFile) {
          setErrors({ jarFile: 'JAR file is required for new submissions' });
          return;
        }
        result = await submissionService.submitPlugin(formData, jarFile);
      }
      
      if (result.data) {
        setSubmissionResult(result.data);
      } else {
        if (result.errors) {
          setErrors(result.errors);
        } else {
          setErrors({ general: result.error || 'Submission failed' });
        }
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ general: 'Network error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSubmission = () => {
    setSubmissionResult(null);
    setFormData({
      pluginName: '',
      version: '',
      description: '',
      category: '',
      developerName: '',
      developerEmail: '',
      homepageUrl: '',
      documentationUrl: '',
      licenseType: '',
      tags: '',
      minPlatformVersion: '',
      maxPlatformVersion: ''
    });
    setJarFile(null);
    setErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (submissionResult) {
    return (
      <div className="plugin-submission">
        <div className="submission-container">
          <div className="submission-success">
            <div className="success-icon">
              {checkIcon}
            </div>
            <h2>Plugin Submitted Successfully!</h2>
            <div className="submission-details">
              <p><strong>Submission ID:</strong> {submissionResult.submissionId}</p>
              <p><strong>Plugin:</strong> {submissionResult.pluginName} v{submissionResult.version}</p>
              <p><strong>Status:</strong> <span className="status-badge">{submissionResult.status}</span></p>
              <p><strong>Submitted:</strong> {new Date(submissionResult.submittedAt).toLocaleString()}</p>
            </div>
            
            <div className="next-steps">
              <h3>What happens next?</h3>
              <ol>
                <li>Your plugin will undergo automated security and compatibility validation</li>
                <li>If validation passes, it will be queued for manual review</li>
                <li>A reviewer will examine your plugin's functionality and code quality</li>
                <li>You'll receive an email notification about the review outcome</li>
                <li>Once approved, your plugin will be published to the marketplace</li>
              </ol>
            </div>
            
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={() => navigate('/plugins/my-submissions')}>
                View My Submissions
              </button>
              <button className="btn btn-secondary" onClick={handleNewSubmission}>
                Submit Another Plugin
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/plugins/marketplace')}>
                Browse Marketplace
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-submission">
      <div className="submission-container">
        <div className="submission-header">
          <h1>Submit Your Plugin</h1>
          <p>Share your plugin with the Modulo community. All submissions undergo security validation and manual review.</p>
        </div>

        {errors.general && (
          <div className="error-banner">
            <div className="error-icon">{alertIcon}</div>
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="submission-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pluginName">Plugin Name *</label>
                <input
                  type="text"
                  id="pluginName"
                  name="pluginName"
                  value={formData.pluginName}
                  onChange={handleInputChange}
                  className={errors.pluginName ? 'error' : ''}
                  placeholder="Enter plugin name"
                />
                {errors.pluginName && <span className="error-text">{errors.pluginName}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="version">Version *</label>
                <input
                  type="text"
                  id="version"
                  name="version"
                  value={formData.version}
                  onChange={handleInputChange}
                  className={errors.version ? 'error' : ''}
                  placeholder="1.0.0"
                />
                {errors.version && <span className="error-text">{errors.version}</span>}
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={errors.description ? 'error' : ''}
                placeholder="Describe what your plugin does and its key features"
                rows={4}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="licenseType">License</label>
                <select
                  id="licenseType"
                  name="licenseType"
                  value={formData.licenseType}
                  onChange={handleInputChange}
                >
                  <option value="">Select a license</option>
                  {LICENSE_TYPES.map(license => (
                    <option key={license} value={license}>{license}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="tags">Tags</label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="tag1, tag2, tag3"
              />
              <small>Separate tags with commas to help users discover your plugin</small>
            </div>
          </div>

          {/* Developer Information */}
          <div className="form-section">
            <h3>Developer Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="developerName">Name *</label>
                <input
                  type="text"
                  id="developerName"
                  name="developerName"
                  value={formData.developerName}
                  onChange={handleInputChange}
                  className={errors.developerName ? 'error' : ''}
                  placeholder="Your name or organization"
                />
                {errors.developerName && <span className="error-text">{errors.developerName}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="developerEmail">Email *</label>
                <input
                  type="email"
                  id="developerEmail"
                  name="developerEmail"
                  value={formData.developerEmail}
                  onChange={handleInputChange}
                  className={errors.developerEmail ? 'error' : ''}
                  placeholder="your.email@example.com"
                />
                {errors.developerEmail && <span className="error-text">{errors.developerEmail}</span>}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="homepageUrl">Homepage URL</label>
                <input
                  type="url"
                  id="homepageUrl"
                  name="homepageUrl"
                  value={formData.homepageUrl}
                  onChange={handleInputChange}
                  className={errors.homepageUrl ? 'error' : ''}
                  placeholder="https://your-plugin-website.com"
                />
                {errors.homepageUrl && <span className="error-text">{errors.homepageUrl}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="documentationUrl">Documentation URL</label>
                <input
                  type="url"
                  id="documentationUrl"
                  name="documentationUrl"
                  value={formData.documentationUrl}
                  onChange={handleInputChange}
                  className={errors.documentationUrl ? 'error' : ''}
                  placeholder="https://docs.your-plugin.com"
                />
                {errors.documentationUrl && <span className="error-text">{errors.documentationUrl}</span>}
              </div>
            </div>
          </div>

          {/* Compatibility Information */}
          <div className="form-section">
            <h3>Compatibility</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="minPlatformVersion">Minimum Platform Version</label>
                <input
                  type="text"
                  id="minPlatformVersion"
                  name="minPlatformVersion"
                  value={formData.minPlatformVersion}
                  onChange={handleInputChange}
                  placeholder="1.0.0"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="maxPlatformVersion">Maximum Platform Version</label>
                <input
                  type="text"
                  id="maxPlatformVersion"
                  name="maxPlatformVersion"
                  value={formData.maxPlatformVersion}
                  onChange={handleInputChange}
                  placeholder="2.0.0"
                />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="form-section">
            <h3>Plugin File</h3>
            
            <div className="file-upload-section">
              <div
                className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${errors.jarFile ? 'error' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jar"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                
                <div className="upload-icon">
                  {uploadIcon}
                </div>
                
                {jarFile ? (
                  <div className="file-info">
                    <p className="file-name">{jarFile.name}</p>
                    <p className="file-size">{(jarFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="upload-text">
                    <p><strong>Drop your JAR file here or click to browse</strong></p>
                    <p>Maximum file size: 50MB</p>
                  </div>
                )}
              </div>
              
              {errors.jarFile && <span className="error-text">{errors.jarFile}</span>}
            </div>
            
            <div className="file-requirements">
              <div className="requirements-icon">{infoIcon}</div>
              <div>
                <h4>File Requirements:</h4>
                <ul>
                  <li>Must be a valid JAR file with .jar extension</li>
                  <li>Maximum file size: 50MB</li>
                  <li>Must contain a valid MANIFEST.MF with required attributes</li>
                  <li>Must include Plugin-Name, Plugin-Version, Plugin-Main-Class, and Plugin-API-Version</li>
                  <li>Will undergo automated security and compatibility validation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="loading-spinner"></div>
                  Submitting Plugin...
                </>
              ) : (
                'Submit Plugin'
              )}
            </button>
            
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/plugins/marketplace')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

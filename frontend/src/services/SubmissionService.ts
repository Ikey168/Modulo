/**
 * Service for handling plugin submission API calls
 */

export interface SubmissionFormData {
  pluginName: string;
  version: string;
  description: string;
  category: string;
  developerName: string;
  developerEmail: string;
  homepageUrl?: string;
  documentationUrl?: string;
  licenseType?: string;
  tags?: string;
  minPlatformVersion?: string;
  maxPlatformVersion?: string;
}

export interface PluginSubmission {
  submissionId: string;
  pluginName: string;
  version: string;
  description: string;
  category?: string;
  developerName: string;
  developerEmail: string;
  homepageUrl?: string;
  documentationUrl?: string;
  licenseType?: string;
  tags?: string;
  minPlatformVersion?: string;
  maxPlatformVersion?: string;
  status: string;
  submittedAt: string;
  reviewStartedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  publishedAt?: string;
  reviewNotes?: string;
  validationErrors?: string;
  validationWarnings?: string;
  securityCheckPassed: boolean;
  compatibilityCheckPassed: boolean;
  fileSize: number;
  checksum: string;
  jarFilePath?: string;
}

export interface SubmissionStatistics {
  totalSubmissions: number;
  pendingSubmissions: number;
  inReviewSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  publishedSubmissions: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

const API_BASE = '/api/plugins/submissions';

class SubmissionService {
  /**
   * Submit a new plugin
   */
  async submitPlugin(formData: SubmissionFormData, jarFile: File): Promise<ApiResponse<PluginSubmission>> {
    try {
      const submitFormData = new FormData();
      
      // Add JSON data as blob
      submitFormData.append('submission', new Blob([JSON.stringify(formData)], {
        type: 'application/json'
      }));
      
      // Add file
      submitFormData.append('jarFile', jarFile);
      
      const response = await fetch(API_BASE, {
        method: 'POST',
        body: submitFormData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        return { data: result };
      } else {
        return { error: result.error, errors: result.errors };
      }
    } catch (error) {
      console.error('Submit plugin error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmission(submissionId: string): Promise<ApiResponse<PluginSubmission>> {
    try {
      const response = await fetch(`${API_BASE}/${submissionId}`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else if (response.status === 404) {
        return { error: 'Submission not found' };
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to fetch submission' };
      }
    } catch (error) {
      console.error('Get submission error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Get submissions by developer email
   */
  async getSubmissionsByDeveloper(email: string): Promise<ApiResponse<PluginSubmission[]>> {
    try {
      const response = await fetch(`${API_BASE}/developer/${encodeURIComponent(email)}`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to fetch submissions' };
      }
    } catch (error) {
      console.error('Get submissions by developer error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Get all submissions with pagination
   */
  async getAllSubmissions(page: number = 0, size: number = 20, status?: string): Promise<ApiResponse<{
    content: PluginSubmission[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  }>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await fetch(`${API_BASE}?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to fetch submissions' };
      }
    } catch (error) {
      console.error('Get all submissions error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Update submission status (admin only)
   */
  async updateSubmissionStatus(
    submissionId: string, 
    status: string, 
    reviewNotes?: string
  ): Promise<ApiResponse<PluginSubmission>> {
    try {
      const response = await fetch(`${API_BASE}/${submissionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reviewNotes })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        return { data: result };
      } else {
        return { error: result.error };
      }
    } catch (error) {
      console.error('Update submission status error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Resubmit a plugin
   */
  async resubmitPlugin(
    submissionId: string, 
    formData: SubmissionFormData, 
    jarFile?: File
  ): Promise<ApiResponse<PluginSubmission>> {
    try {
      const submitFormData = new FormData();
      
      // Add JSON data
      submitFormData.append('submission', new Blob([JSON.stringify(formData)], {
        type: 'application/json'
      }));
      
      // Add file if provided
      if (jarFile) {
        submitFormData.append('jarFile', jarFile);
      }
      
      const response = await fetch(`${API_BASE}/${submissionId}/resubmit`, {
        method: 'PUT',
        body: submitFormData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        return { data: result };
      } else {
        return { error: result.error, errors: result.errors };
      }
    } catch (error) {
      console.error('Resubmit plugin error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(submissionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${API_BASE}/${submissionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        return {};
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to delete submission' };
      }
    } catch (error) {
      console.error('Delete submission error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStatistics(): Promise<ApiResponse<SubmissionStatistics>> {
    try {
      const response = await fetch(`${API_BASE}/statistics`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to fetch statistics' };
      }
    } catch (error) {
      console.error('Get submission statistics error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Get available status options
   */
  async getStatusOptions(): Promise<ApiResponse<{ statuses: Record<string, string> }>> {
    try {
      const response = await fetch(`${API_BASE}/status-options`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else {
        const result = await response.json();
        return { error: result.error || 'Failed to fetch status options' };
      }
    } catch (error) {
      console.error('Get status options error:', error);
      return { error: 'Network error occurred' };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; service: string }>> {
    try {
      const response = await fetch(`${API_BASE}/health`);
      
      if (response.ok) {
        const data = await response.json();
        return { data };
      } else {
        return { error: 'Service unavailable' };
      }
    } catch (error) {
      console.error('Health check error:', error);
      return { error: 'Network error occurred' };
    }
  }
}

// Export singleton instance
export const submissionService = new SubmissionService();
export default submissionService;

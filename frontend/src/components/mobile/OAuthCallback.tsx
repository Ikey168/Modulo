import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mobileOAuthService } from '../../features/auth/mobileOAuthService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorAlert } from '../common/ErrorAlert';
import './OAuthCallback.css';

interface OAuthCallbackProps {
  provider: 'google' | 'microsoft';
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({ provider }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setIsProcessing(true);
        setError(null);

        // Get authorization code from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || `OAuth error: ${errorParam}`);
        }

        if (!code) {
          throw new Error('No authorization code received from OAuth provider');
        }

        if (!state) {
          throw new Error('No state parameter received from OAuth provider');
        }

        // Verify state parameter matches what we stored
        const storedState = sessionStorage.getItem(`oauth_state_${provider}`);
        if (state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Get stored code verifier for PKCE
        const codeVerifier = sessionStorage.getItem(`code_verifier_${provider}`);
        if (!codeVerifier) {
          throw new Error('Code verifier not found - please restart the login process');
        }

        console.log(`Processing ${provider} OAuth callback with code:`, code.substring(0, 10) + '...');

        // Exchange authorization code for tokens
        const result = await mobileOAuthService.handleCallback(provider, code, codeVerifier);
        
        if (result.success && result.user) {
          console.log(`${provider} OAuth login successful:`, result.user);
          
          // Clean up stored values
          sessionStorage.removeItem(`oauth_state_${provider}`);
          sessionStorage.removeItem(`code_verifier_${provider}`);
          
          // Store tokens if needed
          if (result.tokens) {
            localStorage.setItem(`${provider}_tokens`, JSON.stringify(result.tokens));
          }
          
          // Navigate to the intended destination or dashboard
          const returnUrl = sessionStorage.getItem('oauth_return_url') || '/dashboard';
          sessionStorage.removeItem('oauth_return_url');
          
          // Small delay to ensure state updates are processed
          setTimeout(() => {
            navigate(returnUrl, { replace: true });
          }, 500);
        } else {
          throw new Error(result.error || `Failed to complete ${provider} OAuth login`);
        }
      } catch (err) {
        console.error(`${provider} OAuth callback error:`, err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setIsProcessing(false);
        
        // Clean up stored values on error
        sessionStorage.removeItem(`oauth_state_${provider}`);
        sessionStorage.removeItem(`code_verifier_${provider}`);
      }
    };

    handleCallback();
  }, [provider, navigate, searchParams]);

  const handleRetry = () => {
    // Clear error and redirect back to login
    setError(null);
    navigate('/mobile/login', { replace: true });
  };

  const handleCancel = () => {
    navigate('/mobile/login', { replace: true });
  };

  if (isProcessing) {
    return (
      <div className="oauth-callback-page">
        <div className="callback-container">
          <div className="callback-header">
            <div className="provider-logo">
              {provider === 'google' ? '🔍' : '🏢'}
            </div>
            <h2>Completing {provider === 'google' ? 'Google' : 'Microsoft'} Sign In</h2>
            <p>Please wait while we process your authentication...</p>
          </div>
          
          <div className="loading-section">
            <LoadingSpinner size="large" />
            <p className="loading-text">Verifying your credentials</p>
          </div>
          
          <div className="security-note">
            <p>🔒 Your information is being securely processed</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="oauth-callback-page">
        <div className="callback-container">
          <div className="callback-header">
            <div className="provider-logo error">
              ❌
            </div>
            <h2>Sign In Failed</h2>
            <p>We encountered an issue while signing you in with {provider === 'google' ? 'Google' : 'Microsoft'}.</p>
          </div>
          
          <div className="error-section">
            <ErrorAlert message={error} />
          </div>
          
          <div className="action-buttons">
            <button 
              onClick={handleRetry}
              className="retry-button"
            >
              Try Again
            </button>
            <button 
              onClick={handleCancel}
              className="cancel-button"
            >
              Back to Login
            </button>
          </div>
          
          <div className="help-section">
            <h3>Troubleshooting Tips:</h3>
            <ul>
              <li>Ensure you have a stable internet connection</li>
              <li>Check if popup blockers are disabled</li>
              <li>Try clearing your browser cache and cookies</li>
              <li>Make sure JavaScript is enabled in your browser</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Individual callback components for easier routing
export const GoogleOAuthCallback: React.FC = () => (
  <OAuthCallback provider="google" />
);

export const MicrosoftOAuthCallback: React.FC = () => (
  <OAuthCallback provider="microsoft" />
);

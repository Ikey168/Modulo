import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import { useMobileAuth } from '../../features/auth/useMobileAuth';
import { MobileOptimizedButton } from './MobileOptimizedButton';
import ErrorAlert from '../common/ErrorAlert';
import './MobileLoginPage.css';

interface AuthButton {
  provider: string;
  label: string;
  icon: string;
  color: string;
  action: () => Promise<void>;
}

const MobileLoginPage: React.FC = () => {
  const location = useLocation();
  const { isMobile } = useResponsive();
  const {
    isAuthenticated,
    isLoading,
    error,
    authMethod,
    loginWithGoogle,
    loginWithMicrosoft,
    loginWithMetaMask,
    clearError
  } = useMobileAuth();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect to the intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // Define available authentication methods
  const authButtons: AuthButton[] = [
    {
      provider: 'google',
      label: 'Continue with Google',
      icon: '🔍',
      color: '#4285F4',
      action: loginWithGoogle
    },
    {
      provider: 'microsoft',
      label: 'Continue with Microsoft',
      icon: '🪟',
      color: '#0078D4',
      action: loginWithMicrosoft
    },
    {
      provider: 'metamask',
      label: 'Connect with MetaMask',
      icon: '🦊',
      color: '#F6851B',
      action: loginWithMetaMask
    }
  ];

  const handleAuthAction = async (provider: string, action: () => Promise<void>) => {
    setSelectedProvider(provider);
    try {
      await action();
    } catch (err) {
      console.error(`${provider} auth failed:`, err);
    } finally {
      setSelectedProvider(null);
    }
  };

  const getButtonState = (provider: string) => {
    if (isLoading && selectedProvider === provider) return 'loading';
    if (isLoading && selectedProvider !== provider) return 'disabled';
    return 'active';
  };

  const renderAuthButton = (button: AuthButton) => {
    const state = getButtonState(button.provider);
    
    return (
      <MobileOptimizedButton
        key={button.provider}
        onClick={() => handleAuthAction(button.provider, button.action)}
        disabled={state !== 'active'}
        className={`auth-button auth-button-${button.provider}`}
        style={{
          backgroundColor: state === 'active' ? button.color : '#f0f0f0',
          color: state === 'active' ? 'white' : '#666'
        }}
        ariaLabel={button.label}
      >
        <div className="auth-button-content">
          <span className="auth-button-icon">{button.icon}</span>
          <span className="auth-button-text">
            {state === 'loading' ? 'Connecting...' : button.label}
          </span>
          {state === 'loading' && (
            <div className="auth-button-spinner">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      </MobileOptimizedButton>
    );
  };

  return (
    <div className="mobile-login-page">
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <div className="logo">
            <span className="logo-icon">🔗</span>
            <h1>Modulo</h1>
          </div>
          <h2>Secure Mobile Login</h2>
          <p className="login-subtitle">
            Choose your preferred authentication method
          </p>
        </div>

        {/* Device Info */}
        {isMobile && (
          <div className="device-info">
            <div className="device-badge">
              <span className="device-icon">📱</span>
              <span>Mobile Device</span>
            </div>
            <div className="device-details">
              <span>Mobile Browser</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="login-error">
            <ErrorAlert
              message={error}
              onClose={clearError}
            />
          </div>
        )}

        {/* Authentication Methods */}
        <div className="auth-methods">
          <div className="auth-section">
            <h3>Quick Login</h3>
            <div className="auth-buttons">
              {authButtons.slice(0, 2).map(renderAuthButton)}
            </div>
          </div>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="auth-section">
            <h3>Blockchain Authentication</h3>
            <div className="auth-buttons">
              {authButtons.slice(2).map(renderAuthButton)}
            </div>
            <p className="blockchain-note">
              Connect your crypto wallet for secure blockchain authentication
            </p>
          </div>

          {/* Advanced Options */}
          <div className="advanced-section">
            <MobileOptimizedButton
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="advanced-toggle"
              ariaLabel="Toggle advanced options"
            >
              {showAdvanced ? '▲ Hide Advanced' : '▼ Show Advanced'}
            </MobileOptimizedButton>
            
            {showAdvanced && (
              <div className="advanced-options">
                <div className="option-item">
                  <h4>Enterprise Login</h4>
                  <p>Connect using your organization's identity provider</p>
                  <MobileOptimizedButton
                    onClick={() => window.location.href = '/login'}
                    className="enterprise-login"
                    ariaLabel="Enterprise login"
                  >
                    🏢 Enterprise SSO
                  </MobileOptimizedButton>
                </div>
                
                <div className="option-item">
                  <h4>Guest Access</h4>
                  <p>Limited access without authentication</p>
                  <MobileOptimizedButton
                    onClick={() => window.location.href = '/guest'}
                    className="guest-login"
                    ariaLabel="Guest access"
                  >
                    👤 Continue as Guest
                  </MobileOptimizedButton>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Overview */}
        <div className="features-overview">
          <h3>Why Choose Mobile Authentication?</h3>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Secure</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Fast</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🌐</span>
              <span className="feature-text">Universal</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚀</span>
              <span className="feature-text">Modern</span>
            </div>
          </div>
        </div>

        {/* Auth Status */}
        {authMethod && (
          <div className="auth-status">
            <p>
              {authMethod === 'oauth' ? '🔐 OAuth' : '🔗 Blockchain'} authentication active
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <div className="security-info">
            <p>🔒 Your data is protected with enterprise-grade security</p>
          </div>
          <div className="legal-links">
            <a href="/privacy" className="legal-link">Privacy Policy</a>
            <span className="separator">•</span>
            <a href="/terms" className="legal-link">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileLoginPage;

import React, { useState, useEffect } from 'react';
import { useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { loginWithOIDC, selectIsAuthenticated, selectAuthLoading, selectAuthError, clearError } from './authSlice';
import { AuthScreen, ModuloMark, Spinner } from './AuthScreen';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [localError, setLocalError] = useState<string | null>(null);

  // Get the intended destination from location state (defaults into the workspace)
  const from = location.state?.from?.pathname || '/app/notes';

  // Check for callback errors
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setLocalError(
        error === 'callback_failed'
          ? 'Authentication failed. Please try again.'
          : 'An error occurred during authentication.',
      );
    }
  }, [searchParams]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // If already authenticated, redirect to the intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleOIDCLogin = async () => {
    try {
      setLocalError(null);
      dispatch(clearError());

      // Store return URL for after authentication
      sessionStorage.setItem('returnTo', from);

      await dispatch(loginWithOIDC()).unwrap();
      // Redirect will happen via authService
    } catch (err) {
      setLocalError('Failed to initiate login. Please try again.');
    }
  };

  const error = authError || localError;

  return (
    <AuthScreen>
      <div style={{ width: '100%', maxWidth: 380, animation: 'authFadeUp .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'center', marginBottom: 26 }}>
          <ModuloMark size={30} />
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.5px' }}>Modulo</span>
        </div>

        <div style={{ background: '#111114', border: '1px solid #1e1e24', borderRadius: 14, padding: '30px 30px 26px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, textAlign: 'center', color: '#f4f4f5' }}>Sign in</h1>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: '#71717a', textAlign: 'center' }}>
            Secure authentication with Keycloak
          </p>

          {error && (
            <div className="auth-error">
              <span>{error}</span>
              <button
                onClick={() => {
                  setLocalError(null);
                  dispatch(clearError());
                }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <button className="auth-btn" onClick={handleOIDCLogin} disabled={isLoading}>
            {isLoading ? (
              <Spinner size={16} />
            ) : (
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path d="M6.5 2h-3A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h3" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                <path d="M9.5 11L12.5 8 9.5 5M12.5 8h-8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isLoading ? 'Signing in…' : 'Sign in with Keycloak'}
          </button>

          <p style={{ margin: '16px 0 0', fontSize: 11.5, color: '#52525b', textAlign: 'center' }}>
            OpenID Connect with PKCE
          </p>
        </div>

        <p style={{ margin: '18px 0 0', fontSize: 11.5, color: '#3f3f46', textAlign: 'center', lineHeight: 1.6 }}>
          By signing in, you agree to our{' '}
          <a href="/terms" className="auth-link">Terms of Service</a> and{' '}
          <a href="/privacy" className="auth-link">Privacy Policy</a>.
        </p>
      </div>
    </AuthScreen>
  );
};

export default LoginPage;

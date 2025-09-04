import React, { useState, useEffect } from 'react';
import { useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { loginWithOIDC, selectIsAuthenticated, selectAuthLoading, selectAuthError, clearError } from './authSlice';
import ErrorAlert from '../../components/common/ErrorAlert';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  // Check for callback errors
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setLocalError(
        error === 'callback_failed' 
          ? 'Authentication failed. Please try again.' 
          : 'An error occurred during authentication.'
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Modulo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Secure authentication with Keycloak
          </p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onClose={() => {
              setLocalError(null);
              dispatch(clearError());
            }}
          />
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={handleOIDCLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8 8s3.589 8 8 8 8-3.589 8-8-3.589 8-8 8z"></path>
                <path d="M12 6a1 1 0 011 1v4.586l2.707 2.707a1 1 0 01-1.414 1.414L11.5 12.914A1 1 0 0111 12V7a1 1 0 011-1z"></path>
              </svg>
            )}
            {isLoading ? 'Signing in...' : 'Sign in with Keycloak'}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Using secure OpenID Connect with PKCE
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-center text-sm text-gray-500">
            By signing in, you agree to our{' '}
            <a href="/terms" className="font-medium text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="font-medium text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import ErrorAlert from '../../components/common/ErrorAlert';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, initiateOAuthLogin, connectMetaMask, isMetaMaskAvailable } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<{ [key: string]: boolean }>({});
  
  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect to the intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleOAuthLogin = (provider: 'google' | 'azure') => {
    try {
      setError(null);
      setIsConnecting({ ...isConnecting, [provider]: true });
      initiateOAuthLogin(provider);
    } catch (err) {
      setError('Failed to initiate login. Please try again.');
      setIsConnecting({ ...isConnecting, [provider]: false });
    }
  };

  const handleMetaMaskLogin = async () => {
    try {
      setError(null);
      setIsConnecting({ ...isConnecting, metamask: true });
      await connectMetaMask();
      // Navigation will happen automatically via useAuth after successful connection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to MetaMask. Please try again.');
      setIsConnecting({ ...isConnecting, metamask: false });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Modulo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Choose your preferred login method
          </p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onClose={() => setError(null)}
          />
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={isConnecting.google}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting.google ? (
              <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12.545,12.151L12.545,12.151c0,1.054,0.855,1.909,1.909,1.909h3.536c-0.358,1.183-1.459,2.045-2.736,2.045 c-1.631,0-2.954-1.323-2.954-2.954c0-1.631,1.323-2.954,2.954-2.954c0.765,0,1.467,0.289,2,0.764l1.775-1.775 C17.449,7.613,15.935,7,14.318,7c-2.946,0-5.318,2.372-5.318,5.318s2.372,5.318,5.318,5.318c2.946,0,5.318-2.372,5.318-5.318 c0-0.479-0.064-0.943-0.182-1.385h-6.909V12.151z"></path>
              </svg>
            )}
            {isConnecting.google ? 'Connecting...' : 'Continue with Google'}
          </button>

          <button
            onClick={() => handleOAuthLogin('azure')}
            disabled={isConnecting.azure}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting.azure ? (
              <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
                <path d="M13 7h-2v6h6v-2h-4z"></path>
              </svg>
            )}
            {isConnecting.azure ? 'Connecting...' : 'Continue with Microsoft'}
          </button>

          {/* MetaMask Login Option */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or connect with</span>
            </div>
          </div>

          <button
            onClick={handleMetaMaskLogin}
            disabled={!isMetaMaskAvailable || isConnecting.metamask}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting.metamask ? (
              <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.8 3.6L14.4 8.4L15.6 5.4L20.8 3.6ZM3.2 3.6L8.4 5.4L9.6 8.4L3.2 3.6ZM18.4 15.6L20.8 20.4L15.6 18.6L18.4 15.6ZM5.6 15.6L8.4 18.6L3.2 20.4L5.6 15.6ZM9.6 9.6L12 11.1L14.4 9.6L13.2 12L12 14.4L10.8 12L9.6 9.6ZM8.4 13.2L6 16.8L9.6 15.6L8.4 13.2ZM15.6 13.2L14.4 15.6L18 16.8L15.6 13.2Z" fill="#F6851B"/>
              </svg>
            )}
            {!isMetaMaskAvailable 
              ? 'MetaMask Not Detected' 
              : isConnecting.metamask 
                ? 'Connecting...' 
                : 'Connect with MetaMask'
            }
          </button>

          {!isMetaMaskAvailable && (
            <p className="text-center text-sm text-gray-500">
              <a 
                href="https://metamask.io/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                Install MetaMask
              </a>{' '}
              to connect with your crypto wallet
            </p>
          )}
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
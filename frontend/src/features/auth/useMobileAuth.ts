import { useState, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { mobileOAuthService, AuthResult, OAuthUser, BlockchainUser } from './mobileOAuthService';
import { AuthProvider } from './mobileAuthConfig';
import { selectIsAuthenticated, selectAuthUser, selectAuthLoading } from './authSlice';

export interface MobileAuthState {
  isAuthenticated: boolean;
  user: OAuthUser | BlockchainUser | null;
  isLoading: boolean;
  error: string | null;
  authMethod: 'oauth' | 'blockchain' | null;
}

export interface MobileAuthActions {
  loginWithGoogle: () => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  loginWithMetaMask: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export const useMobileAuth = (): MobileAuthState & MobileAuthActions => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectAuthUser);
  const isLoadingAuth = useAppSelector(selectAuthLoading);

  const [localState, setLocalState] = useState({
    isLoading: false,
    error: null as string | null,
    authMethod: null as 'oauth' | 'blockchain' | null,
    mobileUser: null as OAuthUser | BlockchainUser | null
  });

  // Check for stored mobile auth data on mount
  useEffect(() => {
    const checkStoredAuth = () => {
      const storedUser = sessionStorage.getItem('mobile_auth_user');
      const storedMethod = sessionStorage.getItem('mobile_auth_method');
      
      if (storedUser && storedMethod) {
        try {
          const user = JSON.parse(storedUser);
          // Check if OAuth token is still valid
          if (storedMethod === 'oauth' && user.expiresAt < Date.now()) {
            // Token expired, clear storage
            sessionStorage.removeItem('mobile_auth_user');
            sessionStorage.removeItem('mobile_auth_method');
            return;
          }
          
          setLocalState(prev => ({
            ...prev,
            mobileUser: user,
            authMethod: storedMethod as 'oauth' | 'blockchain'
          }));
        } catch (error) {
          console.error('Failed to parse stored auth data:', error);
          sessionStorage.removeItem('mobile_auth_user');
          sessionStorage.removeItem('mobile_auth_method');
        }
      }
    };

    checkStoredAuth();
  }, []);

  const handleAuthResult = useCallback((result: AuthResult) => {
    if (result.success) {
      // Store auth data
      sessionStorage.setItem('mobile_auth_user', JSON.stringify(result.user));
      sessionStorage.setItem('mobile_auth_method', result.type);
      
      setLocalState(prev => ({
        ...prev,
        mobileUser: result.user,
        authMethod: result.type,
        error: null,
        isLoading: false
      }));
    } else {
      setLocalState(prev => ({
        ...prev,
        error: result.error || 'Authentication failed',
        isLoading: false
      }));
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      setLocalState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await mobileOAuthService.loginWithGoogle();
      handleAuthResult(result);
    } catch (error: any) {
      setLocalState(prev => ({
        ...prev,
        error: error.message || 'Google login failed',
        isLoading: false
      }));
    }
  }, [handleAuthResult]);

  const loginWithMicrosoft = useCallback(async () => {
    try {
      setLocalState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await mobileOAuthService.loginWithMicrosoft();
      handleAuthResult(result);
    } catch (error: any) {
      setLocalState(prev => ({
        ...prev,
        error: error.message || 'Microsoft login failed',
        isLoading: false
      }));
    }
  }, [handleAuthResult]);

  const loginWithMetaMask = useCallback(async () => {
    try {
      setLocalState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await mobileOAuthService.loginWithMetaMask();
      handleAuthResult(result);
    } catch (error: any) {
      setLocalState(prev => ({
        ...prev,
        error: error.message || 'MetaMask login failed',
        isLoading: false
      }));
    }
  }, [handleAuthResult]);

  const refreshToken = useCallback(async () => {
    const user = localState.mobileUser;
    if (!user || localState.authMethod !== 'oauth') {
      return;
    }

    const oauthUser = user as OAuthUser;
    if (!oauthUser.refreshToken) {
      setLocalState(prev => ({
        ...prev,
        error: 'No refresh token available'
      }));
      return;
    }

    try {
      setLocalState(prev => ({ ...prev, isLoading: true }));
      const refreshedUser = await mobileOAuthService.refreshToken(
        oauthUser.refreshToken,
        oauthUser.provider
      );
      
      // Update stored user data
      sessionStorage.setItem('mobile_auth_user', JSON.stringify(refreshedUser));
      
      setLocalState(prev => ({
        ...prev,
        mobileUser: refreshedUser,
        isLoading: false,
        error: null
      }));
    } catch (error: any) {
      setLocalState(prev => ({
        ...prev,
        error: error.message || 'Token refresh failed',
        isLoading: false
      }));
    }
  }, [localState.mobileUser, localState.authMethod]);

  const logout = useCallback(async () => {
    try {
      // Clear mobile auth service
      mobileOAuthService.logout();
      
      // Clear local storage
      sessionStorage.removeItem('mobile_auth_user');
      sessionStorage.removeItem('mobile_auth_method');
      
      // Reset local state
      setLocalState({
        isLoading: false,
        error: null,
        authMethod: null,
        mobileUser: null
      });
    } catch (error: any) {
      setLocalState(prev => ({
        ...prev,
        error: error.message || 'Logout failed'
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setLocalState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh OAuth tokens
  useEffect(() => {
    if (localState.authMethod === 'oauth' && localState.mobileUser) {
      const oauthUser = localState.mobileUser as OAuthUser;
      const timeUntilExpiry = oauthUser.expiresAt - Date.now();
      
      // Refresh token 5 minutes before expiry
      if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
        refreshToken();
      }
      
      // Set up auto-refresh timer
      const refreshTimer = setTimeout(() => {
        refreshToken();
      }, Math.max(timeUntilExpiry - 5 * 60 * 1000, 0));
      
      return () => clearTimeout(refreshTimer);
    }
  }, [localState.authMethod, localState.mobileUser, refreshToken]);

  // Determine final auth state (mobile auth takes precedence)
  const finalUser = localState.mobileUser || authUser;
  const finalIsAuthenticated = !!localState.mobileUser || isAuthenticated;
  const finalIsLoading = localState.isLoading || isLoadingAuth;

  return {
    isAuthenticated: finalIsAuthenticated,
    user: finalUser,
    isLoading: finalIsLoading,
    error: localState.error,
    authMethod: localState.authMethod,
    loginWithGoogle,
    loginWithMicrosoft,
    loginWithMetaMask,
    logout,
    refreshToken,
    clearError
  };
};

import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { selectCurrentUser, selectIsAuthenticated, clearCredentials } from './authSlice';
import { api } from '../../services/api';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const logout = useCallback(async () => {
    try {
      await api.post('/logout', {});
      dispatch(clearCredentials());
    } catch (error) {
      console.error('Logout error:', error);
      // Clear credentials anyway in case of backend error
      dispatch(clearCredentials());
    }
  }, [dispatch]);

  const initiateOAuthLogin = useCallback((provider: 'google' | 'azure') => {
    window.location.href = `/oauth2/authorization/${provider}`;
  }, []);

  return {
    user,
    isAuthenticated,
    logout,
    initiateOAuthLogin,
  };
};

// Types for auth state
export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
  provider?: 'google' | 'azure';
}
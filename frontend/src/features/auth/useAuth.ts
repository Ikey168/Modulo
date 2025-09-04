import { useAppSelector, useAppDispatch } from '../../store/store';
import { 
  selectIsAuthenticated, 
  selectCurrentUser, 
  selectCurrentToken,
  selectAuthLoading,
  selectAuthError,
  selectUserRoles,
  logout,
  initializeAuth
} from './authSlice';
import { UserRole } from './oidcConfig';
import { authService } from './authService';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const token = useAppSelector(selectCurrentToken);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const roles = useAppSelector(selectUserRoles);

  const login = async () => {
    await authService.login();
  };

  const logoutUser = async () => {
    await dispatch(logout()).unwrap();
  };

  const hasRole = (role: UserRole): boolean => {
    return authService.hasRole(role);
  };

  const hasAnyRole = (requiredRoles: UserRole[]): boolean => {
    return authService.hasAnyRole(requiredRoles);
  };

  const getAccessToken = async (): Promise<string | null> => {
    return await authService.getAccessToken();
  };

  const initAuth = async () => {
    await dispatch(initializeAuth()).unwrap();
  };

  return {
    // State
    isAuthenticated,
    user,
    token,
    isLoading,
    error,
    roles,
    
    // Actions
    login,
    logout: logoutUser,
    hasRole,
    hasAnyRole,
    getAccessToken,
    initAuth,
    
    // Legacy properties for backward compatibility
    isMetaMaskAvailable: false,
    connectMetaMask: () => Promise.reject('MetaMask not supported in OIDC flow'),
    initiateOAuthLogin: () => Promise.reject('OAuth not supported in OIDC flow'),
    refreshWalletBalance: () => Promise.reject('Wallet not supported in OIDC flow'),
  };
};

// Export types for compatibility
export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
  walletAddress?: string;
  walletBalance?: string;
  authProvider?: 'google' | 'azure' | 'metamask' | 'oidc';
  roles?: UserRole[];
}
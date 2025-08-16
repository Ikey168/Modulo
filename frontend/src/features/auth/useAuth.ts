import { useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { selectCurrentUser, selectIsAuthenticated, clearCredentials, setMetaMaskCredentials, updateWalletBalance } from './authSlice';
import { api } from '../../services/api';
import { metaMaskService } from '../../services/metamask';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const logout = useCallback(async () => {
    try {
      // If it's a MetaMask session, just clear local state
      if (user?.authProvider === 'metamask') {
        metaMaskService.disconnect();
        dispatch(clearCredentials());
        return;
      }

      // For OAuth sessions, call backend logout
      await api.post('/logout', {});
      dispatch(clearCredentials());
    } catch (error) {
      console.error('Logout error:', error);
      // Clear credentials anyway in case of backend error
      dispatch(clearCredentials());
    }
  }, [dispatch, user?.authProvider]);

  const initiateOAuthLogin = useCallback((provider: 'google' | 'azure') => {
    window.location.href = `/oauth2/authorization/${provider}`;
  }, []);

  const connectMetaMask = useCallback(async () => {
    try {
      const userInfo = await metaMaskService.connect();
      dispatch(setMetaMaskCredentials({
        walletAddress: userInfo.walletAddress,
        walletBalance: userInfo.walletBalance,
        chainId: userInfo.chainId,
        networkName: userInfo.networkName
      }));
      return userInfo;
    } catch (error) {
      console.error('MetaMask connection error:', error);
      throw error;
    }
  }, [dispatch]);

  const refreshWalletBalance = useCallback(async () => {
    if (user?.walletAddress && user?.authProvider === 'metamask') {
      try {
        const balance = await metaMaskService.refreshBalance(user.walletAddress);
        dispatch(updateWalletBalance(balance));
        return balance;
      } catch (error) {
        console.error('Failed to refresh wallet balance:', error);
        throw error;
      }
    }
  }, [dispatch, user?.walletAddress, user?.authProvider]);

  // Set up MetaMask event listeners
  useEffect(() => {
    if (user?.authProvider === 'metamask') {
      // Listen for account changes
      metaMaskService.onAccountsChanged((accounts) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          dispatch(clearCredentials());
        } else if (accounts[0] !== user.walletAddress) {
          // User switched accounts - reconnect with new account
          connectMetaMask();
        }
      });

      // Listen for network changes
      metaMaskService.onChainChanged((chainId) => {
        // Optionally handle network changes
        console.log('Network changed to:', chainId);
      });

      return () => {
        metaMaskService.removeListeners();
      };
    }
  }, [user?.authProvider, user?.walletAddress, dispatch, connectMetaMask]);

  return {
    user,
    isAuthenticated,
    logout,
    initiateOAuthLogin,
    connectMetaMask,
    refreshWalletBalance,
    isMetaMaskAvailable: metaMaskService.isMetaMaskInstalled(),
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
  walletAddress?: string;
  walletBalance?: string;
  authProvider?: 'google' | 'azure' | 'metamask';
}
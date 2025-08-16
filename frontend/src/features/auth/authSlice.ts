import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store/store';

export interface User {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;  // Added picture field for OAuth provider avatar
  givenName?: string;
  familyName?: string;
  locale?: string;
  walletAddress?: string;  // MetaMask wallet address
  walletBalance?: string;  // Wallet balance in ETH
  authProvider?: 'google' | 'azure' | 'metamask';  // Authentication provider
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}

// Restore state from localStorage
const getInitialState = (): AuthState => {
  try {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (isAuthenticated && userStr) {
      const user = JSON.parse(userStr);
      return {
        user,
        isAuthenticated: true,
        token: token || 'session_active',
      };
    }
  } catch (error) {
    console.error('Error restoring auth state from localStorage:', error);
  }
  
  return {
    user: null,
    isAuthenticated: false,
    token: null,
  };
};

const initialState: AuthState = getInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token?: string }>
    ) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.token = action.payload.token || 'session_active';
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      if (action.payload.token) {
        localStorage.setItem('token', action.payload.token);
      }
    },
    setMetaMaskCredentials: (
      state,
      action: PayloadAction<{ walletAddress: string; walletBalance: string; chainId?: number; networkName?: string }>
    ) => {
      const { walletAddress, walletBalance } = action.payload;
      state.user = {
        id: walletAddress,
        name: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
        walletAddress,
        walletBalance,
        authProvider: 'metamask'
      };
      state.isAuthenticated = true;
      state.token = 'metamask_session';
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(state.user));
      localStorage.setItem('authProvider', 'metamask');
      localStorage.setItem('walletAddress', walletAddress);
    },
    updateWalletBalance: (
      state,
      action: PayloadAction<string>
    ) => {
      if (state.user && state.user.authProvider === 'metamask') {
        state.user.walletBalance = action.payload;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('authProvider');
      localStorage.removeItem('walletAddress');
    },
  },
});

export const { setCredentials, setMetaMaskCredentials, updateWalletBalance, clearCredentials } = authSlice.actions;

export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectCurrentToken = (state: RootState) => state.auth.token;

export default authSlice.reducer;
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store/store';
import { authService } from './authService';
import { UserRole } from './oidcConfig';

// Legacy interface for MetaMask compatibility
export interface User {
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

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
  token: null,
};

// Async thunks for OIDC authentication
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getUser();
      return user;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to initialize auth');
    }
  }
);

export const loginWithOIDC = createAsyncThunk(
  'auth/loginOIDC',
  async (_, { rejectWithValue }) => {
    try {
      await authService.login();
      return null; // Redirect happens, no return value needed
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

export const handleAuthCallback = createAsyncThunk(
  'auth/handleCallback',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.handleCallback();
      return user;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Callback handling failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return null;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Logout failed');
    }
  }
);

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
      state.error = null;
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
      state.error = null;
    },
    updateWalletBalance: (
      state,
      action: PayloadAction<string>
    ) => {
      if (state.user && state.user.authProvider === 'metamask') {
        state.user.walletBalance = action.payload;
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      state.error = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Initialize auth
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.user = {
            id: action.payload.id,
            name: action.payload.name,
            email: action.payload.email,
            roles: action.payload.roles,
            authProvider: 'oidc'
          };
          state.isAuthenticated = true;
          state.token = action.payload.accessToken;
        } else {
          state.user = null;
          state.isAuthenticated = false;
          state.token = null;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
      })
      
      // Login with OIDC
      .addCase(loginWithOIDC.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithOIDC.fulfilled, (state) => {
        state.isLoading = false;
        // Redirect happens, state will be updated by callback
      })
      .addCase(loginWithOIDC.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Handle auth callback
      .addCase(handleAuthCallback.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(handleAuthCallback.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = {
          id: action.payload.id,
          name: action.payload.name,
          email: action.payload.email,
          roles: action.payload.roles,
          authProvider: 'oidc'
        };
        state.isAuthenticated = true;
        state.token = action.payload.accessToken;
      })
      .addCase(handleAuthCallback.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // Still clear credentials even if logout failed
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
      });
  },
});

export const { 
  setCredentials, 
  setMetaMaskCredentials, 
  updateWalletBalance, 
  clearCredentials,
  setError,
  clearError
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectCurrentToken = (state: RootState) => state.auth.token;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthInitialized = (state: RootState) => state.auth.isInitialized;

// Role-based selectors
export const selectUserRoles = (state: RootState) => state.auth.user?.roles || [];
export const selectHasRole = (role: UserRole) => (state: RootState) => 
  state.auth.user?.roles?.includes(role) || false;
export const selectHasAnyRole = (roles: UserRole[]) => (state: RootState) => 
  roles.some(role => state.auth.user?.roles?.includes(role)) || false;

export default authSlice.reducer;
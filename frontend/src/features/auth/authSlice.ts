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
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
};

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
    clearCredentials: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;

export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectCurrentToken = (state: RootState) => state.auth.token;

export default authSlice.reducer;
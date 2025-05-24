import { clearCredentials } from '../features/auth/authSlice';
import { store } from '../store/store';

const API_BASE_URL = 'http://localhost:8081/api';

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient(endpoint: string, options: ApiOptions = {}) {
  const { skipAuth, ...fetchOptions } = options;

  const defaultOptions: RequestInit = {
    credentials: 'include',  // Always include credentials for cookies
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    ...fetchOptions,
  };

  // Handle redirects manually to support OAuth flow
  const response = await fetch(`${API_BASE_URL}${endpoint}`, defaultOptions);

  if (response.status === 302) {
    const location = response.headers.get('Location');
    if (location?.includes('/login')) {
      // Clear auth state and redirect to login
      store.dispatch(clearCredentials());
      window.location.href = '/login';
      throw new Error('Authentication required');
    } else if (location) {
      // Handle OAuth redirects
      window.location.href = location;
      return null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      store.dispatch(clearCredentials());
    }
    throw new Error(response.statusText);
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

// Convenience methods
export const api = {
  get: (endpoint: string, options?: ApiOptions) => 
    apiClient(endpoint, { method: 'GET', ...options }),
    
  post: (endpoint: string, data: any, options?: ApiOptions) =>
    apiClient(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    }),

  put: (endpoint: string, data: any, options?: ApiOptions) =>
    apiClient(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    }),

  delete: (endpoint: string, options?: ApiOptions) =>
    apiClient(endpoint, { method: 'DELETE', ...options }),
};
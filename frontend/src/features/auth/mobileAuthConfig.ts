import { UserManagerSettings } from 'oidc-client-ts';

// Mobile-optimized OIDC configuration
export const mobileOAuthConfig = {
  // Google OAuth configuration for mobile
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/google/callback`,
    scope: 'openid profile email',
    responseType: 'code',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
  },

  // Microsoft OAuth configuration for mobile
  microsoft: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
    tenantId: import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common',
    redirectUri: `${window.location.origin}/auth/microsoft/callback`,
    scope: 'openid profile email User.Read',
    responseType: 'code',
    authorizationEndpoint: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
    userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me'
  }
};

// Enhanced mobile OIDC config extending the existing one
export const mobileOidcConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo',
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'modulo-frontend',
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email roles',
  automaticSilentRenew: false, // Disable for mobile to save battery
  silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
  includeIdTokenInSilentRenew: false, // Mobile optimization
  loadUserInfo: true,
  
  // Mobile-specific configurations
  response_mode: 'query',
  prompt: 'login', // Always prompt for better mobile UX
  
  // Security settings optimized for mobile
  filterProtocolClaims: true,
  clockSkew: 300, // 5 minutes tolerance for mobile time sync issues
  
  // Use sessionStorage instead of localStorage for mobile security
  userStore: {
    set: (key: string, value: any) => {
      sessionStorage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    },
    get: (key: string) => {
      const item = sessionStorage.getItem(key);
      return Promise.resolve(item ? JSON.parse(item) : null);
    },
    remove: (key: string) => {
      sessionStorage.removeItem(key);
      return Promise.resolve();
    },
    getAllKeys: () => {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) keys.push(key);
      }
      return Promise.resolve(keys);
    }
  },
  
  // Mobile-specific metadata
  metadata: {
    issuer: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo',
    authorization_endpoint: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/auth`,
    token_endpoint: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/token`,
    userinfo_endpoint: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/userinfo`,
    end_session_endpoint: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/logout`,
    jwks_uri: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/certs`,
    check_session_iframe: `${import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/realms/modulo'}/protocol/openid-connect/login-status-iframe.html`,
  }
};

export interface OAuthProvider {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  config: typeof mobileOAuthConfig.google | typeof mobileOAuthConfig.microsoft;
}

export const oauthProviders: OAuthProvider[] = [
  {
    name: 'google',
    displayName: 'Google',
    icon: '🔍',
    color: '#4285F4',
    config: mobileOAuthConfig.google
  },
  {
    name: 'microsoft',
    displayName: 'Microsoft',
    icon: '🪟',
    color: '#0078D4',
    config: mobileOAuthConfig.microsoft
  }
];

export type AuthProvider = 'google' | 'microsoft' | 'metamask' | 'keycloak';

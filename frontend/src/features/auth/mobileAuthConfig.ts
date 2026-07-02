
// Mobile-optimized OIDC configuration
export const mobileOAuthConfig = {
  // Google OAuth configuration for mobile
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/mobile/auth/google/callback`,
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
    redirectUri: `${window.location.origin}/mobile/auth/microsoft/callback`,
    scope: 'openid profile email User.Read',
    responseType: 'code',
    authorizationEndpoint: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
    userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me'
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

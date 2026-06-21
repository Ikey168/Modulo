import { UserManagerSettings } from 'oidc-client-ts';

// OIDC configuration for Keycloak with PKCE
export const oidcConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180/realms/modulo',
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'modulo-frontend',
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email roles',
  automaticSilentRenew: true,
  silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
  includeIdTokenInSilentRenew: true,
  // Don't call the UserInfo endpoint. Keycloak already puts everything we read
  // (sub, email, name, preferred_username, realm_access/resource_access roles)
  // in the ID token, so UserInfo is redundant -- and oidc-client-ts asserts
  // userInfo.sub === idToken.sub, which was throwing "subject from UserInfo
  // response does not match subject in ID Token" and failing the callback.
  loadUserInfo: false,
  
  // PKCE configuration
  response_mode: 'query',
  
  // Security settings
  filterProtocolClaims: true,
  userStore: {
    // Use memory storage instead of localStorage for security
    set: () => Promise.resolve(),
    get: () => Promise.resolve(null),
    remove: () => Promise.resolve(null),
    getAllKeys: () => Promise.resolve([])
  },
  
  // Metadata configuration
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

// Role mapping from Keycloak to internal roles
export const ROLE_MAPPINGS = {
  'admin': 'ADMIN',
  'editor': 'EDITOR', 
  'viewer': 'VIEWER',
  'plugin-developer': 'PLUGIN_DEVELOPER',
  'plugin-reviewer': 'PLUGIN_REVIEWER'
} as const;

export type UserRole = typeof ROLE_MAPPINGS[keyof typeof ROLE_MAPPINGS];

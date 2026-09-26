import type { UserManagerSettings } from 'oidc-client-ts';
import { Capacitor } from '@capacitor/core';

const issuer = window.__MODULO_CONFIG__?.oidcIssuer || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180/realms/modulo';
const clientId = window.__MODULO_CONFIG__?.oidcClientId || import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'modulo-frontend';
const android = Capacitor.getPlatform() === 'android';
const redirectOrigin = android ? window.__MODULO_CONFIG__?.serverOrigin : window.location.origin;
if (android && !redirectOrigin) throw new Error('Select a Modulo server before signing in.');

// OIDC configuration for Keycloak with PKCE
export const oidcConfig: UserManagerSettings = {
  authority: issuer,
  client_id: clientId,
  redirect_uri: `${redirectOrigin}/auth/callback`,
  post_logout_redirect_uri: android ? 'com.modulo:/logout' : `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email roles',
  automaticSilentRenew: !android,
  silent_redirect_uri: android ? undefined : `${window.location.origin}/auth/silent-callback`,
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
  // Metadata configuration
  metadata: {
    issuer: issuer,
    authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
    token_endpoint: `${issuer}/protocol/openid-connect/token`,
    userinfo_endpoint: `${issuer}/protocol/openid-connect/userinfo`,
    end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
    jwks_uri: `${issuer}/protocol/openid-connect/certs`,
    check_session_iframe: `${issuer}/protocol/openid-connect/login-status-iframe.html`,
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

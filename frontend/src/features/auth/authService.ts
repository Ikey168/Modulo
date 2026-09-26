import { UserManager, User, WebStorageStateStore, InMemoryWebStorage, type INavigator } from 'oidc-client-ts';
import { Capacitor } from '@capacitor/core';
import { InAppBrowser, DefaultWebViewOptions } from '@capacitor/inappbrowser';
import { oidcConfig, ROLE_MAPPINGS, UserRole } from './oidcConfig';
import type { StateSession } from '../../services/pluginStateTransport';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresAt: number;
}

class AuthService {
  private userManager: UserManager;
  private user: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initialization: Promise<void>;
  private readonly sessionListeners = new Set<() => void>();
  private nativeReturnTo = '/app/dashboard';

  setNativeReturnTo(path: string): void {
    this.nativeReturnTo = path.startsWith('/app/') ? path : '/app/dashboard';
  }

  takeNativeReturnTo(): string {
    const path = this.nativeReturnTo;
    this.nativeReturnTo = '/app/dashboard';
    return path;
  }

  stateSession(): StateSession | null {
    return this.user && !this.user.expired ? { issuer: oidcConfig.authority,
      subject: this.user.profile.sub, accessToken: this.user.access_token } : null;
  }

  subscribeSession(listener: () => void): () => void {
    this.sessionListeners.add(listener);
    return () => { this.sessionListeners.delete(listener); };
  }

  private notifySession(): void {
    for (const listener of this.sessionListeners) { try { listener(); } catch { /* observer isolation */ } }
  }

  constructor() {
    // Keep native PKCE state and tokens in memory. In the browser, keep the
    // short-lived PKCE state in this tab and the OIDC user in durable storage
    // so a reload or desktop-app restart can restore the session.
    const native = Capacitor.getPlatform() === 'android';
    const stateStore = new WebStorageStateStore({ store: native ? new InMemoryWebStorage() : window.sessionStorage });
    const userStore = new WebStorageStateStore({ store: native ? new InMemoryWebStorage() : window.localStorage });
    const redirectNavigator: INavigator | undefined = native ? {
      prepare: async () => ({
        navigate: async ({ url }) => {
          await InAppBrowser.openInWebView({ url, options: {
            ...DefaultWebViewOptions,
            showURL: false,
            showNavigationButtons: false,
            closeButtonText: 'Cancel',
            clearCache: false,
            clearSessionCache: false,
            android: { ...DefaultWebViewOptions.android, isIsolated: true },
          } });
          return { url };
        },
        close: () => { void InAppBrowser.close(); },
      }),
      callback: async () => {},
    } : undefined;
    
    this.userManager = new UserManager({
      ...oidcConfig,
      stateStore,
      userStore
    }, redirectNavigator);

    this.setupEventHandlers();
    this.initialization = this.initializeAuth();
  }

  private setupEventHandlers() {
    this.userManager.events.addUserLoaded((user) => {
      this.user = user;
      this.notifySession();
      this.scheduleTokenRefresh(user);
      console.log('User loaded:', user.profile);
    });

    this.userManager.events.addUserUnloaded(() => {
      this.user = null;
      this.notifySession();
      this.clearRefreshTimer();
      console.log('User unloaded');
    });

    this.userManager.events.addAccessTokenExpiring(() => {
      console.log('Access token expiring, attempting silent renewal');
      this.silentRenew();
    });

    this.userManager.events.addAccessTokenExpired(() => {
      console.log('Access token expired');
      this.user = null;
      this.notifySession();
      this.clearRefreshTimer();
    });

    this.userManager.events.addSilentRenewError((error) => {
      console.error('Silent renewal error:', error);
    });
  }

  private async initializeAuth() {
    try {
      // Restore the saved OIDC user before route guards or API calls read auth.
      this.user = await this.userManager.getUser();
      if (this.user?.expired) {
        try {
          this.user = await this.userManager.signinSilent();
        } catch (error) {
          console.info('Stored login has expired; a new sign-in is required:', error);
          await this.userManager.removeUser();
          this.user = null;
        }
      }
      this.notifySession();
      if (this.user && !this.user.expired) {
        this.scheduleTokenRefresh(this.user);
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.user = null;
      this.notifySession();
    }
  }

  private scheduleTokenRefresh(user: User) {
    this.clearRefreshTimer();
    
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = user.expires_at || 0;
    const expiresIn = expiresAt - now;
    const refreshIn = Math.max(expiresIn - 60, 30); // Refresh 1 min before expiry, minimum 30s
    
    this.refreshTimer = setTimeout(() => {
      this.silentRenew();
    }, refreshIn * 1000);
  }

  private clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async login(): Promise<void> {
    try {
      await this.initialization;
      await this.userManager.signinRedirect();
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Failed to initiate login');
    }
  }

  async handleCallback(url?: string): Promise<AuthUser> {
    try {
      await this.initialization;
      const user = await this.userManager.signinRedirectCallback(url);
      this.user = user;
      this.notifySession();
      return this.mapUserToAuthUser(user);
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw new Error('Failed to handle authentication callback');
    }
  }

  async handleNativeLogout(url: string): Promise<void> {
    await this.userManager.signoutRedirectCallback(url);
  }

  async silentRenew(): Promise<void> {
    try {
      const user = await this.userManager.signinSilent();
      this.user = user;
      this.notifySession();
      if (user) {
        this.scheduleTokenRefresh(user);
      } else {
        this.clearRefreshTimer();
      }
    } catch (error) {
      console.error('Silent renewal failed:', error);
      // A temporary identity-provider failure should not end the SSO session.
      // Retry while the current access token remains usable; clear only an
      // expired local session and let the next login reuse Keycloak's cookie.
      if (this.user && !this.user.expired) {
        this.scheduleTokenRefresh(this.user);
      } else {
        this.user = null;
        this.clearRefreshTimer();
        await this.userManager.removeUser();
        this.notifySession();
      }
    }
  }

  async logout(): Promise<void> {
    this.user = null;
    this.notifySession();
    try {
      this.clearRefreshTimer();
      await this.userManager.signoutRedirect();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear local state even if remote logout fails
      this.user = null;
      this.clearRefreshTimer();
    }
  }

  async getUser(): Promise<AuthUser | null> {
    await this.initialization;
    if (!this.user || this.user.expired) {
      return null;
    }
    return this.mapUserToAuthUser(this.user);
  }

  async getAccessToken(): Promise<string | null> {
    await this.initialization;
    if (!this.user || this.user.expired) {
      return null;
    }
    return this.user.access_token;
  }

  isAuthenticated(): boolean {
    return this.user !== null && !this.user.expired;
  }

  hasRole(role: UserRole): boolean {
    if (!this.user) return false;
    
    const userRoles = this.extractRoles(this.user);
    return userRoles.includes(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    if (!this.user) return false;
    
    const userRoles = this.extractRoles(this.user);
    return roles.some(role => userRoles.includes(role));
  }

  private mapUserToAuthUser(user: User): AuthUser {
    const roles = this.extractRoles(user);
    
    return {
      id: user.profile.sub,
      email: user.profile.email || '',
      name: user.profile.name || user.profile.preferred_username || '',
      roles,
      accessToken: user.access_token,
      refreshToken: user.refresh_token,
      idToken: user.id_token || '',
      expiresAt: user.expires_at || 0
    };
  }

  private extractRoles(user: User): UserRole[] {
    const roles: UserRole[] = [];
    
    // Extract roles from realm_access
    const realmRoles = (user.profile.realm_access as any)?.roles || [];
    
    // Extract roles from resource_access for our client
    const clientId = oidcConfig.client_id as string;
    const clientRoles = (user.profile.resource_access as any)?.[clientId]?.roles || [];
    
    // Map Keycloak roles to internal roles
    [...realmRoles, ...clientRoles].forEach(role => {
      const mappedRole = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
      if (mappedRole && !roles.includes(mappedRole)) {
        roles.push(mappedRole);
      }
    });
    
    return roles;
  }
}

// Export singleton instance
export const authService = new AuthService();

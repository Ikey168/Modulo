import { UserManager, User, WebStorageStateStore, type INavigator } from 'oidc-client-ts';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { deviceDocuments } from '../../services/deviceDocuments';
import { secureStore } from '../../services/secureStore';
import { nativeReminders } from '../../services/nativeReminders';
import { DeviceOidcStateStore } from './deviceOidcStateStore';
import { isNetworkFailure, loadNativeSession, nativeSessionKey, saveNativeSession, type NativeSessionRecord } from './nativeSession';
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
  /** Signed in on this device, but the session could not be renewed without a connection. */
  offline?: boolean;
}

const ANDROID = Capacitor.getPlatform() === 'android';
const serverOrigin = () => window.__MODULO_CONFIG__?.serverOrigin ?? '';

class AuthService {
  private userManager: UserManager;
  private user: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly sessionListeners = new Set<() => void>();
  private nativeReturnTo = '/app/dashboard';
  /** Android identity kept while the refresh token cannot reach the server (offline launch). */
  private offline: NativeSessionRecord | null = null;
  private readonly ready: Promise<void>;

  setNativeReturnTo(path: string): void {
    this.nativeReturnTo = path.startsWith('/app/') ? path : '/app/dashboard';
  }

  takeNativeReturnTo(): string {
    const path = this.nativeReturnTo;
    this.nativeReturnTo = '/app/dashboard';
    return path;
  }

  stateSession(): StateSession | null {
    if (this.user && !this.user.expired) {
      return { issuer: oidcConfig.authority, subject: this.user.profile.sub, accessToken: this.user.access_token };
    }
    // Offline: the account's cached state and queue stay usable; requests wait for renewal.
    return this.offline ? { issuer: this.offline.issuer, subject: this.offline.subject, accessToken: '' } : null;
  }

  /** True while signed in on this device without a renewed session (no connection). */
  isOffline(): boolean { return !!this.offline && !(this.user && !this.user.expired); }

  subscribeSession(listener: () => void): () => void {
    this.sessionListeners.add(listener);
    return () => { this.sessionListeners.delete(listener); };
  }

  private notifySession(): void {
    for (const listener of this.sessionListeners) { try { listener(); } catch { /* observer isolation */ } }
  }

  constructor() {
    // Native PKCE transaction state lives in app-private device storage so a
    // login can finish after Android recreated the app behind the Custom Tab.
    // Tokens are never written there.
    const stateStore = ANDROID ? new DeviceOidcStateStore(deviceDocuments())
      : new WebStorageStateStore({ store: window.sessionStorage });
    // RFC 8252: the identity provider opens in the system browser (Custom
    // Tabs), never in a WebView the app controls.
    const redirectNavigator: INavigator | undefined = ANDROID ? {
      prepare: async () => ({
        navigate: async ({ url }) => {
          await Browser.open({ url });
          return { url };
        },
        close: () => { void Browser.close().catch(() => { /* The tab may already be gone. */ }); },
      }),
      callback: async () => {},
    } : undefined;
    
    this.userManager = new UserManager({
      ...oidcConfig,
      stateStore
    }, redirectNavigator);

    this.setupEventHandlers();
    this.ready = this.initializeAuth();
    if (ANDROID) {
      // Returning connectivity renews an offline session without a new login.
      window.addEventListener('online', () => { if (this.isOffline()) void this.restoreNativeSession(); });
    }
  }

  private setupEventHandlers() {
    this.userManager.events.addUserLoaded((user) => {
      this.user = user;
      this.offline = null;
      this.notifySession();
      this.scheduleTokenRefresh(user);
      void this.persistNativeSession(user);
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
      this.user = null;
      this.notifySession();
      this.clearRefreshTimer();
      if (ANDROID) void this.restoreNativeSession();
    });

    this.userManager.events.addSilentRenewError((error) => {
      if (ANDROID && isNetworkFailure(error)) { void this.restoreNativeSession(); return; }
      console.error('Silent renewal failed');
      this.logout();
    });
  }

  private async initializeAuth() {
    try {
      // Check if user is already authenticated
      this.user = await this.userManager.getUser();
      this.notifySession();
      if (this.user && !this.user.expired) {
        this.scheduleTokenRefresh(this.user);
      } else if (ANDROID) {
        await this.restoreNativeSession();
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  /** Keep the (rotated) refresh token and its identity in Keystore-backed storage. */
  private async persistNativeSession(user: User): Promise<void> {
    if (!ANDROID || !user.refresh_token || !serverOrigin()) return;
    try {
      await saveNativeSession(secureStore(), { server: serverOrigin(), issuer: oidcConfig.authority, subject: user.profile.sub,
        refreshToken: user.refresh_token, idToken: user.id_token, name: user.profile.name ?? user.profile.preferred_username,
        email: user.profile.email });
    } catch {
      console.error('The session could not be kept for the next launch.');
    }
  }

  /**
   * Renew the Android session from the stored refresh token. Without a
   * connection the identity stays available offline; a rejected token ends
   * the session and removes the credential.
   */
  private async restoreNativeSession(): Promise<void> {
    const server = serverOrigin();
    if (!server) return;
    const store = secureStore();
    const record = await loadNativeSession(store, server, oidcConfig.authority).catch(() => null);
    if (!record) { this.offline = null; this.notifySession(); return; }
    try {
      await this.userManager.storeUser(new User({ access_token: '', token_type: 'Bearer', refresh_token: record.refreshToken,
        id_token: record.idToken, profile: { sub: record.subject, iss: record.issuer, aud: oidcConfig.client_id, exp: 0, iat: 0 },
        expires_at: 0, scope: oidcConfig.scope }));
      const user = await this.userManager.signinSilent();
      if (!user || user.profile.sub !== record.subject || (user.profile.iss && user.profile.iss !== record.issuer)) {
        throw new Error('invalid_grant: renewed session belongs to another identity');
      }
      // userLoaded stores the rotated refresh token and clears offline mode.
      this.user = user;
      this.offline = null;
      this.notifySession();
      this.scheduleTokenRefresh(user);
    } catch (error) {
      if (isNetworkFailure(error)) {
        this.offline = record;
      } else {
        this.offline = null;
        await store.remove(nativeSessionKey(server)).catch(() => undefined);
        await this.userManager.removeUser().catch(() => undefined);
      }
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
      await this.userManager.signinRedirect();
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Failed to initiate login');
    }
  }

  async handleCallback(url?: string): Promise<AuthUser> {
    try {
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
      }
    } catch (error) {
      console.error('Silent renewal failed:', error);
      await this.logout();
    }
  }

  async logout(): Promise<void> {
    this.user = null;
    this.offline = null;
    this.notifySession();
    if (ANDROID && serverOrigin()) await secureStore().remove(nativeSessionKey(serverOrigin())).catch(() => undefined);
    // A signed-out device must not keep showing the account's reminders (#494).
    await nativeReminders()?.cancelAll().catch(() => undefined);
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
    await this.ready;
    if (this.user && !this.user.expired) return this.mapUserToAuthUser(this.user);
    if (this.offline) {
      return { id: this.offline.subject, email: this.offline.email ?? '', name: this.offline.name ?? '', roles: [],
        accessToken: '', idToken: '', expiresAt: 0, offline: true };
    }
    return null;
  }

  async getAccessToken(): Promise<string | null> {
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

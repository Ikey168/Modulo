import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';
import { oidcConfig, ROLE_MAPPINGS, UserRole } from './oidcConfig';

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

  constructor() {
    // Use sessionStorage for state store (more secure than localStorage)
    const stateStore = new WebStorageStateStore({ store: window.sessionStorage });
    
    this.userManager = new UserManager({
      ...oidcConfig,
      stateStore
    });

    this.setupEventHandlers();
    this.initializeAuth();
  }

  private setupEventHandlers() {
    this.userManager.events.addUserLoaded((user) => {
      this.user = user;
      this.scheduleTokenRefresh(user);
      console.log('User loaded:', user.profile);
    });

    this.userManager.events.addUserUnloaded(() => {
      this.user = null;
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
      this.clearRefreshTimer();
    });

    this.userManager.events.addSilentRenewError((error) => {
      console.error('Silent renewal error:', error);
      this.logout();
    });
  }

  private async initializeAuth() {
    try {
      // Check if user is already authenticated
      this.user = await this.userManager.getUser();
      if (this.user && !this.user.expired) {
        this.scheduleTokenRefresh(this.user);
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
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

  async handleCallback(): Promise<AuthUser> {
    try {
      const user = await this.userManager.signinRedirectCallback();
      this.user = user;
      return this.mapUserToAuthUser(user);
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw new Error('Failed to handle authentication callback');
    }
  }

  async silentRenew(): Promise<void> {
    try {
      const user = await this.userManager.signinSilent();
      this.user = user;
      if (user) {
        this.scheduleTokenRefresh(user);
      }
    } catch (error) {
      console.error('Silent renewal failed:', error);
      await this.logout();
    }
  }

  async logout(): Promise<void> {
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
    if (!this.user || this.user.expired) {
      return null;
    }
    return this.mapUserToAuthUser(this.user);
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

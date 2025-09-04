import { AuthProvider, OAuthProvider, oauthProviders } from './mobileAuthConfig';
import { metaMaskService, MetaMaskUser } from '../../services/metamask';

export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: AuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface BlockchainUser {
  walletAddress: string;
  walletBalance: string;
  chainId: number;
  networkName: string;
  signature?: string;
  provider: 'metamask';
}

export interface AuthResult {
  user: OAuthUser | BlockchainUser;
  type: 'oauth' | 'blockchain';
  success: boolean;
  error?: string;
}

export class MobileOAuthService {
  private currentPopup: Window | null = null;
  private authTimeout: NodeJS.Timeout | null = null;

  /**
   * Check if we're running on mobile
   */
  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Generate a secure random state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const codeVerifier = this.generateState();
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(provider: OAuthProvider, state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: provider.config.clientId,
      redirect_uri: provider.config.redirectUri,
      response_type: provider.config.responseType,
      scope: provider.config.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Mobile-specific parameters
      display: this.isMobile() ? 'touch' : 'page',
      prompt: 'select_account' // Allow user to choose account
    });

    return `${provider.config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Handle OAuth popup or redirect flow
   */
  private async handleOAuthFlow(provider: OAuthProvider): Promise<AuthResult> {
    const state = this.generateState();
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    
    // Store PKCE parameters
    sessionStorage.setItem(`oauth_state_${state}`, JSON.stringify({
      provider: provider.name,
      codeVerifier,
      timestamp: Date.now()
    }));

    const authUrl = this.buildAuthUrl(provider, state, codeChallenge);

    // On mobile, use redirect instead of popup
    if (this.isMobile()) {
      window.location.href = authUrl;
      // Return a pending promise that will be resolved by the redirect handler
      return new Promise(() => {}); // This will be resolved by handleCallback
    } else {
      // Desktop popup flow
      return this.handlePopupFlow(authUrl, state);
    }
  }

  /**
   * Handle desktop popup flow
   */
  private async handlePopupFlow(authUrl: string, _state: string): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        authUrl,
        'oauth_popup',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      this.currentPopup = popup;

      // Set timeout
      this.authTimeout = setTimeout(() => {
        popup.close();
        reject(new Error('Authentication timed out'));
      }, 300000); // 5 minutes

      // Listen for popup messages
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth_success') {
          if (this.authTimeout) clearTimeout(this.authTimeout);
          popup.close();
          window.removeEventListener('message', messageHandler);
          resolve(event.data.result);
        } else if (event.data.type === 'oauth_error') {
          if (this.authTimeout) clearTimeout(this.authTimeout);
          popup.close();
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          if (this.authTimeout) clearTimeout(this.authTimeout);
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('Authentication was cancelled'));
        }
      }, 1000);
    });
  }

  /**
   * Handle OAuth callback (for mobile redirect flow)
   */
  async handleCallback(searchParams: URLSearchParams): Promise<AuthResult> {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Invalid OAuth callback parameters');
    }

    // Retrieve stored PKCE parameters
    const storedData = sessionStorage.getItem(`oauth_state_${state}`);
    if (!storedData) {
      throw new Error('Invalid or expired OAuth state');
    }

    const { provider: providerName, codeVerifier } = JSON.parse(storedData);
    const provider = oauthProviders.find(p => p.name === providerName);
    
    if (!provider) {
      throw new Error('Invalid OAuth provider');
    }

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(provider, code, codeVerifier);
    
    // Get user info
    const userInfo = await this.getUserInfo(provider, tokenResponse.access_token);

    // Clean up stored state
    sessionStorage.removeItem(`oauth_state_${state}`);

    const user: OAuthUser = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: provider.name as AuthProvider,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
    };

    return {
      user,
      type: 'oauth',
      success: true
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(provider: OAuthProvider, code: string, codeVerifier: string) {
    const tokenData = {
      grant_type: 'authorization_code',
      client_id: provider.config.clientId,
      code: code,
      redirect_uri: provider.config.redirectUri,
      code_verifier: codeVerifier
    };

    const response = await fetch(provider.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(tokenData)
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get user information from OAuth provider
   */
  private async getUserInfo(provider: OAuthProvider, accessToken: string) {
    const response = await fetch(provider.config.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const userInfo = await response.json();

    // Normalize user info across providers
    return {
      id: userInfo.id || userInfo.sub,
      email: userInfo.email,
      name: userInfo.name || userInfo.displayName,
      picture: userInfo.picture || userInfo.avatar_url
    };
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(): Promise<AuthResult> {
    const provider = oauthProviders.find(p => p.name === 'google');
    if (!provider) {
      throw new Error('Google OAuth not configured');
    }
    return this.handleOAuthFlow(provider);
  }

  /**
   * Login with Microsoft OAuth
   */
  async loginWithMicrosoft(): Promise<AuthResult> {
    const provider = oauthProviders.find(p => p.name === 'microsoft');
    if (!provider) {
      throw new Error('Microsoft OAuth not configured');
    }
    return this.handleOAuthFlow(provider);
  }

  /**
   * Login with MetaMask
   */
  async loginWithMetaMask(): Promise<AuthResult> {
    try {
      const metaMaskUser: MetaMaskUser = await metaMaskService.connect();
      
      // Generate a message to sign for authentication
      const message = `Login to Modulo\nWallet: ${metaMaskUser.walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await metaMaskService.signMessage(message);

      const user: BlockchainUser = {
        ...metaMaskUser,
        signature,
        provider: 'metamask'
      };

      return {
        user,
        type: 'blockchain',
        success: true
      };
    } catch (error: any) {
      return {
        user: {} as BlockchainUser,
        type: 'blockchain',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(refreshToken: string, provider: AuthProvider): Promise<OAuthUser> {
    const oauthProvider = oauthProviders.find(p => p.name === provider);
    if (!oauthProvider) {
      throw new Error('Invalid provider for token refresh');
    }

    const tokenData = {
      grant_type: 'refresh_token',
      client_id: oauthProvider.config.clientId,
      refresh_token: refreshToken
    };

    const response = await fetch(oauthProvider.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(tokenData)
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenResponse = await response.json();
    const userInfo = await this.getUserInfo(oauthProvider, tokenResponse.access_token);

    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: provider,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || refreshToken,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
    };
  }

  /**
   * Logout from all providers
   */
  logout(): void {
    // Clear all stored auth data
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('oauth_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));

    // Disconnect MetaMask
    metaMaskService.disconnect();

    // Close any open popup
    if (this.currentPopup) {
      this.currentPopup.close();
      this.currentPopup = null;
    }

    // Clear timeout
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
  }
}

// Create singleton instance
export const mobileOAuthService = new MobileOAuthService();

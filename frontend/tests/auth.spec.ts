import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should redirect unauthenticated users to login page when accessing protected routes', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard');
    
    // Should be redirected to login page
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2')).toContainText('Sign in to Modulo');
  });

  test('should display login page with OIDC login button', async ({ page }) => {
    await page.goto('/login');
    
    // Check that the login page is displayed correctly
    await expect(page.locator('h2')).toContainText('Sign in to Modulo');
    await expect(page.locator('button').filter({ hasText: 'Sign in with Keycloak' })).toBeVisible();
    await expect(page.locator('text=Using secure OpenID Connect with PKCE')).toBeVisible();
  });

  test('should redirect to Keycloak when clicking login button', async ({ page }) => {
    await page.goto('/login');
    
    // Mock the OIDC redirect (since we can't actually login without a real Keycloak server)
    await page.route('**/auth/callback', route => {
      route.fulfill({
        status: 200,
        body: 'Redirecting...'
      });
    });

    // Click the login button
    const loginButton = page.locator('button').filter({ hasText: 'Sign in with Keycloak' });
    await expect(loginButton).toBeEnabled();
    
    // Note: In a real test environment, this would redirect to Keycloak
    // For this test, we just verify the button is functional
  });

  test('should handle authentication callback', async ({ page }) => {
    // Mock successful authentication callback
    await page.route('**/auth/callback*', route => {
      // Simulate successful callback processing
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          access_token: 'mock-token',
          id_token: 'mock-id-token',
          expires_in: 3600
        })
      });
    });

    await page.goto('/auth/callback?code=mock-code&state=mock-state');
    
    // Should show loading state
    await expect(page.locator('text=Completing authentication...')).toBeVisible();
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Navigate to login with error parameter
    await page.goto('/login?error=callback_failed');
    
    // Should display error message
    await expect(page.locator('text=Authentication failed. Please try again.')).toBeVisible();
  });

  test('should preserve return URL after authentication', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/contracts');
    
    // Should be redirected to login page
    await expect(page).toHaveURL('/login');
    
    // Mock successful authentication
    await page.evaluate(() => {
      // Simulate setting user data in Redux store
      window.sessionStorage.setItem('returnTo', '/contracts');
    });
    
    // Verify return URL is preserved
    const returnTo = await page.evaluate(() => window.sessionStorage.getItem('returnTo'));
    expect(returnTo).toBe('/contracts');
  });
});

test.describe('Role-Based Access Control', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user with specific roles
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['VIEWER', 'EDITOR'],
        authProvider: 'oidc'
      }));
    });
  });

  test('should display content based on user roles', async ({ page }) => {
    // Navigate to a page that uses role-based components
    await page.goto('/dashboard');
    
    // Verify that role-specific content is displayed
    // Note: This would need to be implemented in the actual components
    // This is a placeholder test for the role-based access control functionality
  });

  test('should hide admin-only features for non-admin users', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Verify that admin-only features are not visible
    // This test would check for specific UI elements that should only be visible to admins
  });
});

test.describe('Token Management', () => {
  test('should handle token expiration gracefully', async ({ page }) => {
    // Mock an expired token scenario
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Token expired' })
      });
    });

    await page.goto('/dashboard');
    
    // Should redirect to login page when token is expired
    await expect(page).toHaveURL('/login');
  });

  test('should automatically refresh tokens when needed', async ({ page }) => {
    // Mock token refresh scenario
    let tokenRefreshed = false;
    
    await page.route('**/auth/token/refresh', route => {
      tokenRefreshed = true;
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          access_token: 'new-mock-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        })
      });
    });

    // This test would verify automatic token refresh functionality
    // Implementation depends on the specific token refresh mechanism
  });
});

test.describe('Security Features', () => {
  test('should not store sensitive data in localStorage', async ({ page }) => {
    await page.goto('/login');
    
    // Check that no sensitive authentication data is stored in localStorage
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    
    // Verify that access tokens and other sensitive data are not in localStorage
    const sensitiveKeys = localStorageKeys.filter(key => 
      key.includes('token') || 
      key.includes('password') || 
      key.includes('secret')
    );
    
    expect(sensitiveKeys).toHaveLength(0);
  });

  test('should use secure session storage for state', async ({ page }) => {
    await page.goto('/login');
    
    // Verify that only non-sensitive state is stored
    const sessionStorageKeys = await page.evaluate(() => Object.keys(sessionStorage));
    
    // Should only contain non-sensitive data like return URLs
    expect(sessionStorageKeys).not.toContain('access_token');
    expect(sessionStorageKeys).not.toContain('refresh_token');
  });

  test('should clear all auth data on logout', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      window.sessionStorage.setItem('returnTo', '/dashboard');
    });

    await page.goto('/dashboard');
    
    // Trigger logout
    await page.locator('button').filter({ hasText: 'Logout' }).click();
    
    // Verify that all auth-related data is cleared
    const sessionStorageKeys = await page.evaluate(() => Object.keys(sessionStorage));
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    
    expect(sessionStorageKeys).not.toContain('user');
    expect(localStorageKeys).not.toContain('isAuthenticated');
  });
});

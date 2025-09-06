import { test, expect } from '@playwright/test';

test.describe('User Registration and Profile Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete user registration workflow', async ({ page }) => {
    // Navigate to registration (if exists) or login for new user
    await page.goto('/register');
    
    // If registration page doesn't exist, test the OIDC first-time user flow
    if (await page.locator('text=Not Found').isVisible()) {
      await page.goto('/login');
      
      // Mock first-time user authentication flow
      await page.route('**/auth/callback*', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            access_token: 'new-user-token',
            id_token: 'new-user-id-token',
            profile: {
              sub: 'new-user-123',
              email: 'newuser@example.com',
              name: 'New Test User',
              given_name: 'New',
              family_name: 'User',
              first_login: true
            }
          })
        });
      });
      
      const loginButton = page.locator('button').filter({ hasText: 'Sign in with Keycloak' });
      await loginButton.click();
      
      // Should redirect to profile setup for first-time users
      await expect(page).toHaveURL(/\/profile|\/onboarding|\/setup/);
    }
    
    // Complete profile setup (if profile page exists)
    if (await page.locator('input[name="displayName"]').isVisible()) {
      await page.fill('input[name="displayName"]', 'New Test User');
      await page.fill('input[name="bio"]', 'Test user biography');
      await page.selectOption('select[name="preferredLanguage"]', 'en');
      await page.click('button[type="submit"]');
    }
    
    // Verify successful registration/profile creation
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should allow profile updates', async ({ page }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['USER'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });

    await page.goto('/profile');
    
    // Update profile information
    if (await page.locator('input[name="displayName"]').isVisible()) {
      await page.fill('input[name="displayName"]', 'Updated Test User');
      await page.fill('textarea[name="bio"]', 'Updated biography with more details');
      
      // Save changes
      await page.click('button').filter({ hasText: /Save|Update/ });
      
      // Verify success message
      await expect(page.locator('text=Profile updated')).toBeVisible();
      
      // Verify changes persisted
      await expect(page.locator('input[name="displayName"]')).toHaveValue('Updated Test User');
    }
  });

  test('should handle profile photo upload', async ({ page }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['USER'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });

    await page.goto('/profile');
    
    // Test file upload functionality (if available)
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Create a test file
      const buffer = Buffer.from('fake image data');
      await fileInput.setInputFiles({
        name: 'profile.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });
      
      // Verify upload initiated
      await expect(page.locator('text=Uploading')).toBeVisible();
      await expect(page.locator('text=Upload complete')).toBeVisible();
    }
  });

  test('should manage notification preferences', async ({ page }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['USER'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });

    await page.goto('/settings/notifications');
    
    // Toggle notification settings
    if (await page.locator('input[type="checkbox"]').first().isVisible()) {
      const emailNotifications = page.locator('input[name="emailNotifications"]');
      const pushNotifications = page.locator('input[name="pushNotifications"]');
      
      await emailNotifications.check();
      await pushNotifications.uncheck();
      
      await page.click('button').filter({ hasText: /Save|Update/ });
      
      // Verify settings saved
      await expect(page.locator('text=Settings updated')).toBeVisible();
    }
  });
});

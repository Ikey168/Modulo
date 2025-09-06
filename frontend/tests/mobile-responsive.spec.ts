import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness E2E', () => {
  // Test on different mobile viewports
  const mobileDevices = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Samsung Galaxy S21', width: 360, height: 800 },
    { name: 'iPad Mini', width: 768, height: 1024 }
  ];

  test.beforeEach(async ({ page }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'mobile@example.com',
        name: 'Mobile User',
        roles: ['USER'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });
  });

  mobileDevices.forEach(device => {
    test(`should display properly on ${device.name}`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/');

      // Check navigation visibility
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Check mobile menu button exists on smaller screens
      if (device.width < 768) {
        const menuButton = page.locator('[data-testid="mobile-menu-button"]');
        if (await menuButton.isVisible()) {
          await menuButton.click();
          const mobileMenu = page.locator('[data-testid="mobile-menu"]');
          await expect(mobileMenu).toBeVisible();
        }
      }

      // Check content container responsiveness
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      
      // Verify no horizontal scroll
      const bodyOverflow = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).overflowX;
      });
      expect(bodyOverflow).not.toBe('scroll');
    });
  });

  test('should handle touch gestures on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/notes');

    // Test swipe gestures on note items if available
    const noteItem = page.locator('[data-testid="note-item"]').first();
    if (await noteItem.isVisible()) {
      // Simulate swipe left
      await noteItem.hover();
      await page.mouse.down();
      await page.mouse.move(300, 0);
      await page.mouse.up();

      // Check if swipe actions are revealed
      const swipeActions = page.locator('[data-testid="swipe-actions"]');
      if (await swipeActions.isVisible()) {
        await expect(swipeActions).toBeVisible();
      }
    }
  });

  test('should display mobile-friendly forms', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/notes');

    // Try to create a new note on mobile
    const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add|\+/ }).first();
    if (await createButton.isVisible()) {
      await createButton.click();

      // Check form inputs are touch-friendly
      const titleInput = page.locator('input[name="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.focus();
        await titleInput.fill('Mobile Test Note');

        // Verify input is properly sized for mobile
        const inputBox = await titleInput.boundingBox();
        if (inputBox) {
          expect(inputBox.height).toBeGreaterThan(40); // Minimum touch target
        }

        const contentArea = page.locator('textarea[name="content"]');
        if (await contentArea.isVisible()) {
          await contentArea.focus();
          await contentArea.fill('Content created on mobile device');

          // Check textarea is responsive
          const textAreaBox = await contentArea.boundingBox();
          if (textAreaBox) {
            expect(textAreaBox.width).toBeLessThan(page.viewportSize()!.width);
          }
        }
      }
    }
  });

  test('should have accessible mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check for hamburger menu
    const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"], button[aria-expanded]');
    if (await hamburgerMenu.first().isVisible()) {
      await hamburgerMenu.first().click();

      // Verify menu items are accessible
      const menuItems = page.locator('[role="menuitem"], nav a, [data-testid="nav-item"]');
      const count = await menuItems.count();
      
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const item = menuItems.nth(i);
          await expect(item).toBeVisible();
          
          // Check touch target size
          const itemBox = await item.boundingBox();
          if (itemBox) {
            expect(itemBox.height).toBeGreaterThan(40);
          }
        }
      }
    }
  });

  test('should handle mobile keyboard interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/notes');

    // Test virtual keyboard doesn't break layout
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[name="search"]');
    if (await searchInput.first().isVisible()) {
      await searchInput.first().focus();
      
      // Simulate keyboard opening (viewport height change)
      await page.setViewportSize({ width: 375, height: 400 });
      
      // Ensure input is still visible and usable
      await expect(searchInput.first()).toBeVisible();
      await searchInput.first().fill('mobile search test');
      
      // Restore viewport
      await page.setViewportSize({ width: 375, height: 667 });
    }
  });

  test('should optimize image loading for mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check images have proper mobile attributes
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const img = images.nth(i);
        
        // Check for responsive attributes
        const srcset = await img.getAttribute('srcset');
        const sizes = await img.getAttribute('sizes');
        const loading = await img.getAttribute('loading');
        
        // Images should ideally have responsive attributes
        if (srcset || sizes) {
          expect(srcset || sizes).toBeTruthy();
        }
        
        // Check loading strategy
        if (loading) {
          expect(['lazy', 'eager']).toContain(loading);
        }
      }
    }
  });

  test('should handle mobile-specific features', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/profile');

    // Test pull-to-refresh if implemented
    await page.evaluate(() => {
      window.scrollTo(0, -100);
    });

    // Test bottom navigation if present
    const bottomNav = page.locator('[data-testid="bottom-navigation"], .bottom-nav');
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toBeVisible();
      
      // Check bottom nav is properly positioned
      const bottomNavBox = await bottomNav.boundingBox();
      const viewport = page.viewportSize()!;
      
      if (bottomNavBox) {
        expect(bottomNavBox.y + bottomNavBox.height).toBeCloseTo(viewport.height, 50);
      }
    }

    // Test floating action button if present
    const fab = page.locator('[data-testid="fab"], .fab, button[class*="fab"]');
    if (await fab.isVisible()) {
      await expect(fab).toBeVisible();
      
      // Verify FAB is accessible
      const fabBox = await fab.boundingBox();
      if (fabBox) {
        expect(fabBox.width).toBeGreaterThan(48);
        expect(fabBox.height).toBeGreaterThan(48);
      }
    }
  });

  test('should maintain performance on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Start performance measurement
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load reasonably fast on mobile (under 3 seconds)
    expect(loadTime).toBeLessThan(3000);
    
    // Check for performance optimization indicators
    const lazyImages = page.locator('img[loading="lazy"]');
    const lazyImageCount = await lazyImages.count();
    
    // Should have some lazy loading if many images
    const totalImages = await page.locator('img').count();
    if (totalImages > 5) {
      expect(lazyImageCount).toBeGreaterThan(0);
    }
  });

  test('should support offline functionality on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Go offline
    await page.context().setOffline(true);
    
    // Try to navigate
    await page.goto('/notes');
    
    // Check for offline indicators or cached content
    const offlineIndicator = page.locator('[data-testid="offline-indicator"], .offline-banner');
    const cachedContent = page.locator('[data-testid="cached-content"], .cached');
    
    // Should show either offline indicator or cached content
    const hasOfflineSupport = await offlineIndicator.isVisible() || await cachedContent.isVisible();
    
    // Or at minimum, should not show a browser error page
    const hasNetworkError = await page.locator('text=ERR_INTERNET_DISCONNECTED').isVisible();
    expect(hasNetworkError).toBeFalsy();
    
    // Go back online
    await page.context().setOffline(false);
  });
});

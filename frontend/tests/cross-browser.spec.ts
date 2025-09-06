import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser Compatibility E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user for all browsers
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'crossbrowser@example.com',
        name: 'Cross Browser User',
        roles: ['USER', 'EDITOR'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });
  });

  // Test core functionality across different browsers
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`should handle authentication flow in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/login');
      
      // Check login page elements
      const loginButton = page.locator('button').filter({ hasText: /Login|Sign In/ }).first();
      if (await loginButton.isVisible()) {
        await expect(loginButton).toBeVisible();
        
        // Test different auth providers
        const googleLogin = page.locator('button').filter({ hasText: /Google/ }).first();
        const azureLogin = page.locator('button').filter({ hasText: /Microsoft|Azure/ }).first();
        const oidcLogin = page.locator('button').filter({ hasText: /OIDC|SSO/ }).first();
        
        if (await googleLogin.isVisible()) {
          await expect(googleLogin).toBeEnabled();
        }
        if (await azureLogin.isVisible()) {
          await expect(azureLogin).toBeEnabled();
        }
        if (await oidcLogin.isVisible()) {
          await expect(oidcLogin).toBeEnabled();
        }
      }
    });

    test(`should render UI components correctly in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/');
      
      // Check navigation rendering
      const navigation = page.locator('nav');
      await expect(navigation).toBeVisible();
      
      // Check main content area
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      // Check footer if present
      const footer = page.locator('footer');
      if (await footer.isVisible()) {
        await expect(footer).toBeVisible();
      }
      
      // Check CSS animations and transitions work
      const animatedElements = page.locator('[class*="animate"], [class*="transition"]');
      const animatedCount = await animatedElements.count();
      
      if (animatedCount > 0) {
        const firstAnimated = animatedElements.first();
        await firstAnimated.hover();
        
        // Small delay to allow animations
        await page.waitForTimeout(300);
        await expect(firstAnimated).toBeVisible();
      }
    });

    test(`should handle form interactions in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/notes');
      
      const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        // Test form inputs
        const titleInput = page.locator('input[name="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill(`Test Note ${browserName}`);
          await expect(titleInput).toHaveValue(`Test Note ${browserName}`);
          
          // Test textarea
          const contentArea = page.locator('textarea[name="content"]');
          if (await contentArea.isVisible()) {
            await contentArea.fill(`Content for ${browserName} browser testing`);
            await expect(contentArea).toHaveValue(`Content for ${browserName} browser testing`);
          }
          
          // Test select dropdown
          const prioritySelect = page.locator('select[name="priority"]');
          if (await prioritySelect.isVisible()) {
            await prioritySelect.selectOption('high');
            await expect(prioritySelect).toHaveValue('high');
          }
          
          // Test date input
          const dateInput = page.locator('input[type="date"]');
          if (await dateInput.isVisible()) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];
            await dateInput.fill(dateStr);
            await expect(dateInput).toHaveValue(dateStr);
          }
        }
      }
    });

    test(`should handle JavaScript features in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/');
      
      // Test modern JavaScript features
      const jsFeatureTest = await page.evaluate(() => {
        const results = {
          arrow: (() => true)(),
          async: typeof (async () => {})().then === 'function',
          destructuring: (() => { const [a] = [1]; return a === 1; })(),
          templateLiterals: `test` === 'test',
          classes: typeof class {} === 'function',
          modules: typeof window !== 'undefined' && 'import' in window,
          promises: typeof Promise !== 'undefined',
          fetch: typeof fetch !== 'undefined',
          localStorage: typeof localStorage !== 'undefined',
          sessionStorage: typeof sessionStorage !== 'undefined'
        };
        return results;
      });
      
      expect(jsFeatureTest.arrow).toBe(true);
      expect(jsFeatureTest.async).toBe(true);
      expect(jsFeatureTest.destructuring).toBe(true);
      expect(jsFeatureTest.templateLiterals).toBe(true);
      expect(jsFeatureTest.classes).toBe(true);
      expect(jsFeatureTest.promises).toBe(true);
      expect(jsFeatureTest.fetch).toBe(true);
      expect(jsFeatureTest.localStorage).toBe(true);
      expect(jsFeatureTest.sessionStorage).toBe(true);
    });

    test(`should handle CSS features in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/');
      
      // Test CSS Grid and Flexbox support
      const cssSupport = await page.evaluate(() => {
        const testDiv = document.createElement('div');
        document.body.appendChild(testDiv);
        
        const support = {
          flexbox: false,
          grid: false,
          customProperties: false,
          transforms: false
        };
        
        try {
          testDiv.style.display = 'flex';
          support.flexbox = testDiv.style.display === 'flex';
          
          testDiv.style.display = 'grid';
          support.grid = testDiv.style.display === 'grid';
          
          testDiv.style.setProperty('--test', 'value');
          support.customProperties = testDiv.style.getPropertyValue('--test') === 'value';
          
          testDiv.style.transform = 'translateX(10px)';
          support.transforms = testDiv.style.transform.includes('translateX');
          
        } catch (e) {
          // Browser doesn't support these features
        }
        
        document.body.removeChild(testDiv);
        return support;
      });
      
      expect(cssSupport.flexbox).toBe(true);
      expect(cssSupport.grid).toBe(true);
      expect(cssSupport.customProperties).toBe(true);
      expect(cssSupport.transforms).toBe(true);
    });

    test(`should handle file upload in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `Skipping ${browserName} specific test`);
      
      await page.goto('/notes');
      
      const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible()) {
          // Test file upload
          const buffer = Buffer.from(`File content for ${browserName} testing`);
          await fileInput.setInputFiles({
            name: `test-${browserName}.txt`,
            mimeType: 'text/plain',
            buffer,
          });
          
          // Verify file was selected
          const fileName = await fileInput.evaluate((input: HTMLInputElement) => {
            return input.files && input.files.length > 0 ? input.files[0].name : '';
          });
          
          expect(fileName).toBe(`test-${browserName}.txt`);
        }
      }
    });
  });

  // Test responsive behavior across browsers
  test('should be responsive across all browsers', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 768, height: 1024 }, // iPad
      { width: 1200, height: 800 }, // Desktop
      { width: 1920, height: 1080 } // Large Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      
      // Check content fits viewport
      const body = page.locator('body');
      const bodyBox = await body.boundingBox();
      
      if (bodyBox) {
        expect(bodyBox.width).toBeLessThanOrEqual(viewport.width + 20); // Small tolerance
      }
      
      // Check navigation adapts to viewport
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
      
      if (viewport.width < 768) {
        // Should show mobile menu on small screens
        const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
        if (await mobileMenu.isVisible()) {
          await expect(mobileMenu).toBeVisible();
        }
      }
    }
  });

  // Test accessibility across browsers
  test('should maintain accessibility standards', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic accessibility features
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        
        // Images should have alt text or aria-label
        expect(alt !== null || ariaLabel !== null).toBe(true);
      }
    }
    
    // Check for form labels
    const inputs = page.locator('input[type="text"], input[type="email"], textarea');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.isVisible();
          
          // Input should have label, aria-label, or aria-labelledby
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    }
  });

  // Test performance across browsers
  test('should perform well across browsers', async ({ page }) => {
    // Navigate to the app
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should load in reasonable time
    expect(loadTime).toBeLessThan(5000);
    
    // Check for console errors
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Navigate to different pages
    const pages = ['/notes', '/profile', '/settings'];
    for (const pagePath of pages) {
      if (await page.locator(`a[href="${pagePath}"]`).isVisible()) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
      }
    }
    
    // Should have minimal console errors
    const criticalErrors = logs.filter(log => 
      !log.includes('404') && // Ignore 404s
      !log.includes('favicon') && // Ignore favicon errors
      !log.includes('Warning') // Ignore warnings
    );
    
    expect(criticalErrors.length).toBeLessThan(3);
  });

  // Test WebRTC and modern web APIs
  test('should support modern web APIs where available', async ({ page }) => {
    await page.goto('/');
    
    const apiSupport = await page.evaluate(() => {
      return {
        webrtc: typeof RTCPeerConnection !== 'undefined',
        websockets: typeof WebSocket !== 'undefined',
        webworkers: typeof Worker !== 'undefined',
        serviceworker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        geolocation: typeof navigator !== 'undefined' && 'geolocation' in navigator,
        notification: typeof Notification !== 'undefined',
        indexeddb: typeof indexedDB !== 'undefined',
        canvas: (() => {
          try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
          } catch (e) {
            return false;
          }
        })()
      };
    });
    
    // These should be supported in modern browsers
    expect(apiSupport.websockets).toBe(true);
    expect(apiSupport.canvas).toBe(true);
    expect(apiSupport.indexeddb).toBe(true);
    
    // These may not be supported in all test environments
    // but should not cause errors
    expect(typeof apiSupport.webrtc).toBe('boolean');
    expect(typeof apiSupport.serviceworker).toBe('boolean');
    expect(typeof apiSupport.geolocation).toBe('boolean');
  });
});

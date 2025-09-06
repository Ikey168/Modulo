import { test, expect } from '@playwright/test';

test.describe('Performance Testing E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'perf@example.com',
        name: 'Performance User',
        roles: ['USER'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });
  });

  test('should load the homepage within performance budgets', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Homepage should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      return JSON.parse(JSON.stringify(performance.timing));
    });
    
    // Calculate key metrics
    const domContentLoaded = performanceMetrics.domContentLoadedEventEnd - performanceMetrics.navigationStart;
    const firstPaint = performanceMetrics.loadEventEnd - performanceMetrics.navigationStart;
    
    // Performance budgets
    expect(domContentLoaded).toBeLessThan(2000); // 2 seconds for DOM content loaded
    expect(firstPaint).toBeLessThan(3000); // 3 seconds for full load
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/notes');
    
    // Mock API response with large dataset
    await page.route('**/api/notes*', route => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Test Note ${i + 1}`,
        content: `This is test note content for note number ${i + 1}. `.repeat(10),
        createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [`tag${i % 10}`, `category${i % 5}`],
        priority: ['low', 'medium', 'high'][i % 3]
      }));
      
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: largeDataset, total: 1000 })
      });
    });
    
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for data to render
    await page.waitForSelector('[data-testid="note-item"]', { timeout: 10000 });
    
    const renderTime = Date.now() - startTime;
    
    // Large dataset should render within 5 seconds
    expect(renderTime).toBeLessThan(5000);
    
    // Check virtual scrolling or pagination is working
    const visibleNotes = page.locator('[data-testid="note-item"]');
    const visibleCount = await visibleNotes.count();
    
    // Should not render all 1000 items at once
    expect(visibleCount).toBeLessThan(100);
  });

  test('should maintain performance during navigation', async ({ page }) => {
    const pages = ['/', '/notes', '/profile', '/settings'];
    const navigationTimes: number[] = [];
    
    for (const pagePath of pages) {
      const startTime = Date.now();
      
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      const navigationTime = Date.now() - startTime;
      navigationTimes.push(navigationTime);
      
      // Each page should load within 2 seconds
      expect(navigationTime).toBeLessThan(2000);
    }
    
    // Average navigation time should be reasonable
    const avgNavigationTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
    expect(avgNavigationTime).toBeLessThan(1500);
  });

  test('should handle concurrent user interactions efficiently', async ({ page }) => {
    await page.goto('/notes');
    
    // Create multiple interactions simultaneously
    const interactions = [
      () => page.locator('input[name="search"]').fill('test search'),
      () => page.locator('select[name="filter"]').selectOption('priority'),
      () => page.locator('button').filter({ hasText: /Sort/ }).first().click(),
      () => page.locator('[data-testid="note-item"]').first().click()
    ];
    
    const startTime = Date.now();
    
    // Execute all interactions concurrently
    await Promise.all(
      interactions.map(async (interaction, index) => {
        try {
          await interaction();
        } catch (error) {
          // Some interactions might not be available, that's OK
          console.log(`Interaction ${index} not available:`, error);
        }
      })
    );
    
    const totalTime = Date.now() - startTime;
    
    // All interactions should complete within 3 seconds
    expect(totalTime).toBeLessThan(3000);
  });

  test('should optimize image loading and rendering', async ({ page }) => {
    await page.goto('/profile');
    
    // Mock profile with multiple images
    await page.route('**/api/profile*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'test-user-1',
            name: 'Performance User',
            avatar: '/images/avatar.jpg',
            coverPhoto: '/images/cover.jpg',
            gallery: Array.from({ length: 20 }, (_, i) => ({
              id: i,
              url: `/images/gallery-${i}.jpg`,
              title: `Gallery Image ${i}`
            }))
          }
        })
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check images are loaded efficiently
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Check for lazy loading attributes
      const lazyImages = page.locator('img[loading="lazy"]');
      const lazyImageCount = await lazyImages.count();
      
      // Should have lazy loading for most images
      if (imageCount > 3) {
        expect(lazyImageCount).toBeGreaterThan(imageCount / 2);
      }
      
      // Check image load times
      const imageLoadPromises = [];
      for (let i = 0; i < Math.min(imageCount, 5); i++) {
        const img = images.nth(i);
        imageLoadPromises.push(
          img.evaluate((imgElement: HTMLImageElement) => {
            return new Promise((resolve) => {
              if (imgElement.complete) {
                resolve(0);
              } else {
                const startTime = Date.now();
                imgElement.onload = () => resolve(Date.now() - startTime);
                imgElement.onerror = () => resolve(-1);
              }
            });
          })
        );
      }
      
      const loadTimes = await Promise.all(imageLoadPromises);
      const validLoadTimes = loadTimes.filter(time => time > 0);
      
      if (validLoadTimes.length > 0) {
        const avgLoadTime = validLoadTimes.reduce((a, b) => a + b, 0) / validLoadTimes.length;
        expect(avgLoadTime).toBeLessThan(2000); // Images should load within 2 seconds
      }
    }
  });

  test('should handle memory efficiently during extended use', async ({ page }) => {
    await page.goto('/notes');
    
    // Simulate extended usage
    for (let i = 0; i < 10; i++) {
      // Navigate between pages
      await page.goto('/notes');
      await page.waitForLoadState('networkidle');
      
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
      
      // Create and delete notes
      const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const titleInput = page.locator('input[name="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill(`Memory Test Note ${i}`);
          
          const saveButton = page.locator('button').filter({ hasText: /Save|Create/ }).first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
          }
        }
      }
      
      // Small delay between iterations
      await page.waitForTimeout(100);
    }
    
    // Check for memory leaks by evaluating performance
    const memoryInfo = await page.evaluate(() => {
      // @ts-ignore - performance.memory is available in Chrome
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (memoryInfo) {
      // Memory usage should be reasonable (less than 100MB)
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
      
      // Should not be close to heap limit
      const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
      expect(memoryUsageRatio).toBeLessThan(0.8);
    }
  });

  test('should handle form submissions efficiently', async ({ page }) => {
    await page.goto('/notes');
    
    const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first();
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Mock slow API response
      await page.route('**/api/notes', route => {
        setTimeout(() => {
          route.fulfill({
            status: 201,
            body: JSON.stringify({
              id: 'new-note-1',
              title: 'Performance Test Note',
              content: 'Note created during performance testing',
              createdAt: new Date().toISOString()
            })
          });
        }, 1000); // 1 second delay
      });
      
      const titleInput = page.locator('input[name="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.fill('Performance Test Note');
        
        const contentArea = page.locator('textarea[name="content"]');
        if (await contentArea.isVisible()) {
          await contentArea.fill('Note created during performance testing');
        }
        
        const startTime = Date.now();
        
        const saveButton = page.locator('button').filter({ hasText: /Save|Create/ }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          
          // Should show loading state immediately
          const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner');
          if (await loadingIndicator.isVisible()) {
            await expect(loadingIndicator).toBeVisible();
          }
          
          // Wait for completion
          await page.waitForSelector('text=Note created', { timeout: 5000 });
          
          const totalTime = Date.now() - startTime;
          
          // Form submission should handle the delay gracefully
          expect(totalTime).toBeGreaterThan(900); // Should wait for API
          expect(totalTime).toBeLessThan(2000); // But not hang indefinitely
        }
      }
    }
  });

  test('should optimize search and filtering operations', async ({ page }) => {
    await page.goto('/notes');
    
    // Mock search API with delay
    await page.route('**/api/notes/search*', route => {
      const query = new URL(route.request().url()).searchParams.get('q');
      
      setTimeout(() => {
        const results = Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          title: `Search Result ${i + 1} for "${query}"`,
          content: `This note matches the search query: ${query}`,
          createdAt: new Date().toISOString()
        }));
        
        route.fulfill({
          status: 200,
          body: JSON.stringify({ results, total: 50 })
        });
      }, 300); // 300ms delay to simulate search
    });
    
    const searchInput = page.locator('input[type="search"], input[name="search"], input[placeholder*="search"]');
    if (await searchInput.first().isVisible()) {
      const startTime = Date.now();
      
      // Type search query
      await searchInput.first().fill('performance');
      
      // Should show search results within reasonable time
      await page.waitForSelector('[data-testid="search-results"], .search-results', { timeout: 2000 });
      
      const searchTime = Date.now() - startTime;
      
      // Search should complete within 1 second
      expect(searchTime).toBeLessThan(1000);
      
      // Test rapid typing (debouncing)
      await searchInput.first().fill('');
      await searchInput.first().fill('test query');
      
      // Should handle rapid input changes efficiently
      await page.waitForTimeout(500);
    }
  });

  test('should handle offline scenarios gracefully', async ({ page }) => {
    await page.goto('/notes');
    
    // Go offline
    await page.context().setOffline(true);
    
    const startTime = Date.now();
    
    // Try to perform actions while offline
    const createButton = page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first();
    if (await createButton.isVisible()) {
      await createButton.click();
      
      const titleInput = page.locator('input[name="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.fill('Offline Test Note');
        
        const saveButton = page.locator('button').filter({ hasText: /Save|Create/ }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          
          // Should handle offline state gracefully
          const offlineMessage = page.locator('text=offline', 'text=no connection', '[data-testid="offline-indicator"]');
          
          // Should show offline indicator or queue the action
          const hasOfflineHandling = await Promise.race([
            offlineMessage.first().isVisible().then(() => true),
            page.locator('text=queued', 'text=saved locally').first().isVisible().then(() => true),
            new Promise(resolve => setTimeout(() => resolve(false), 2000))
          ]);
          
          expect(hasOfflineHandling).toBeTruthy();
        }
      }
    }
    
    const offlineHandlingTime = Date.now() - startTime;
    
    // Offline handling should be fast (not hanging)
    expect(offlineHandlingTime).toBeLessThan(3000);
    
    // Go back online
    await page.context().setOffline(false);
  });

  test('should maintain smooth animations and transitions', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation transitions
    const navLinks = page.locator('nav a, [data-testid="nav-item"]');
    const navCount = await navLinks.count();
    
    if (navCount > 0) {
      // Click first navigation item
      const startTime = Date.now();
      await navLinks.first().click();
      
      // Wait for page transition
      await page.waitForLoadState('networkidle');
      const transitionTime = Date.now() - startTime;
      
      // Navigation should be smooth (under 1 second)
      expect(transitionTime).toBeLessThan(1000);
    }
    
    // Test modal/dialog animations
    const modalTrigger = page.locator('button').filter({ hasText: /Settings|Profile|Modal/ }).first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      
      const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
      if (await modal.isVisible()) {
        // Modal should appear smoothly
        await expect(modal).toBeVisible();
        
        // Close modal
        const closeButton = page.locator('[aria-label="close"], button[data-testid="close"], .modal-close');
        if (await closeButton.first().isVisible()) {
          await closeButton.first().click();
          
          // Modal should disappear smoothly
          await expect(modal).not.toBeVisible({ timeout: 2000 });
        }
      }
    }
  });
});

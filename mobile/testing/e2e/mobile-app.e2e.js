const { device, expect, element, by, waitFor } = require('detox');

/**
 * 🏗️ Mobile E2E Testing Setup and Configuration
 * Comprehensive end-to-end testing framework for Modulo mobile app
 */

describe('📱 Modulo Mobile App - E2E Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Mobile E2E Tests');
    await device.launchApp({
      permissions: {
        notifications: 'YES',
        location: 'inuse',
        camera: 'YES',
        photos: 'YES'
      },
      languageAndLocale: {
        language: 'en-US',
        locale: 'en-US'
      }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    console.log('🏁 Mobile E2E Tests Completed');
    await device.terminateApp();
  });

  describe('🔐 Authentication Flow', () => {
    it('should display login screen on app launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should show validation errors for empty credentials', async () => {
      await element(by.id('login-button')).tap();
      
      await expect(element(by.text('Email is required'))).toBeVisible();
      await expect(element(by.text('Password is required'))).toBeVisible();
    });

    it('should login successfully with valid credentials', async () => {
      await element(by.id('email-input')).typeText('test@modulo.app');
      await element(by.id('password-input')).typeText('testpassword123');
      await element(by.id('login-button')).tap();
      
      await waitFor(element(by.id('main-screen')))
        .toBeVisible()
        .withTimeout(5000);
      
      await expect(element(by.id('notes-list'))).toBeVisible();
    });

    it('should handle biometric authentication', async () => {
      // Enable biometric login
      await element(by.id('settings-tab')).tap();
      await element(by.id('biometric-toggle')).tap();
      
      // Logout and test biometric login
      await element(by.id('logout-button')).tap();
      await expect(element(by.id('biometric-login-button'))).toBeVisible();
      
      await element(by.id('biometric-login-button')).tap();
      // Simulate successful biometric authentication
      await device.setBiometricEnrollment(true);
      await device.matchBiometric();
      
      await waitFor(element(by.id('main-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('📝 Notes Management', () => {
    beforeEach(async () => {
      // Ensure user is logged in
      await element(by.id('notes-tab')).tap();
    });

    it('should display notes list', async () => {
      await expect(element(by.id('notes-list'))).toBeVisible();
      await expect(element(by.id('create-note-fab'))).toBeVisible();
    });

    it('should create a new note', async () => {
      await element(by.id('create-note-fab')).tap();
      
      await expect(element(by.id('note-editor-screen'))).toBeVisible();
      await element(by.id('note-title-input')).typeText('Test Note Title');
      await element(by.id('note-content-input')).typeText('This is a test note content for mobile E2E testing.');
      
      await element(by.id('save-note-button')).tap();
      
      await waitFor(element(by.id('notes-list')))
        .toBeVisible()
        .withTimeout(3000);
      
      await expect(element(by.text('Test Note Title'))).toBeVisible();
    });

    it('should edit an existing note', async () => {
      // Tap on first note
      await element(by.id('note-item-0')).tap();
      
      await expect(element(by.id('note-editor-screen'))).toBeVisible();
      await element(by.id('note-content-input')).replaceText('Updated note content for E2E testing');
      
      await element(by.id('save-note-button')).tap();
      
      await waitFor(element(by.text('Updated note content for E2E testing')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should delete a note', async () => {
      // Long press on first note to show context menu
      await element(by.id('note-item-0')).longPress();
      
      await expect(element(by.id('note-context-menu'))).toBeVisible();
      await element(by.id('delete-note-option')).tap();
      
      // Confirm deletion
      await element(by.id('confirm-delete-button')).tap();
      
      await waitFor(element(by.text('Test Note Title')))
        .not.toBeVisible()
        .withTimeout(3000);
    });

    it('should search notes', async () => {
      await element(by.id('search-button')).tap();
      await element(by.id('search-input')).typeText('test');
      
      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(2000);
      
      // Verify search results contain test notes
      await expect(element(by.id('search-results')).atIndex(0)).toBeVisible();
    });
  });

  describe('🏷️ Tags and Categories', () => {
    it('should add tags to a note', async () => {
      await element(by.id('create-note-fab')).tap();
      await element(by.id('note-title-input')).typeText('Tagged Note');
      
      await element(by.id('tags-button')).tap();
      await element(by.id('tag-input')).typeText('work');
      await element(by.id('add-tag-button')).tap();
      
      await expect(element(by.text('#work'))).toBeVisible();
      
      await element(by.id('save-note-button')).tap();
    });

    it('should filter notes by category', async () => {
      await element(by.id('categories-button')).tap();
      await element(by.text('Work')).tap();
      
      await waitFor(element(by.id('filtered-notes-list')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('🔄 Synchronization', () => {
    it('should sync notes with server', async () => {
      // Create a note while offline
      await device.setNetworkConnection(false);
      
      await element(by.id('create-note-fab')).tap();
      await element(by.id('note-title-input')).typeText('Offline Note');
      await element(by.id('save-note-button')).tap();
      
      // Verify note is marked as pending sync
      await expect(element(by.id('sync-pending-indicator'))).toBeVisible();
      
      // Go back online and trigger sync
      await device.setNetworkConnection(true);
      await element(by.id('sync-button')).tap();
      
      // Wait for sync completion
      await waitFor(element(by.id('sync-pending-indicator')))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it('should handle conflict resolution', async () => {
      // Simulate conflicting changes
      await element(by.id('note-item-0')).tap();
      await element(by.id('note-content-input')).replaceText('Local changes');
      
      // Trigger sync conflict (mock server response)
      await element(by.id('sync-button')).tap();
      
      // Handle conflict resolution dialog
      await expect(element(by.id('conflict-resolution-dialog'))).toBeVisible();
      await element(by.id('keep-local-changes-button')).tap();
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should load notes list quickly', async () => {
      const startTime = Date.now();
      
      await element(by.id('notes-tab')).tap();
      await waitFor(element(by.id('notes-list'))).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });

    it('should handle large notes list smoothly', async () => {
      // Create multiple notes for performance testing
      for (let i = 0; i < 20; i++) {
        await element(by.id('create-note-fab')).tap();
        await element(by.id('note-title-input')).typeText(`Performance Test Note ${i}`);
        await element(by.id('save-note-button')).tap();
        await waitFor(element(by.id('notes-list'))).toBeVisible().withTimeout(1000);
      }
      
      // Test scrolling performance
      await element(by.id('notes-list')).scroll(1000, 'down');
      await element(by.id('notes-list')).scroll(1000, 'up');
      
      // Verify list is still responsive
      await expect(element(by.id('notes-list'))).toBeVisible();
    });
  });

  describe('🎨 UI/UX Tests', () => {
    it('should support dark mode toggle', async () => {
      await element(by.id('settings-tab')).tap();
      await element(by.id('dark-mode-toggle')).tap();
      
      // Verify dark theme is applied
      await expect(element(by.id('dark-theme-indicator'))).toBeVisible();
      
      // Toggle back to light mode
      await element(by.id('dark-mode-toggle')).tap();
      await expect(element(by.id('light-theme-indicator'))).toBeVisible();
    });

    it('should handle device orientation changes', async () => {
      await device.setOrientation('landscape');
      await expect(element(by.id('notes-list'))).toBeVisible();
      
      await device.setOrientation('portrait');
      await expect(element(by.id('notes-list'))).toBeVisible();
    });

    it('should show loading states appropriately', async () => {
      await element(by.id('sync-button')).tap();
      await expect(element(by.id('loading-indicator'))).toBeVisible();
      
      await waitFor(element(by.id('loading-indicator')))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('🔔 Notifications', () => {
    it('should request notification permissions', async () => {
      await element(by.id('settings-tab')).tap();
      await element(by.id('notifications-toggle')).tap();
      
      // Grant permissions when prompted
      await device.launchApp({
        permissions: { notifications: 'YES' }
      });
      
      await expect(element(by.text('Notifications enabled'))).toBeVisible();
    });

    it('should send reminder notifications', async () => {
      // Create note with reminder
      await element(by.id('create-note-fab')).tap();
      await element(by.id('note-title-input')).typeText('Reminder Note');
      await element(by.id('reminder-button')).tap();
      await element(by.id('reminder-time-picker')).tap();
      await element(by.id('save-note-button')).tap();
      
      // Verify reminder is set
      await expect(element(by.id('reminder-indicator'))).toBeVisible();
    });
  });

  describe('🔒 Security Tests', () => {
    it('should lock app when backgrounded for security timeout', async () => {
      await device.sendToHome();
      await device.launchApp();
      
      // Should show lock screen after timeout
      await expect(element(by.id('app-lock-screen'))).toBeVisible();
    });

    it('should encrypt sensitive data', async () => {
      // Create note with sensitive content
      await element(by.id('create-note-fab')).tap();
      await element(by.id('note-title-input')).typeText('Confidential');
      await element(by.id('note-content-input')).typeText('Sensitive information');
      await element(by.id('encryption-toggle')).tap();
      await element(by.id('save-note-button')).tap();
      
      // Verify encryption indicator
      await expect(element(by.id('encryption-indicator'))).toBeVisible();
    });
  });

  describe('♿ Accessibility Tests', () => {
    it('should support voice over navigation', async () => {
      await device.enableAccessibility();
      
      // Test that elements have proper accessibility labels
      await expect(element(by.id('notes-list'))).toHaveLabel('Notes list');
      await expect(element(by.id('create-note-fab'))).toHaveLabel('Create new note');
    });

    it('should support large text sizes', async () => {
      await device.setPreferredContentSizeCategory('accessibilityExtraExtraExtraLarge');
      
      // Verify UI adapts to large text
      await expect(element(by.id('notes-list'))).toBeVisible();
      await expect(element(by.id('note-title'))).toBeVisible();
    });
  });
});

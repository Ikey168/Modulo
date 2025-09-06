import { test, expect } from '@playwright/test';

test.describe('Core Data Entry Workflows E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user for all tests
    await page.addInitScript(() => {
      window.localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['USER', 'EDITOR'],
        authProvider: 'oidc'
      }));
      window.sessionStorage.setItem('isAuthenticated', 'true');
    });
    
    await page.goto('/');
  });

  test('should complete note creation workflow', async ({ page }) => {
    await page.goto('/notes');
    
    // Create new note
    await page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first().click();
    
    if (await page.locator('input[name="title"]').isVisible()) {
      await page.fill('input[name="title"]', 'Test Note Title');
      await page.fill('textarea[name="content"]', 'This is test note content with detailed information.');
      
      // Add tags if available
      if (await page.locator('input[name="tags"]').isVisible()) {
        await page.fill('input[name="tags"]', 'test, e2e, automation');
      }
      
      // Set priority if available
      if (await page.locator('select[name="priority"]').isVisible()) {
        await page.selectOption('select[name="priority"]', 'high');
      }
      
      // Save note
      await page.locator('button').filter({ hasText: /Save|Create/ }).first().click();
      
      // Verify note created successfully
      await expect(page.locator('text=Note created')).toBeVisible();
      await expect(page.locator('text=Test Note Title')).toBeVisible();
    }
  });

  test('should edit existing note', async ({ page }) => {
    await page.goto('/notes');
    
    // Click on existing note or create one first
    if (await page.locator('[data-testid="note-item"]').first().isVisible()) {
      await page.locator('[data-testid="note-item"]').first().click();
    } else {
      // Create a note first
      await page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first().click();
      await page.fill('input[name="title"]', 'Note to Edit');
      await page.fill('textarea[name="content"]', 'Original content');
      await page.locator('button').filter({ hasText: /Save|Create/ }).first().click();
    }
    
    // Edit the note
    if (await page.locator('button').filter({ hasText: /Edit/ }).isVisible()) {
      await page.locator('button').filter({ hasText: /Edit/ }).first().click();
      
      await page.fill('input[name="title"]', 'Updated Note Title');
      await page.fill('textarea[name="content"]', 'Updated content with modifications');
      
      await page.locator('button').filter({ hasText: /Save|Update/ }).first().click();
      
      // Verify changes saved
      await expect(page.locator('text=Note updated')).toBeVisible();
      await expect(page.locator('text=Updated Note Title')).toBeVisible();
    }
  });

  test('should handle contract creation workflow', async ({ page }) => {
    await page.goto('/contracts');
    
    // Create new contract
    await page.locator('button').filter({ hasText: /New Contract|Create/ }).first().click();
    
    if (await page.locator('input[name="contractName"]').isVisible()) {
      await page.fill('input[name="contractName"]', 'Test Smart Contract');
      await page.fill('textarea[name="description"]', 'Test contract for E2E testing');
      
      // Set contract parameters
      if (await page.locator('input[name="initialSupply"]').isVisible()) {
        await page.fill('input[name="initialSupply"]', '1000000');
      }
      
      if (await page.locator('select[name="contractType"]').isVisible()) {
        await page.selectOption('select[name="contractType"]', 'ERC20');
      }
      
      // Deploy contract (mock the deployment)
      await page.route('**/api/contracts/deploy', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            contractAddress: '0x1234567890123456789012345678901234567890',
            transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            gasUsed: '2500000'
          })
        });
      });
      
      await page.locator('button').filter({ hasText: /Deploy|Create/ }).first().click();
      
      // Verify deployment success
      await expect(page.locator('text=Contract deployed successfully')).toBeVisible();
      await expect(page.locator('text=0x1234567890123456789012345678901234567890')).toBeVisible();
    }
  });

  test('should complete task management workflow', async ({ page }) => {
    await page.goto('/tasks');
    
    // Create new task
    await page.locator('button').filter({ hasText: /New Task|Create|Add/ }).first().click();
    
    if (await page.locator('input[name="taskTitle"]').isVisible()) {
      await page.fill('input[name="taskTitle"]', 'E2E Test Task');
      await page.fill('textarea[name="description"]', 'Task created during E2E testing');
      
      // Set due date
      if (await page.locator('input[type="date"]').isVisible()) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await page.fill('input[type="date"]', dateStr);
      }
      
      // Set priority
      if (await page.locator('select[name="priority"]').isVisible()) {
        await page.selectOption('select[name="priority"]', 'medium');
      }
      
      // Assign to self if available
      if (await page.locator('select[name="assignee"]').isVisible()) {
        await page.selectOption('select[name="assignee"]', 'test-user-1');
      }
      
      await page.locator('button').filter({ hasText: /Save|Create/ }).first().click();
      
      // Verify task created
      await expect(page.locator('text=Task created')).toBeVisible();
      await expect(page.locator('text=E2E Test Task')).toBeVisible();
    }
    
    // Complete the task
    if (await page.locator('[data-testid="task-checkbox"]').first().isVisible()) {
      await page.locator('[data-testid="task-checkbox"]').first().check();
      
      // Verify task marked as complete
      await expect(page.locator('[data-testid="task-item"]').first()).toHaveClass(/completed/);
    }
  });

  test('should handle file upload workflow', async ({ page }) => {
    await page.goto('/notes');
    
    // Create note with file attachment
    await page.locator('button').filter({ hasText: /New Note|Create|Add/ }).first().click();
    
    if (await page.locator('input[name="title"]').isVisible()) {
      await page.fill('input[name="title"]', 'Note with Attachment');
      await page.fill('textarea[name="content"]', 'This note includes file attachments.');
      
      // Upload file if file input is available
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        const buffer = Buffer.from('test file content');
        await fileInput.setInputFiles({
          name: 'test-document.txt',
          mimeType: 'text/plain',
          buffer,
        });
        
        // Verify upload progress
        await expect(page.locator('text=Uploading')).toBeVisible();
        await expect(page.locator('text=Upload complete')).toBeVisible();
      }
      
      await page.locator('button').filter({ hasText: /Save|Create/ }).first().click();
      
      // Verify note with attachment created
      await expect(page.locator('text=Note created')).toBeVisible();
      await expect(page.locator('text=test-document.txt')).toBeVisible();
    }
  });

  test('should handle bulk data operations', async ({ page }) => {
    await page.goto('/notes');
    
    // Select multiple items for bulk operations
    if (await page.locator('[data-testid="bulk-select-checkbox"]').first().isVisible()) {
      await page.locator('[data-testid="bulk-select-checkbox"]').first().check();
      await page.locator('[data-testid="bulk-select-checkbox"]').nth(1).check();
      
      // Perform bulk action
      await page.locator('button').filter({ hasText: /Bulk Actions|Actions/ }).first().click();
      await page.locator('button').filter({ hasText: /Delete|Archive/ }).first().click();
      
      // Confirm bulk action
      await page.locator('button').filter({ hasText: /Confirm|Yes/ }).first().click();
      
      // Verify bulk action completed
      await expect(page.locator('text=Items processed')).toBeVisible();
    }
  });

  test('should handle data export workflow', async ({ page }) => {
    await page.goto('/notes');
    
    // Initiate export
    if (await page.locator('button').filter({ hasText: /Export|Download/ }).isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await page.locator('button').filter({ hasText: /Export|Download/ }).first().click();
      
      // Select export format if available
      if (await page.locator('select[name="exportFormat"]').isVisible()) {
        await page.selectOption('select[name="exportFormat"]', 'json');
        await page.locator('button').filter({ hasText: /Export|Download/ }).first().click();
      }
      
      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/notes.*\.(json|csv|pdf)$/);
    }
  });
});

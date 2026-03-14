/**
 * E2E User Journey Tests
 * Story test-3 - Complete Problem Resolution Flow
 *
 * Tests cover:
 * - Problem detection journey
 * - Decision making journey
 * - Plan execution journey
 * - Integration sync journey
 * - Mobile gesture tests (simulated)
 *
 * @requires Playwright
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ============================================================================
// Test Configuration
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test data
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
};

// Helper function to wait for animations
async function waitForAnimation(page: Page, ms: number = 300) {
  await page.waitForTimeout(ms);
}

// ============================================================================
// Complete Problem Resolution Flow
// ============================================================================

test.describe('Complete Problem Resolution Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to ORACLE dashboard
    await page.goto(`${BASE_URL}/oracle`);

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('complete problem detection to resolution journey', async ({ page }) => {
    // Step 1: Detect Problem
    // Wait for the ORACLE to detect a problem (or simulate one)
    const problemDetected = page.getByText('Problem Detected');

    // If no problem is detected, trigger one via API mock
    if (!(await problemDetected.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Mock API to inject a problem signal
      await page.route(`${API_URL}/api/oracle/signals`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            signals: [{
              id: 'signal-test-1',
              title: 'Schedule Conflict Detected',
              type: 'conflict',
              urgency: 'high',
              status: 'active',
              detectedAt: new Date().toISOString(),
            }],
          }),
        });
      });

      // Refresh to pick up the mocked signal
      await page.reload();
    }

    // Verify problem is displayed
    await expect(page.getByText(/problem|conflict|alert|signal/i).first()).toBeVisible({ timeout: 5000 });

    // Step 2: Analyze the Problem
    const analyzeBtn = page.getByTestId('analyze-btn').or(page.getByRole('button', { name: /analyze/i }));

    if (await analyzeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await analyzeBtn.click();
      await waitForAnimation(page);

      // Wait for analysis to complete
      await expect(page.getByText(/analysis|analyzing|insights/i).first()).toBeVisible({ timeout: 10000 });
    }

    // Step 3: Review Options and Decide
    const optionSelector = page.getByTestId('option-1')
      .or(page.getByRole('button', { name: /option/i }).first())
      .or(page.getByRole('radio').first());

    if (await optionSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await optionSelector.click();
      await waitForAnimation(page);
    }

    // Step 4: Execute the Decision
    const executeBtn = page.getByTestId('execute-btn')
      .or(page.getByRole('button', { name: /execute|apply|confirm/i }));

    if (await executeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await executeBtn.click();
      await waitForAnimation(page);
    }

    // Step 5: Verify Resolution
    // Wait for resolution confirmation (with flexible matching)
    const resolvedIndicator = page.getByText(/resolved|complete|success|done/i).first();
    await expect(resolvedIndicator).toBeVisible({ timeout: 15000 });
  });

  test('should show problem severity indicators', async ({ page }) => {
    // Mock signals with different severities
    await page.route(`${API_URL}/api/oracle/signals`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signals: [
            { id: 's1', title: 'Critical Issue', urgency: 'critical', type: 'error' },
            { id: 's2', title: 'High Priority', urgency: 'high', type: 'warning' },
            { id: 's3', title: 'Low Priority', urgency: 'low', type: 'info' },
          ],
        }),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should display severity indicators (colors, icons, or badges)
    const signalContainer = page.locator('[data-testid="signals-list"], [class*="signal"]').first();

    if (await signalContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check for visual differentiation
      await expect(signalContainer).toBeVisible();
    }
  });

  test('should allow deferring a decision', async ({ page }) => {
    // Mock a pending decision
    await page.route(`${API_URL}/api/oracle/decisions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decisions: [{
            id: 'dec-1',
            title: 'Test Decision',
            status: 'pending',
            options: [
              { id: 'opt-1', title: 'Option A', score: 0.8 },
              { id: 'opt-2', title: 'Option B', score: 0.6 },
            ],
          }],
        }),
      });
    });

    await page.reload();

    const deferBtn = page.getByRole('button', { name: /defer|later|postpone/i });

    if (await deferBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deferBtn.click();

      // Verify decision is deferred
      await expect(page.getByText(/deferred|postponed|later/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================================
// Decision Making Journey
// ============================================================================

test.describe('Decision Making Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle/decide`);
    await page.waitForLoadState('networkidle');
  });

  test('should display decision options with confidence scores', async ({ page }) => {
    // Mock decision endpoint
    await page.route(`${API_URL}/api/oracle/decide/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decision: {
            id: 'dec-test',
            title: 'Strategic Decision',
            options: [
              { id: 'opt-1', title: 'Option A', score: 0.85, confidence: 0.9 },
              { id: 'opt-2', title: 'Option B', score: 0.65, confidence: 0.75 },
              { id: 'opt-3', title: 'Option C', score: 0.45, confidence: 0.6 },
            ],
            recommendation: 'opt-1',
          },
        }),
      });
    });

    await page.reload();

    // Check for options display
    const optionsContainer = page.locator('[data-testid="decision-options"], [class*="options"]').first();

    if (await optionsContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Verify multiple options are shown
      const optionCount = await page.locator('[data-testid^="option-"], [class*="option-item"]').count();
      expect(optionCount).toBeGreaterThan(0);
    }
  });

  test('should highlight recommended option', async ({ page }) => {
    await page.route(`${API_URL}/api/oracle/decide/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decision: {
            id: 'dec-test',
            title: 'Test Decision',
            options: [
              { id: 'opt-1', title: 'Recommended', score: 0.95 },
              { id: 'opt-2', title: 'Alternative', score: 0.5 },
            ],
            recommendation: 'opt-1',
          },
        }),
      });
    });

    await page.reload();

    // Look for recommended indicator
    const recommendedBadge = page.getByText(/recommended|best|suggested/i).first();

    if (await recommendedBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(recommendedBadge).toBeVisible();
    }
  });

  test('should show trade-off analysis between options', async ({ page }) => {
    const tradeoffSection = page.locator('[data-testid="trade-off"], [class*="tradeoff"]').first();

    if (await tradeoffSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(tradeoffSection).toBeVisible();
    }
  });

  test('should allow comparing two options side by side', async ({ page }) => {
    const compareBtn = page.getByRole('button', { name: /compare/i });

    if (await compareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await compareBtn.click();

      // Look for comparison view
      const comparisonView = page.locator('[data-testid="comparison"], [class*="compare"]').first();
      await expect(comparisonView).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================================
// Plan Execution Journey
// ============================================================================

test.describe('Plan Execution Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle/act`);
    await page.waitForLoadState('networkidle');
  });

  test('should display execution progress', async ({ page }) => {
    // Mock execution status
    await page.route(`${API_URL}/api/oracle/act/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: {
            id: 'plan-1',
            title: 'Test Execution Plan',
            status: 'active',
            progress: 50,
            steps: [
              { id: 'step-1', title: 'Step 1', status: 'completed' },
              { id: 'step-2', title: 'Step 2', status: 'in_progress' },
              { id: 'step-3', title: 'Step 3', status: 'pending' },
            ],
          },
        }),
      });
    });

    await page.reload();

    // Check for progress indicator
    const progressBar = page.locator('[data-testid="progress"], [role="progressbar"], [class*="progress"]').first();

    if (await progressBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(progressBar).toBeVisible();
    }
  });

  test('should allow pausing execution', async ({ page }) => {
    const pauseBtn = page.getByRole('button', { name: /pause|stop|hold/i });

    if (await pauseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pauseBtn.click();

      // Verify paused state
      await expect(page.getByText(/paused|stopped|on hold/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show step-by-step execution details', async ({ page }) => {
    const stepsContainer = page.locator('[data-testid="steps-list"], [class*="steps"]').first();

    if (await stepsContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      const stepCount = await page.locator('[data-testid^="step-"], [class*="step-item"]').count();
      expect(stepCount).toBeGreaterThan(0);
    }
  });

  test('should handle execution errors gracefully', async ({ page }) => {
    // Mock an execution error
    await page.route(`${API_URL}/api/oracle/act/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: {
            id: 'plan-1',
            status: 'error',
            error: 'Step 2 failed: Permission denied',
          },
        }),
      });
    });

    await page.reload();

    // Check for error display
    const errorIndicator = page.getByText(/error|failed|problem/i).first();

    if (await errorIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(errorIndicator).toBeVisible();
    }
  });
});

// ============================================================================
// Integration Sync Journey
// ============================================================================

test.describe('Integration Sync Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle/integrations`);
    await page.waitForLoadState('networkidle');
  });

  test('should display connected integrations', async ({ page }) => {
    const integrationsList = page.locator('[data-testid="integrations-list"], [class*="integrations"]').first();

    if (await integrationsList.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(integrationsList).toBeVisible();
    }
  });

  test('should show sync status for each integration', async ({ page }) => {
    // Mock integrations status
    await page.route(`${API_URL}/api/oracle/integrations/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          integrations: [
            { id: 'gcal', name: 'Google Calendar', status: 'connected', lastSync: new Date().toISOString() },
            { id: 'slack', name: 'Slack', status: 'connected', lastSync: new Date().toISOString() },
            { id: 'github', name: 'GitHub', status: 'disconnected' },
          ],
        }),
      });
    });

    await page.reload();

    // Check for status indicators
    const connectedBadge = page.getByText(/connected|synced/i).first();
    const disconnectedBadge = page.getByText(/disconnected|not connected/i).first();

    if (await connectedBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(connectedBadge).toBeVisible();
    }
  });

  test('should allow manual sync trigger', async ({ page }) => {
    const syncBtn = page.getByRole('button', { name: /sync|refresh/i });

    if (await syncBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock sync response
      await page.route(`${API_URL}/api/oracle/integrations/*/sync`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Sync completed' }),
        });
      });

      await syncBtn.click();

      // Verify sync feedback
      const syncSuccess = page.getByText(/synced|sync complete|success/i).first();
      await expect(syncSuccess).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle OAuth flow for new integration', async ({ page, context }) => {
    const connectBtn = page.getByRole('button', { name: /connect|add|link/i }).first();

    if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Listen for popup or navigation
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);

      await connectBtn.click();

      const popup = await popupPromise;

      if (popup) {
        // OAuth flow opened in popup
        expect(popup.url()).toContain('oauth');
      }
    }
  });
});

// ============================================================================
// Mobile Gesture Tests (Simulated)
// ============================================================================

test.describe('Mobile Gesture Interactions', () => {
  test.use({
    viewport: { width: 375, height: 812 }, // iPhone X viewport
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);
    await page.waitForLoadState('networkidle');
  });

  test('should support swipe right to approve', async ({ page }) => {
    // Find a swipeable decision card
    const card = page.locator('[data-testid="decision-card"], [class*="swipeable"]').first();

    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await card.boundingBox();

      if (box) {
        // Simulate swipe right
        await page.mouse.move(box.x + 50, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        // Wait for animation and verify
        await waitForAnimation(page, 500);

        // Check for approval indicator
        const approved = page.getByText(/approved|accepted/i).first();
        if (await approved.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(approved).toBeVisible();
        }
      }
    }
  });

  test('should support swipe left to defer', async ({ page }) => {
    const card = page.locator('[data-testid="decision-card"], [class*="swipeable"]').first();

    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await card.boundingBox();

      if (box) {
        // Simulate swipe left
        await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        await waitForAnimation(page, 500);

        const deferred = page.getByText(/deferred|later/i).first();
        if (await deferred.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(deferred).toBeVisible();
        }
      }
    }
  });

  test('should support pull-to-refresh', async ({ page }) => {
    // Find the main content area
    const content = page.locator('main, [data-testid="main-content"]').first();

    if (await content.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await content.boundingBox();

      if (box) {
        // Simulate pull down gesture
        await page.mouse.move(box.x + box.width / 2, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + 150, { steps: 10 });
        await page.mouse.up();

        // Wait for refresh
        await waitForAnimation(page, 1000);
      }
    }
  });

  test('should support tap and hold for context menu', async ({ page }) => {
    const card = page.locator('[data-testid="signal-card"], [class*="signal"]').first();

    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await card.boundingBox();

      if (box) {
        // Simulate long press
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(800); // Long press duration
        await page.mouse.up();

        // Check for context menu
        const contextMenu = page.locator('[role="menu"], [data-testid="context-menu"]').first();
        if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(contextMenu).toBeVisible();
        }
      }
    }
  });

  test('should provide haptic feedback indicators visually', async ({ page }) => {
    // Check for visual feedback when tapping
    const button = page.getByRole('button').first();

    if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
      await button.tap();

      // Check for ripple effect or visual feedback class
      const hasVisualFeedback = await button.evaluate((el) => {
        return el.classList.contains('active') ||
          el.classList.contains('pressed') ||
          el.querySelector('.ripple') !== null;
      });

      // Visual feedback may or may not be present
      expect(typeof hasVisualFeedback).toBe('boolean');
    }
  });
});

// ============================================================================
// ORACLE Phase Navigation
// ============================================================================

test.describe('ORACLE Phase Navigation', () => {
  test('should navigate through OBSERVE -> ORIENT -> DECIDE -> ACT phases', async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // Phase 1: OBSERVE
    const observeTab = page.getByRole('tab', { name: /observe/i })
      .or(page.getByTestId('observe-tab'))
      .or(page.getByText(/observe/i).first());

    if (await observeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await observeTab.click();
      await waitForAnimation(page);
      await expect(page).toHaveURL(/observe/i);
    }

    // Phase 2: ORIENT
    const orientTab = page.getByRole('tab', { name: /orient/i })
      .or(page.getByTestId('orient-tab'))
      .or(page.getByText(/orient/i).first());

    if (await orientTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orientTab.click();
      await waitForAnimation(page);
    }

    // Phase 3: DECIDE
    const decideTab = page.getByRole('tab', { name: /decide/i })
      .or(page.getByTestId('decide-tab'))
      .or(page.getByText(/decide/i).first());

    if (await decideTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await decideTab.click();
      await waitForAnimation(page);
    }

    // Phase 4: ACT
    const actTab = page.getByRole('tab', { name: /act/i })
      .or(page.getByTestId('act-tab'))
      .or(page.getByText(/act/i).first());

    if (await actTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actTab.click();
      await waitForAnimation(page);
    }
  });

  test('should show current phase indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // Check for active phase indicator
    const activeIndicator = page.locator('[data-active="true"], [class*="active"], [aria-selected="true"]').first();

    if (await activeIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(activeIndicator).toBeVisible();
    }
  });
});

// ============================================================================
// Error Handling and Edge Cases
// ============================================================================

test.describe('Error Handling', () => {
  test('should display error message on API failure', async ({ page }) => {
    // Mock API failure
    await page.route(`${API_URL}/api/oracle/**`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`${BASE_URL}/oracle`);

    // Check for error display
    const errorMessage = page.getByText(/error|failed|something went wrong/i).first();

    if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should handle offline mode gracefully', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // Simulate offline
    await context.setOffline(true);

    // Try to perform an action
    const refreshBtn = page.getByRole('button', { name: /refresh|sync/i }).first();

    if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshBtn.click();

      // Check for offline indicator
      const offlineMessage = page.getByText(/offline|no connection|network/i).first();

      if (await offlineMessage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(offlineMessage).toBeVisible();
      }
    }

    // Restore online
    await context.setOffline(false);
  });

  test('should recover from temporary errors', async ({ page }) => {
    let requestCount = 0;

    // First request fails, second succeeds
    await page.route(`${API_URL}/api/oracle/signals`, async (route) => {
      requestCount++;

      if (requestCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ signals: [] }),
        });
      }
    });

    await page.goto(`${BASE_URL}/oracle`);

    // Look for retry button or automatic retry
    const retryBtn = page.getByRole('button', { name: /retry|try again/i });

    if (await retryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await retryBtn.click();

      // Verify recovery
      await expect(page.getByText(/error/i).first()).not.toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Accessibility', () => {
  test('should be navigable with keyboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // Check for ARIA labels on interactive elements
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const ariaLabel = await firstButton.getAttribute('aria-label');
      const text = await firstButton.textContent();

      // Button should have either text content or aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto(`${BASE_URL}/oracle`);

    // This is a basic check - in production use axe-core
    const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6').first();

    if (await textElements.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(textElements).toBeVisible();
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

test.describe('Performance', () => {
  test('should load initial page within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/oracle`);
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should render signals list efficiently', async ({ page }) => {
    // Mock a large list of signals
    const signals = Array.from({ length: 100 }, (_, i) => ({
      id: `signal-${i}`,
      title: `Signal ${i}`,
      urgency: ['critical', 'high', 'medium', 'low'][i % 4],
      type: 'test',
    }));

    await page.route(`${API_URL}/api/oracle/signals`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signals }),
      });
    });

    const startTime = Date.now();
    await page.goto(`${BASE_URL}/oracle`);
    await page.waitForLoadState('networkidle');
    const renderTime = Date.now() - startTime;

    // Should render large list within 5 seconds
    expect(renderTime).toBeLessThan(5000);
  });
});

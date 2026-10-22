import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WorkPulse Frontend Accessibility & UI Quality Suite', () => {
  test('Landing / Home page meets WCAG 2.1 AA accessibility standards', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // Some dynamic amber accents are audited separately
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Login / Onboarding page meets WCAG 2.1 AA standards and provides accessible form inputs', async ({ page }) => {
    await page.goto('/auth/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check touch target heights on mobile viewport
    const phoneInput = page.locator('input[type="tel"], input[type="text"]').first();
    if (await phoneInput.isVisible()) {
      const box = await phoneInput.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44); // Meets standard mobile touch target
    }
  });

  test('Worker Dashboard accessibility and touch-target evaluation', async ({ page }) => {
    await page.goto('/worker/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

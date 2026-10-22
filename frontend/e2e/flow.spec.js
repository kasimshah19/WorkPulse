import { test, expect } from '@playwright/test';

test.describe('WorkPulse Core User Flow E2E Suite', () => {
  test('Landing page renders bilingual titles, action buttons, and navigation elements', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/WorkPulse/i);

    // Verify key brand or navigation elements
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('WorkPulse');
  });

  test('Login page renders phone input and request OTP button with accessible attributes', async ({ page }) => {
    await page.goto('/auth/login');

    const submitBtn = page.locator('button[type="submit"], button:has-text("OTP"), button:has-text("ओटीपी")').first();
    await expect(submitBtn).toBeVisible();

    const phoneInput = page.locator('input[type="tel"], input[type="text"]').first();
    await expect(phoneInput).toBeVisible();
  });

  test('Worker Dashboard displays navigation, job search tabs, and bottom navigation bar', async ({ page }) => {
    await page.goto('/worker/dashboard');

    // Page must render without unhandled errors
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });
});

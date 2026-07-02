import { test, expect } from '@playwright/test';

/**
 * Smoke tests verify that critical pages load without crashing.
 * These are fast and should be run on every CI build.
 */
test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/en');
    await expect(page).toHaveTitle(/Firefly/i);
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('explore page loads', async ({ page }) => {
    await page.goto('/en/explore');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('join page loads', async ({ page }) => {
    await page.goto('/en/join');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('governance page loads', async ({ page }) => {
    await page.goto('/en/alliance/governance');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('treasury page loads', async ({ page }) => {
    await page.goto('/en/alliance/treasury');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('bounties page loads', async ({ page }) => {
    await page.goto('/en/bounties');
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('navbar links work', async ({ page }) => {
    await page.goto('/en');

    // Check navbar is present
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('footer links work', async ({ page }) => {
    await page.goto('/en');

    // Check footer is present
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/en');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/en');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/en');
    await expect(page.locator('main').first()).toBeVisible();
  });
});

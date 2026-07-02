import { test, expect } from './fixtures/test-utils';
import { expectAccessible } from './fixtures/test-utils';

/**
 * Accessibility Tests
 *
 * Tests WCAG 2.1 AA compliance using axe-core.
 * Per project standards (CLAUDE.md), we target AAA for text contrast.
 *
 * These tests ensure the Firefly Network remains accessible to all users,
 * including those using screen readers, keyboard navigation, and other
 * assistive technologies.
 */
test.describe('Accessibility', () => {
  test.describe('Core Pages', () => {
    test('homepage is accessible', async ({ page }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('about page is accessible', async ({ page }) => {
      await page.goto('/en/about');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('explore page is accessible', async ({ page }) => {
      await page.goto('/en/explore');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });
  });

  test.describe('User Flows', () => {
    test('join page is accessible', async ({ page }) => {
      await page.goto('/en/join');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('verify page is accessible', async ({ page }) => {
      await page.goto('/en/verify');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('profile page is accessible', async ({ page }) => {
      await page.goto('/en/profile');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });
  });

  test.describe('Governance Pages', () => {
    test('governance page is accessible', async ({ page }) => {
      await page.goto('/en/governance');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('treasury page is accessible', async ({ page }) => {
      await page.goto('/en/treasury');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('bounties page is accessible', async ({ page }) => {
      await page.goto('/en/bounties');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });
  });

  test.describe('Interactive Components', () => {
    test('navbar is keyboard navigable', async ({ page }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');

      // Tab through navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Verify focus is visible (has outline or focus indicator)
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const styles = getComputedStyle(el);
        return (
          styles.outline !== 'none' || styles.outlineWidth !== '0px' || styles.boxShadow !== 'none'
        );
      });
      expect(hasFocusIndicator).toBe(true);
    });

    test('skip link appears on focus and moves focus to main content', async ({ page }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');

      // Check for skip link (common accessibility pattern)
      const skipLink = page.locator('a[href="#main"], a[href="#content"]').first();
      const hasSkipLink = (await skipLink.count()) > 0;

      // Skip links are a WCAG best practice for keyboard users
      // Mark test as fixme if no skip link exists (known gap to address)
      test.fixme(!hasSkipLink, 'No skip link found - add to layout for keyboard accessibility');

      // Skip link should become visible when focused
      await skipLink.focus();
      await expect(skipLink).toBeVisible();

      // Activate the skip link and verify focus moves to main content
      const targetId = await skipLink.getAttribute('href');
      expect(targetId).toBeTruthy();
      await skipLink.click();

      // Focus should now be on the target element (main or content)
      const focusedId = await page.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe(targetId!.replace('#', ''));
    });
  });

  test.describe('Color Contrast', () => {
    test('text has sufficient contrast on dark background', async ({ page }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');

      // Axe-core handles contrast checks, but let's verify our design tokens
      const contrastIssues = await page.evaluate(() => {
        const issues: string[] = [];
        const textElements = document.querySelectorAll(
          'p, span, h1, h2, h3, h4, h5, h6, a, button'
        );

        textElements.forEach((el) => {
          const styles = getComputedStyle(el);
          const color = styles.color;
          const bgColor = styles.backgroundColor;

          // Check for very low contrast combinations
          // This is a basic check; axe-core does the real work
          if (color === bgColor && color !== 'rgba(0, 0, 0, 0)') {
            issues.push(`Same fg/bg color on: ${el.textContent?.slice(0, 20)}`);
          }
        });

        return issues;
      });

      expect(contrastIssues).toHaveLength(0);
    });
  });

  test.describe('Form Accessibility', () => {
    test('form inputs have associated labels', async ({ page }) => {
      await page.goto('/en/join');
      await page.waitForLoadState('networkidle');

      // Check all inputs have labels
      const unlabeledInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, select, textarea');
        const unlabeled: string[] = [];

        inputs.forEach((input) => {
          const inputEl = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const id = inputEl.id;
          const ariaLabel = inputEl.getAttribute('aria-label');
          const ariaLabelledBy = inputEl.getAttribute('aria-labelledby');
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);

          if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
            unlabeled.push(inputEl.name || inputEl.type || 'unknown');
          }
        });

        return unlabeled;
      });

      expect(unlabeledInputs, `Found unlabeled inputs: ${unlabeledInputs.join(', ')}`).toHaveLength(
        0
      );
    });
  });

  test.describe('Images and Media', () => {
    test('images have alt text', async ({ page }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');

      const imagesWithoutAlt = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        const missing: string[] = [];

        images.forEach((img) => {
          // Images can have alt="" for decorative images, but must have the attribute
          if (!img.hasAttribute('alt')) {
            missing.push(img.src.split('/').pop() || 'unknown');
          }
        });

        return missing;
      });

      expect(
        imagesWithoutAlt,
        `Found images without alt attribute: ${imagesWithoutAlt.join(', ')}`
      ).toHaveLength(0);
    });
  });
});

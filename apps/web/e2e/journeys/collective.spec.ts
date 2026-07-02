import { test, expect } from '../fixtures/wallet';

/**
 * Active-collectives journey — discover a collective on Explore and open its detail page.
 *
 * Flow: Explore (server-rendered "Active collectives" rail) → click a collective card →
 * collective detail page (mission, reputation, governance rules).
 *
 * Everything here is server-rendered from seed data (no wallet, no chain write), so it runs
 * end-to-end against `next dev` — the detail route's id is prebuilt via generateStaticParams.
 */
test.describe('Active collectives', () => {
  test('clicking a collective on Explore opens its detail page', async ({ page }) => {
    await page.goto('/en/explore');
    await page.waitForLoadState('networkidle');

    // The "Active collectives" rail is server-rendered; the seed collective is a clickable card.
    const card = page.getByRole('button', { name: /Truth Seekers/ });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/en\/collective\/seed-collective-001\/?$/);

    // Detail page renders the name, mission, and governance section.
    await expect(page.getByRole('heading', { name: 'Truth Seekers', level: 1 })).toBeVisible();
    await expect(
      page.getByText('To illuminate truth through collaborative verification.')
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible();
    await expect(page.getByText('By member vote')).toBeVisible();
  });

  test('an unknown collective id shows the not-found state', async ({ page }) => {
    // '_' is a prebuilt sentinel id that resolves to no collective.
    await page.goto('/en/collective/_');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Collective Not Found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Stories' })).toBeVisible();
  });
});

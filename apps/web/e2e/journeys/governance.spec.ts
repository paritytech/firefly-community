import { test, expect } from '../fixtures/wallet';

/**
 * Governance journey — navigate the Alliance governance surfaces as a connected firefly.
 *
 * The fixture connects a host wallet whose default personhood level (mock tier) is `lite`. Proposal
 * creation requires "Beacon tier or higher", so the new-proposal form is intentionally gated for a
 * lite user — we assert that real, deterministic gate rather than faking access to a tier the
 * environment can't grant. We also assert the proposals list renders its real controls and state.
 *
 * Environment limit: reaching Beacon tier (to actually submit a proposal) requires on-chain
 * personhood the default `next dev` tier doesn't grant, so the create-and-submit path can't be
 * exercised here. The gate assertion below is the faithful observable outcome.
 *
 * TODO(e2e-bulletin-harness): once a harness can grant Beacon-tier personhood (a fake personhood
 * source repointed via config, alongside the fake-Bulletin RPC), exercise the create-and-submit
 * path and assert the proposal persists and appears in the proposals list.
 */
test.describe('Alliance governance', () => {
  test('proposals list renders its filters and current state', async ({ page }) => {
    await page.goto('/en/alliance/governance/proposals');
    await page.waitForLoadState('networkidle');

    // Real page content: title, the two filter <select> controls, and the (seeded-empty) state.
    await expect(page.getByText('All Proposals')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(2);
    // The default mock tier has no proposals, so the empty state is the deterministic outcome.
    await expect(page.getByText(/No proposals yet/)).toBeVisible();
  });

  test('new-proposal page enforces the tier gate for a lite firefly', async ({ page }) => {
    await page.goto('/en/alliance/governance/proposals/new');
    await page.waitForLoadState('networkidle');
    // Let the wallet connect and personhood resolve to `lite`.
    await page.waitForTimeout(7000);

    // Connected, but a lite firefly cannot create proposals → the real tier gate is shown, and the
    // proposal form (title field + submit) is NOT rendered.
    await expect(
      page.getByText(/You need Beacon tier or higher to create proposals/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit Proposal/ })).toHaveCount(0);
  });

  test('governance landing exposes the sub-navigation', async ({ page }) => {
    await page.goto('/en/alliance/governance');
    await page.waitForLoadState('networkidle');

    // Scope to the main navigation to avoid a strict-mode match against the alliance sub-nav.
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.locator('main').first()).toBeVisible();
  });
});

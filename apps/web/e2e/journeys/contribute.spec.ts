import { test, expect } from '../fixtures/wallet';
import { fillIlluminateForm } from '../fixtures/test-utils';

/**
 * Contribute-to-bounty journey — discover a funded campaign and contribute evidence to it.
 *
 * Flow: Bounties list (seeded campaign) → campaign detail → "Illuminate" CTA → connected Illuminate
 * modal (pre-scoped to the campaign) → fill an observation → submission fires.
 *
 * Environment limit: the contribution illuminate, like a normal illuminate, writes through the
 * fail-closed host preimage API (see lib/host/bulletin-storage) with no real host signer here, so
 * the write surfaces its error inline (role="alert") rather than completing. We assert that error
 * as the deterministic proof the gated submit executed the full path; the on-chain write and
 * campaign-deliverable update require a real host and are covered by service unit tests.
 * TODO(e2e-host-harness): when a fake host-preimage harness lands, assert the real end state —
 * success and the contribution attached to the campaign deliverable.
 */
test.describe('Bounties discovery', () => {
  test('lists the seeded funded campaign and links to its detail page', async ({ page }) => {
    await page.goto('/en/bounties');
    await page.waitForLoadState('networkidle');

    // Seeded campaign is server-rendered.
    await expect(page.getByText('Identify funding sources for the media network')).toBeVisible();
    await expect(page.getByText('Efecto Cocuyo').first()).toBeVisible();

    // It links to the seeded campaign detail page.
    const link = page.locator('main a[href*="/campaign/seed-campaign-001"]').first();
    await expect(link).toBeVisible();
  });
});

test.describe('Contribute evidence to a campaign', () => {
  test('opens the campaign Illuminate CTA and fires a contribution submission', async ({
    page,
  }) => {
    await page.goto('/en/campaign/seed-campaign-001');
    await page.waitForLoadState('networkidle');

    // Campaign detail renders the seeded brief and the contribute CTA.
    await expect(
      page.getByText(/We are looking for documented evidence about the funding sources/)
    ).toBeVisible();

    // The "Illuminate" CTA opens the universal modal pre-scoped to this campaign.
    await page.getByRole('button', { name: 'Illuminate', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Illuminate' });
    await expect(dialog).toBeVisible();

    // Wait out the connect retry loop: the photo upload is disabled={!isConnected}, so its
    // enabling proves the host wallet connected.
    await expect(dialog.locator('input[type="file"]').first()).toBeEnabled({ timeout: 15000 });

    await fillIlluminateForm(
      dialog,
      'Public procurement records show advertising contracts between state entities and several of the named outlets, indicating a funding channel.',
      'finance'
    );

    const submit = dialog.getByRole('button', { name: 'Illuminate', exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Submission fired (the full connection + personhood gate passed) and ran through to the host
    // Bulletin write, which fail-closes without a real host signer and surfaces its error inline
    // (role="alert") — the deterministic proof the gated contribution submit executed.
    await expect(dialog.getByRole('alert')).toBeVisible();
  });
});

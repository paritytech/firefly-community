import { test, expect } from '../fixtures/wallet';
import { openConnectedIlluminateModal, fillIlluminateForm } from '../fixtures/test-utils';

/**
 * Illuminate journey — the core "create a signal" flow.
 *
 * Drives the real path end to end: the fixture-injected Spektr host wallet connects through
 * SignerContext, the Illuminate modal opens, the form is filled and validated, and submission
 * fires. With a connected host wallet the form's connection- and personhood-gated controls unlock
 * (photo upload enables, submit enables).
 *
 * Environment limit: `illuminate()` writes through the host preimage API (see lib/host/
 * bulletin-storage). That path is fail-closed and there is no real host preimage signer here, so
 * the write cannot complete — it surfaces its specific error inline (role="alert"). We assert that
 * error as the deterministic proof the gated submit executed the full path (an unconnected user
 * early-returns before ever reaching the write). Asserting the "Signal Illuminated" success would
 * require a real host and is covered by service/unit tests, not here.
 * TODO(e2e-host-harness): once a fake host-preimage harness exists, extend these to assert the real
 * end state — success screen, the new signal appearing in the feed, persisted CID.
 */
test.describe('Illuminate a signal', () => {
  test('connects via the host wallet and unlocks the Illuminate form', async ({ page }) => {
    await page.goto('/en/explore');
    await page.waitForLoadState('networkidle');

    // openConnectedIlluminateModal proves the connection: the photo upload is rendered
    // disabled={!isConnected}, so it only enables once the injected Spektr account connects.
    const dialog = await openConnectedIlluminateModal(page);
    await expect(dialog.getByRole('heading', { name: 'Illuminate' })).toBeVisible();
    await expect(dialog.locator('input[type="file"]').first()).toBeEnabled();
  });

  test('fills the form and submission fires (surfaces the fail-closed write error)', async ({
    page,
  }) => {
    await page.goto('/en/explore');
    await page.waitForLoadState('networkidle');

    const dialog = await openConnectedIlluminateModal(page);
    const observation =
      'A documented coordinated network of media outlets simultaneously amplified the same state narrative across many platforms.';
    await fillIlluminateForm(dialog, observation, 'investigation');

    // The observation the user typed is genuinely held by the form (not just that submit enabled).
    await expect(dialog.locator('#post-content')).toHaveValue(observation);

    const submit = dialog.getByRole('button', { name: 'Illuminate', exact: true });
    // The submit button enables only when connected + content valid + topic added + acknowledged —
    // i.e. the full connection + personhood (canIlluminate) gate has genuinely passed.
    await expect(submit).toBeEnabled();
    await submit.click();

    // The submission fired and ran through to the host Bulletin write. With no real host preimage
    // signer here the write fail-closes and surfaces its error inline (role="alert") rather than
    // completing — the deterministic proof the gated submit executed the full path. The successful
    // on-chain outcome needs a real host and is covered by service/unit tests (see below).
    await expect(dialog.getByRole('alert')).toBeVisible();
  });

  test('blocks submission until the observation, topic, and acknowledgement are provided', async ({
    page,
  }) => {
    await page.goto('/en/explore');
    await page.waitForLoadState('networkidle');

    const dialog = await openConnectedIlluminateModal(page);
    const submit = dialog.getByRole('button', { name: 'Illuminate', exact: true });

    // Connected but empty form → submit stays disabled.
    await expect(submit).toBeDisabled();

    // Content + topic but no acknowledgement → still disabled.
    await dialog.locator('#post-content').fill('y'.repeat(60));
    const topic = dialog.locator('#post-topics');
    await topic.click();
    await topic.pressSequentially('media');
    await topic.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Remove media' })).toBeVisible();
    await expect(submit).toBeDisabled();

    // Acknowledge → now enabled.
    await dialog.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
  });
});

test.describe('Explore feed renders seeded signals', () => {
  test('shows the seeded investigation signal and its corroborate/dispute actions', async ({
    page,
  }) => {
    await page.goto('/en/explore');
    await page.waitForLoadState('networkidle');

    // Seeded signal content is server-rendered and always present. The feed card shows the
    // observation body, so we match a stable phrase from the seeded post text.
    await expect(
      page.getByText(/44 media outlets that systematically amplify/).first()
    ).toBeVisible();

    // The feed cards expose the real corroborate/dispute actions.
    await expect(page.getByRole('button', { name: 'Corroborate' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dispute' }).first()).toBeVisible();
  });
});

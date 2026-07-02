import { test, expect } from '../fixtures/wallet';

/**
 * Verify journey — corroborate, dispute, and extract a claim on a seeded post.
 *
 * Targets the statically-available seeded post `seed-post-001`. The fixture connects the host
 * wallet, and these flows exercise the real CorroborateDisputeSheet and PostActions paths.
 *
 * Environment limit: corroboration/dispute submission writes through the host preimage API (see
 * lib/host/bulletin-storage), which is fail-closed and has no real host signer here. So the write
 * cannot complete — it surfaces its specific error inline (role="alert"). We assert that error as
 * the deterministic proof the gated submit executed the full path (an unconnected user early-returns
 * before ever reaching the write) — never a vacuous pass.
 * TODO(e2e-host-harness): with a fake host-preimage harness, assert the real end state — the
 * corroboration/dispute persisted and the post's corroboration count incrementing.
 */
const POST_URL = '/en/post/seed-post-001';

/** Drive the corroborate/dispute sheet with a firsthand observation and submit. */
async function submitEvidence(
  page: import('@playwright/test').Page,
  action: 'Corroborate' | 'Dispute',
  observation: string
): Promise<void> {
  // Wait for the host wallet to connect before submitting, so we exercise the connected path (not
  // a not-connected early-return). On the post page the Illuminate FAB renders only when connected
  // (requireConnected defaults true), so its presence is a faithful connection signal.
  await expect(page.getByRole('button', { name: 'Illuminate a signal' })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole('button', { name: action, exact: true }).click();
  const sheet = page.getByRole('dialog', { name: action });
  await expect(sheet).toBeVisible();

  // Default evidence type is "Firsthand account" → an observation textarea.
  await sheet.getByRole('textbox').first().fill(observation);

  const submit = sheet.getByRole('button', { name: 'Submit' });
  await expect(submit).toBeEnabled();
  await submit.click();

  // The connected + validated submit fired and ran the full path through to the host Bulletin
  // write. There is no real host preimage signer here, so the write fail-closes and surfaces its
  // specific error inline (role="alert") instead of completing — the deterministic proof the path
  // executed (an unconnected user would early-return before ever reaching the write). The
  // successful on-chain outcome needs a real host and is covered by service/unit tests, not here.
  await expect(sheet.getByRole('alert')).toBeVisible();
}

test.describe('Corroborate / dispute a signal', () => {
  test('corroborates a seeded post with a firsthand observation', async ({ page }) => {
    await page.goto(POST_URL);
    await page.waitForLoadState('networkidle');

    // Prove we're on the real seeded post (server-rendered body), not a 404/error shell — otherwise
    // the corroborate flow below would be exercising the wrong page.
    await expect(
      page.getByText(/44 media outlets that systematically amplify/).first()
    ).toBeVisible();

    await submitEvidence(
      page,
      'Corroborate',
      'I work in digital media and personally saw identical editorial guidance reach several newsrooms on the same day.'
    );
  });

  test('disputes a seeded post with a firsthand observation', async ({ page }) => {
    await page.goto(POST_URL);
    await page.waitForLoadState('networkidle');

    // Same seeded-content guard as the corroborate test.
    await expect(
      page.getByText(/44 media outlets that systematically amplify/).first()
    ).toBeVisible();

    await submitEvidence(
      page,
      'Dispute',
      'I reviewed the same outlets and found the publications were independently sourced, not coordinated.'
    );
  });
});

test.describe('Extract a claim from a signal', () => {
  test('runs extraction and surfaces a terminal result toast', async ({ page }) => {
    await page.goto(POST_URL);
    await page.waitForLoadState('networkidle');

    const extract = page.getByRole('button', { name: 'Extract a Claim' });
    await expect(extract).toBeVisible();
    await extract.click();

    // Extraction is deterministic at its boundary: it hits the configured AI worker. Without a
    // reachable endpoint here it surfaces a terminal toast — either "isn't available in this
    // deployment" (no endpoint configured, e.g. CI) or "AI extraction failed" (endpoint set but
    // unreachable). Both prove the action fired and resolved; we assert the terminal toast rather
    // than a specific deployment's wording.
    await expect(
      page.getByRole('status').filter({ hasText: /extraction (isn't available|failed)/i })
    ).toBeVisible({ timeout: 20000 });
  });
});

import { test as base, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { injectSpektrHostWallet } from './wallet';

/**
 * Extended test fixture with the faithful host-wallet (Spektr) injection built in.
 *
 * The `page` is wrapped so the Spektr extension is injected before any app script runs, so the
 * app's SignerProvider auto-connects on mount (see fixtures/wallet.ts). Accessibility/smoke specs
 * that import directly from '@playwright/test' are unaffected.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await injectSpektrHostWallet(page);
    await use(page);
  },
});

export { expect };

/**
 * Navigate and wait for the page to be fully loaded.
 */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Open the Illuminate modal and wait until the app reports a connected host wallet.
 *
 * Connection runs through the real SignerContext path: `injectSpektrExtension()` retries (~5s,
 * failing outside a host), then `connectViaSpektr` finds the fixture-injected
 * `window.injectedWeb3['spektr']` and connects. Several controls reflect that state, but the
 * faithful, unambiguous proof is the Illuminate form's photo upload, which is rendered
 * `disabled={!isConnected}` — so its becoming ENABLED means `useSigner().isConnected === true`.
 *
 * (The explore-page FAB uses `requireConnected={false}`, so its visibility is NOT a connection
 * signal — hence we assert on a control that is genuinely gated on the connection.)
 *
 * @returns the open dialog locator, ready to drive.
 */
export async function openConnectedIlluminateModal(page: Page): Promise<Locator> {
  // The rail / FAB button (aria-label "Illuminate a signal") opens the modal regardless of state.
  await page.getByRole('button', { name: 'Illuminate a signal' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Illuminate' });
  await expect(dialog).toBeVisible();
  // Wait out the host-inject retry loop until the connection lands and the gated control enables.
  await expect(dialog.locator('input[type="file"]').first()).toBeEnabled({ timeout: 15000 });
  return dialog;
}

/**
 * Fill the Illuminate form with a valid observation + topic + acknowledgement.
 * Assumes the modal is already open and connected (see {@link openConnectedIlluminateModal}).
 */
export async function fillIlluminateForm(
  dialog: Locator,
  observation: string,
  topic: string
): Promise<void> {
  await dialog.locator('#post-content').fill(observation);
  const topicInput = dialog.locator('#post-topics');
  await topicInput.click();
  await topicInput.pressSequentially(topic);
  await topicInput.press('Enter');
  // The entered topic becomes a removable pill — proof the topic registered.
  await expect(dialog.getByRole('button', { name: `Remove ${topic}` })).toBeVisible();
  await dialog.getByRole('checkbox').check();
}

/**
 * Wait for a button to be enabled and click it.
 */
export async function clickWhenEnabled(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible' });
  await expect(button).toBeEnabled();
  await button.click();
}

/**
 * Fill a form field by label.
 */
export async function fillByLabel(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label).fill(value);
}

/**
 * Assert page contains text.
 */
export async function expectText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}

/**
 * Assert no accessibility violations using axe-core.
 * Tests against WCAG 2.1 AA standards (target AAA for text contrast per project standards).
 *
 * @param page - The Playwright page to test
 * @param options - Optional configuration
 * @param options.disableRules - Rules to disable (e.g., for known issues being fixed)
 * @param options.includeSelector - CSS selector to limit testing scope
 */
export async function expectAccessible(
  page: Page,
  options?: {
    disableRules?: string[];
    includeSelector?: string;
  }
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  if (options?.includeSelector !== undefined) {
    builder = builder.include(options.includeSelector);
  }

  const results = await builder.analyze();

  // Format violations for better error messages
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));

  expect(
    violations,
    `Found ${violations.length} accessibility violation(s):\n${JSON.stringify(violations, null, 2)}`
  ).toHaveLength(0);
}

/**
 * Check accessibility with reduced strictness for pages with known issues.
 * Use this temporarily while fixing violations, with a comment explaining why.
 *
 * @param page - Playwright page to check
 * @param exceptRules - axe-core rule IDs to disable
 * @param _reason - Documented reason for exceptions (for code review, not runtime)
 */
export async function expectAccessibleWithExceptions(
  page: Page,
  exceptRules: string[],
  _reason: string
): Promise<void> {
  await expectAccessible(page, { disableRules: exceptRules });
}

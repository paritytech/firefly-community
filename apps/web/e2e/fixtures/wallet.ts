import { test as base, expect, type Page } from '@playwright/test';

/**
 * Faithful host-wallet (Spektr) fixture for E2E tests.
 *
 * The real app connects through the Triangle host's injected Spektr extension
 * (see src/lib/context/SignerContext.tsx):
 *
 *   1. `injectSpektrExtension()` asks the host to register an entry under
 *      `window.injectedWeb3[SpektrExtensionName]` via `@polkadot/extension-inject`.
 *   2. `connectInjectedExtension(SpektrExtensionName)` (polkadot-api/pjs-signer) reads
 *      that entry: it calls `entry.enable()`, then `enabledExtension.accounts.get()` for the
 *      account list, and builds a `PolkadotSigner` from `signer.signRaw` / `signer.signPayload`.
 *   3. The first account's `polkadotSigner` (with `publicKey` + `signBytes`) becomes the
 *      connected account, and the provider reports `isConnected: true`.
 *
 * Outside a host there is no transport, so `injectSpektrExtension()` resolves to `false` and
 * nothing is injected — which is exactly why the old polkadot-js/ethereum mock never produced a
 * connected wallet. This fixture instead PRE-POPULATES `window.injectedWeb3['spektr']` with the
 * exact `@polkadot/extension-inject` provider shape that `connectInjectedExtension` consumes.
 * `injectSpektrExtension()` still returns false (no host), but `connectViaSpektr` then finds the
 * pre-populated entry (`injectedWeb3?.['spektr'] !== undefined`) and connects through it — the same
 * code path the real host drives. The account/signer shape mirrors the SignerContext unit-test mock
 * (publicKey, deterministic signature from signBytes/signRaw).
 *
 * Determinism: a fixed sr25519 account (Alice's well-known address) and a fixed 64-byte signature.
 */

/** Well-known sr25519 dev account ("Alice"). Must be sr25519 so pjs-signer accepts it. */
export const TEST_ACCOUNT_ADDRESS = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
export const TEST_ACCOUNT_NAME = 'E2E Firefly';
/** Fixed 64-byte (sr25519) signature, hex-encoded — what `signRaw`/`signPayload` return. */
const FIXED_SIGNATURE = `0x${'ab'.repeat(64)}`;

export const TEST_ADDRESSES = {
  polkadot: TEST_ACCOUNT_ADDRESS,
} as const;

/**
 * Inject a fake host-provided Spektr extension into `window.injectedWeb3['spektr']`.
 *
 * Uses `addInitScript` so the entry exists before any app script runs — matching how the real host
 * registers its handlers before the product's auto-connect effect fires. The injected `enable()`
 * returns the standard `InjectedExtension` surface (`accounts.get/subscribe`, `signer.signRaw/
 * signPayload`) that `connectInjectedExtension` binds to.
 */
export async function injectSpektrHostWallet(page: Page): Promise<void> {
  await page.addInitScript(
    ([address, name, signature]) => {
      const account = { address, name, type: 'sr25519' as const, genesisHash: null };

      const injected = {
        version: '0.7.9',
        // `connectInjectedExtension` calls `entry.enable(dappName)` and then reads
        // `accounts.get()` and binds `signer.signRaw` / `signer.signPayload`.
        enable: () =>
          Promise.resolve({
            accounts: {
              get: () => Promise.resolve([account]),
              // Subscribe must immediately publish the current accounts and return an unsubscribe.
              subscribe: (cb: (accounts: unknown[]) => void) => {
                cb([account]);
                return () => {
                  /* no-op unsubscribe */
                };
              },
            },
            signer: {
              // pjs-signer's signBytes wraps signRaw and expects `{ signature }` (hex).
              signRaw: () => Promise.resolve({ id: 0, signature }),
              // Returned for completeness; on-chain signing isn't exercised in this environment.
              signPayload: () => Promise.resolve({ id: 0, signature }),
            },
          }),
      };

      const w = window as unknown as { injectedWeb3?: Record<string, unknown> };
      w.injectedWeb3 = { ...(w.injectedWeb3 ?? {}), spektr: injected };
    },
    [TEST_ACCOUNT_ADDRESS, TEST_ACCOUNT_NAME, FIXED_SIGNATURE] as const
  );
}

/**
 * Extended Playwright test that auto-injects the host wallet on every page.
 *
 * Use `import { test, expect } from '../fixtures/wallet'` in journey specs to get a page that
 * connects to the host wallet automatically (the SignerProvider auto-connects on mount).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await injectSpektrHostWallet(page);
    await use(page);
  },
});

export { expect };

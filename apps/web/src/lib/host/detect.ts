/**
 * Host Detection
 *
 * Synchronous detection of whether the app is running inside the Triangle host
 * (iframe/webview), plus lazy access to the host accounts provider.
 *
 * The host wallet *connection* is owned by @/lib/context/SignerContext, which resolves the host
 * product account over `sandboxTransport`. This module only provides the synchronous container
 * check and the accounts provider consumed by host services.
 */

import {
  createAccountsProvider,
  sandboxProvider,
  sandboxTransport,
} from '@novasamatech/host-api-wrapper';

type AccountsProviderType = ReturnType<typeof createAccountsProvider>;

let _accountsProvider: AccountsProviderType | null = null;

/**
 * Check if we're running inside the Triangle host environment.
 *
 * Uses the official SDK sandbox detection when available, with a fallback to
 * Triangle-specific window markers. Synchronous — no initialization required.
 */
function isInsideContainer(): boolean {
  if (typeof window === 'undefined') return false;
  // The SDK's sandbox detection is authoritative and synchronous: a cross-origin-safe iframe
  // check OR the native-webview marker. Trust it rather than re-deriving (and over-matching) here.
  return sandboxProvider.isCorrectEnvironment();
}

/**
 * Check if we're inside the host container (iframe/webview).
 * Synchronous and can be called at any time.
 */
export function isInContainer(): boolean {
  return isInsideContainer();
}

/**
 * Get the host accounts provider, created lazily on first use when inside the container.
 *
 * Returns null outside the host. The provider talks to the host over `sandboxTransport` (the host
 * message channel) — no browser extension is involved.
 */
export function getAccountsProvider(): AccountsProviderType | null {
  if (!isInsideContainer()) return null;
  _accountsProvider ??= createAccountsProvider(sandboxTransport);
  return _accountsProvider;
}

/**
 * Check if external (cross-origin) network requests will work.
 *
 * Returns true because permissions for external domains (e.g. map tiles) are requested on startup
 * via the Host API. If granted, requests work; if denied, they fail naturally.
 *
 * @deprecated No longer needed since permissions are requested upfront.
 */
export function canMakeExternalRequests(): boolean {
  return true;
}

/**
 * Check if geolocation is available. Works both inside and outside the host.
 */
export function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

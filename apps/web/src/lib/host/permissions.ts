/**
 * Host API permissions
 *
 * Requests network and device permissions from Triangle sandbox.
 * The sandbox blocks all external HTTP(S) and device access by default —
 * products must request permission via the Host API, which prompts the user.
 *
 * Once granted, permissions persist in the host's storage.
 *
 * Pattern rules (from Host API spec):
 * - Protocol must match exactly (https://)
 * - "*" matches exactly one DNS label (single-level subdomain)
 * - Path "/" matches any path on the domain
 */

import { hostApi } from '@novasamatech/host-api-wrapper';

import { isInContainer } from './detect';
import { createLogger } from '../logging';

const log = createLogger('HostPermissions');

// ═══ Network permissions ═══

/**
 * Permission pattern for the integrator-configured claim-extraction endpoint.
 *
 * Claim extraction is BYO-AI: there is no shared/credentialed default. If an
 * integrator sets NEXT_PUBLIC_CLAIM_EXTRACTOR_URL, we request access to that
 * origin; otherwise no AI permission is requested.
 */
function claimExtractorPermission(): string | null {
  const url = process.env.NEXT_PUBLIC_CLAIM_EXTRACTOR_URL;
  if (url === undefined || url === '') return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return null;
  }
}

const claimExtractorPattern = claimExtractorPermission();

/**
 * URL patterns that Firefly Network needs access to.
 */
const NETWORK_PERMISSIONS = [
  // Map tiles - CARTO basemaps (used by Triangle)
  'https://basemaps.cartocdn.com/',
  // Reverse geocoding
  'https://nominatim.openstreetmap.org/',
  // AI claim extraction worker — integrator-configured (BYO AI)
  ...(claimExtractorPattern !== null ? [claimExtractorPattern] : []),
];

// ═══ Device permissions ═══

type DevicePermission = 'Camera' | 'Microphone' | 'Location';

const DEVICE_PERMISSIONS: DevicePermission[] = [
  'Location', // Geolocation for map/distance
];

/**
 * Request all permissions from the Host on startup.
 * Runs in parallel so it doesn't block app init.
 *
 * Note: TransactionSubmit is NOT requested here — it's requested on-demand
 * when the first Bulletin upload is attempted, to avoid unnecessary prompts.
 */
export async function requestExternalPermissions(): Promise<void> {
  const all = [
    ...NETWORK_PERMISSIONS.map((pattern) => requestNetwork(pattern)),
    ...DEVICE_PERMISSIONS.map((device) => requestDevice(device)),
  ];
  await Promise.allSettled(all);
}

async function requestNetwork(pattern: string): Promise<void> {
  try {
    const result = hostApi.permission({
      tag: 'v1',
      value: { tag: 'Remote', value: [pattern] },
    });
    // Wait for permission dialog to complete - we don't need to check result
    // The host persists granted permissions, denied ones degrade gracefully
    await result.match(
      () => undefined,
      () => undefined
    );
  } catch {
    // User denied or host doesn't support this
  }
}

/**
 * Request blanket permission for transaction submissions (preimages).
 * Once granted, bulletin uploads won't prompt for each transaction.
 *
 * Called on-demand before the first Bulletin upload, not at startup.
 */
export async function requestTransactionSubmit(): Promise<void> {
  try {
    const result = hostApi.permission({
      tag: 'v1',
      value: { tag: 'ChainSubmit', value: undefined },
    });
    await result.match(
      () => undefined,
      () => undefined
    );
  } catch {
    // User denied or host doesn't support this
  }
}

/**
 * Allocate the RFC-0010 BulletIn resource allowance the host requires to accept a preimage
 * (Bulletin) write. The p2p-market reference does this before every preimage upload; without it the
 * host can reject the write. Host-only; never hard-throws.
 *
 * @returns `true` only when the host allocated the allowance (first outcome `Allocated`); `false`
 * on rejection, an unavailable resource, or an unsupported host. Callers should fail the write
 * early on `false` rather than submitting a preimage the host will reject (matches p2p-market).
 */
export async function requestBulletInAllowance(): Promise<boolean> {
  try {
    const result = hostApi.requestResourceAllocation({
      tag: 'v1',
      value: [{ tag: 'BulletInAllowance', value: undefined }],
    });
    // Verify the allocation outcome, don't fire-and-forget: only a first outcome of `Allocated`
    // means the host will accept the subsequent preimage write.
    return await result.match(
      (response) => {
        const outcome = response.value[0]?.tag ?? 'none';
        const allocated = outcome === 'Allocated';
        if (!allocated) {
          log.warn('Host did not allocate the BulletIn allowance', 'requestBulletInAllowance', {
            outcome,
          });
        }
        return allocated;
      },
      (error) => {
        log.warn('Host rejected the BulletIn allowance request', 'requestBulletInAllowance', {
          error,
        });
        return false;
      }
    );
  } catch {
    // Host doesn't support this
    return false;
  }
}

async function requestDevice(device: DevicePermission): Promise<void> {
  try {
    const result = hostApi.devicePermission({
      tag: 'v1',
      value: device,
    });
    // Wait for permission dialog to complete
    await result.match(
      () => undefined,
      () => undefined
    );
  } catch {
    // User denied or host doesn't support this
  }
}

// ═══ Safe browser API wrappers ═══

/**
 * Get user's geolocation — requests Host API permission first if in Triangle.
 * Use this instead of navigator.geolocation.getCurrentPosition() directly.
 *
 * @throws Error if geolocation is not available
 */
export async function getGeolocation(options?: PositionOptions): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation not available');
  }

  if (isInContainer()) {
    await requestDevice('Location');
  }

  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
}

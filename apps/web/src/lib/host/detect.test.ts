/**
 * Tests for host detection module.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const { isCorrectEnvMock, createAccountsProviderMock } = vi.hoisted(() => ({
  isCorrectEnvMock: vi.fn(() => false),
  createAccountsProviderMock: vi.fn(() => ({ id: 'mock-accounts-provider' })),
}));

vi.mock('@novasamatech/host-api-wrapper', () => ({
  sandboxProvider: { isCorrectEnvironment: isCorrectEnvMock },
  sandboxTransport: { id: 'transport' },
  createAccountsProvider: createAccountsProviderMock,
}));

import {
  isInContainer,
  getAccountsProvider,
  canMakeExternalRequests,
  hasGeolocation,
} from './detect';

beforeEach(() => {
  isCorrectEnvMock.mockReturnValue(false);
});

describe('isInContainer', () => {
  it('returns false in a standard (non-host) browser environment', () => {
    expect(isInContainer()).toBe(false);
  });

  it('returns true when the SDK reports the correct (host) environment', () => {
    isCorrectEnvMock.mockReturnValue(true);
    expect(isInContainer()).toBe(true);
  });
});

describe('getAccountsProvider', () => {
  it('returns null outside the host container', () => {
    isCorrectEnvMock.mockReturnValue(false);
    expect(getAccountsProvider()).toBeNull();
  });

  it('returns a host accounts provider when inside the container', () => {
    isCorrectEnvMock.mockReturnValue(true);
    expect(getAccountsProvider()).toEqual({ id: 'mock-accounts-provider' });
  });
});

describe('canMakeExternalRequests', () => {
  it('always returns true (deprecated function)', () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing deprecated function
    expect(canMakeExternalRequests()).toBe(true);
  });
});

describe('hasGeolocation', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  it('returns true when geolocation is available', () => {
    global.navigator = {
      geolocation: {},
    } as Navigator;

    expect(hasGeolocation()).toBe(true);
  });

  it('returns false when navigator is undefined', () => {
    // @ts-expect-error - Testing edge case
    global.navigator = undefined;

    expect(hasGeolocation()).toBe(false);
  });

  it('returns false when geolocation is not in navigator', () => {
    // @ts-expect-error - Testing edge case
    global.navigator = {};

    expect(hasGeolocation()).toBe(false);
  });
});

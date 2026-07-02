/**
 * Behavioural tests for useIdentity.
 *
 * Boundaries mocked: the signer context (wallet connection), the DIM client
 * (@cocuyo/identity), and host storage. The hook's own logic runs for real:
 * the init effect's status derivation (no-wallet → no-credential → no-profile →
 * ready), the suggested-pseudonym derivation, and the verify/create/update/clear
 * actions including their guard errors and the immutable-field protection on
 * update.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import type { DIMCredentialInfo, DIMStatus } from '@cocuyo/identity';
import type { FireflyProfile } from '@cocuyo/types';

// --- Signer context ------------------------------------------------------
const useSignerMock = vi.fn<() => { isConnected: boolean; isInHost: boolean }>();
vi.mock('@/lib/context/SignerContext', () => ({
  useSigner: () => useSignerMock(),
}));

// --- DIM client ----------------------------------------------------------
const getStatus = vi.fn<() => Promise<DIMStatus>>();
const getCredential = vi.fn<() => Promise<DIMCredentialInfo | null>>();
const verify = vi.fn<() => Promise<DIMCredentialInfo>>();
interface FakeClient {
  getStatus: typeof getStatus;
  getCredential: typeof getCredential;
  verify: typeof verify;
}
const createDIMClient = vi.fn<() => Promise<FakeClient>>();
vi.mock('@cocuyo/identity', () => ({
  createDIMClient: (): Promise<FakeClient> => createDIMClient(),
  generatePseudonym: (hash: string): string => `Pseudo-${hash.slice(0, 4)}`,
}));

// --- Host storage --------------------------------------------------------
const storageRead = vi.fn<() => Promise<FireflyProfile | null>>();
const storageWrite = vi.fn<() => Promise<void>>();
const storageClear = vi.fn<() => Promise<void>>();
vi.mock('@/lib/host/storage', () => ({
  storage: {
    read: () => storageRead(),
    write: () => storageWrite(),
    clear: () => storageClear(),
  },
}));

import { useIdentity } from './useIdentity';

const CRED: DIMCredentialInfo = {
  hash: 'cred-hash-abcdef' as DIMCredentialInfo['hash'],
  isValid: true,
  verifiedAt: 1_700_000_000,
};

function dimClient(): FakeClient {
  return { getStatus, getCredential, verify };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSignerMock.mockReturnValue({ isConnected: true, isInHost: true });
  createDIMClient.mockResolvedValue(dimClient());
  getStatus.mockResolvedValue('verified');
  getCredential.mockResolvedValue(CRED);
  verify.mockResolvedValue(CRED);
  storageRead.mockResolvedValue(null);
  storageWrite.mockResolvedValue(undefined);
  storageClear.mockResolvedValue(undefined);
});

describe('useIdentity init status derivation', () => {
  it('settles to no-wallet when the wallet is not connected', async () => {
    useSignerMock.mockReturnValue({ isConnected: false, isInHost: false });
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-wallet'));
    // DIM status is reset to unknown without a wallet; the credential read never runs.
    expect(result.current.dimStatus).toBe('unknown');
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('settles to no-credential when DIM is connected but not verified', async () => {
    getStatus.mockResolvedValue('unverified');
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-credential'));
    expect(result.current.dimStatus).toBe('unverified');
    expect(getCredential).not.toHaveBeenCalled();
  });

  it('settles to no-profile when verified with a credential but no stored profile', async () => {
    storageRead.mockResolvedValue(null);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-profile'));
    expect(result.current.credential?.hash).toBe(CRED.hash);
    // Suggested pseudonym is derived from the credential hash.
    expect(result.current.suggestedPseudonym).toBe('Pseudo-cred');
  });

  it('settles to ready and exposes the stored profile when one exists', async () => {
    const stored = { credentialHash: CRED.hash, pseudonym: 'StoredName' } as FireflyProfile;
    storageRead.mockResolvedValue(stored);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.profile?.pseudonym).toBe('StoredName');
  });

  it('captures init errors and falls back to no-wallet', async () => {
    createDIMClient.mockRejectedValue(new Error('client init failed'));
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('client init failed');
    expect(result.current.status).toBe('no-wallet');
  });
});

describe('useIdentity.verifyPersonhood', () => {
  it('sets verified status and moves to no-profile on success', async () => {
    getStatus.mockResolvedValue('unverified'); // start unverified so verify is meaningful
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-credential'));

    await act(async () => {
      await result.current.verifyPersonhood();
    });

    expect(verify).toHaveBeenCalledTimes(1);
    expect(result.current.dimStatus).toBe('verified');
    expect(result.current.status).toBe('no-profile');
    expect(result.current.credential?.hash).toBe(CRED.hash);
  });

  it('sets error status and rethrows when verification fails', async () => {
    getStatus.mockResolvedValue('unverified');
    verify.mockRejectedValue(new Error('user declined'));
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-credential'));

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.verifyPersonhood().catch((e: unknown) => e);
    });
    expect((thrown as Error).message).toBe('user declined');
    expect(result.current.dimStatus).toBe('error');
  });
});

describe('useIdentity.createProfile', () => {
  it('persists a new profile and moves to ready', async () => {
    storageRead.mockResolvedValue(null);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-profile'));

    await act(async () => {
      await result.current.createProfile({
        pseudonym: 'NewFirefly',
        disclosureLevel: 'anonymous',
      });
    });

    expect(storageWrite).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.profile?.pseudonym).toBe('NewFirefly');
    // Stats and reputation are initialised to zeroed defaults.
    expect(result.current.profile?.stats.postsCreated).toBe(0);
  });

  it('throws when there is no credential to attach the profile to', async () => {
    useSignerMock.mockReturnValue({ isConnected: false, isInHost: false });
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-wallet'));

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current
        .createProfile({ pseudonym: 'X', disclosureLevel: 'anonymous' })
        .catch((e: unknown) => e);
    });
    expect((thrown as Error).message).toContain('No credential');
    expect(storageWrite).not.toHaveBeenCalled();
  });
});

describe('useIdentity.updateProfile', () => {
  it('merges updates but protects id / credentialHash / createdAt', async () => {
    const stored: FireflyProfile = {
      id: 'firefly-original' as FireflyProfile['id'],
      credentialHash: CRED.hash,
      pseudonym: 'Original',
      disclosureLevel: 'anonymous',
      stats: {
        postsCreated: 0,
        corroborationsGiven: 0,
        corroborationsReceived: 0,
        collectivesJoined: 0,
        verificationsCompleted: 0,
      },
      reputation: { overall: 0, byTopic: {}, accuracyRate: 1 },
      collectiveMemberships: [],
      followedTopics: [],
      createdAt: 111,
      updatedAt: 111,
    };
    storageRead.mockResolvedValue(stored);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.updateProfile({
        pseudonym: 'Renamed',
        // Attempt to overwrite immutable fields — must be ignored.
        id: 'hacked' as FireflyProfile['id'],
        createdAt: 999,
      });
    });

    const profile = result.current.profile;
    expect(profile?.pseudonym).toBe('Renamed'); // mutable field updated
    expect(profile?.id).toBe('firefly-original'); // id preserved
    expect(profile?.createdAt).toBe(111); // createdAt preserved
    expect(profile?.updatedAt).not.toBe(111); // updatedAt bumped
    expect(storageWrite).toHaveBeenCalled();
  });

  it('throws when there is no profile to update', async () => {
    storageRead.mockResolvedValue(null);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('no-profile'));

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.updateProfile({ pseudonym: 'Z' }).catch((e: unknown) => e);
    });
    expect((thrown as Error).message).toContain('No profile');
  });
});

describe('useIdentity.clearProfile', () => {
  it('clears storage and reverts status to no-profile while a credential is present', async () => {
    const stored = { credentialHash: CRED.hash, pseudonym: 'StoredName' } as FireflyProfile;
    storageRead.mockResolvedValue(stored);
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.clearProfile();
    });

    expect(storageClear).toHaveBeenCalledTimes(1);
    expect(result.current.profile).toBeNull();
    expect(result.current.status).toBe('no-profile'); // credential still present
  });
});

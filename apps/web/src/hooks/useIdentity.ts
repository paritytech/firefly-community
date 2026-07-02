'use client';

/**
 * Identity Hook
 *
 * Manages DIM credential verification and profile state.
 * Provides the core identity state for the entire app.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSigner } from '@/lib/context/SignerContext';
import {
  createDIMClient,
  generatePseudonym,
  type DIMClient,
  type DIMCredentialInfo,
  type DIMStatus,
} from '@cocuyo/identity';
import type { FireflyProfile, NewFireflyProfile } from '@cocuyo/types';
import { createFireflyId, deriveCredentialFromString } from '@cocuyo/types';

/**
 * Overall identity status.
 */
export type IdentityStatus =
  | 'loading' // Checking state
  | 'no-wallet' // No wallet connected
  | 'no-credential' // Wallet connected, no DIM credential
  | 'no-profile' // Has credential, no profile created
  | 'ready'; // Fully set up

/**
 * Identity state returned by the hook.
 */
export interface IdentityState {
  /** Overall status */
  status: IdentityStatus;
  /** DIM credential info (if verified) */
  credential: DIMCredentialInfo | null;
  /** User profile (if created) */
  profile: FireflyProfile | null;
  /** DIM verification status */
  dimStatus: DIMStatus;
  /** Suggested pseudonym based on credential */
  suggestedPseudonym: string | null;
  /** Error if any operation failed */
  error: Error | null;

  // Actions
  /** Start DIM verification */
  verifyPersonhood: () => Promise<void>;
  /** Create profile after verification */
  createProfile: (data: NewFireflyProfile) => Promise<void>;
  /** Update existing profile */
  updateProfile: (updates: Partial<FireflyProfile>) => Promise<void>;
  /** Clear local profile data */
  clearProfile: () => Promise<void>;
}

import { storage } from '@/lib/host/storage';

// Storage key prefix for profiles
const PROFILE_KEY_PREFIX = 'profile:';

/**
 * Load profile from storage (HostAPI compliant).
 */
async function loadProfile(credentialHash: string): Promise<FireflyProfile | null> {
  const key = `${PROFILE_KEY_PREFIX}${credentialHash}`;
  return storage.read<FireflyProfile>(key);
}

/**
 * Save profile to storage (HostAPI compliant).
 */
async function saveProfile(profile: FireflyProfile): Promise<void> {
  const key = `${PROFILE_KEY_PREFIX}${profile.credentialHash}`;
  await storage.write(key, profile);
}

/**
 * Clear profile from storage (HostAPI compliant).
 */
async function clearStoredProfile(credentialHash: string): Promise<void> {
  const key = `${PROFILE_KEY_PREFIX}${credentialHash}`;
  await storage.clear(key);
}

/**
 * Hook to manage identity state.
 */
export function useIdentity(): IdentityState {
  const { isConnected, isInHost } = useSigner();

  const [status, setStatus] = useState<IdentityStatus>('loading');
  const [dimStatus, setDimStatus] = useState<DIMStatus>('unknown');
  const [credential, setCredential] = useState<DIMCredentialInfo | null>(null);
  const [profile, setProfile] = useState<FireflyProfile | null>(null);
  const [dimClient, setDimClient] = useState<DIMClient | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Initialize DIM client and check state
  useEffect(() => {
    mountedRef.current = true;
    // Helper to check mount state (TypeScript can't track ref mutations across async)
    const isMounted = (): boolean => mountedRef.current;

    async function init(): Promise<void> {
      // Clear any previous error
      setError(null);

      try {
        // Create DIM client
        const client = await createDIMClient();
        if (!isMounted()) return;
        setDimClient(client);

        // Check wallet connection
        if (!isConnected) {
          setStatus('no-wallet');
          setDimStatus('unknown');
          return;
        }

        // Check DIM credential
        const dimStat = await client.getStatus();
        if (!isMounted()) return;
        setDimStatus(dimStat);

        if (dimStat !== 'verified') {
          setStatus('no-credential');
          return;
        }

        // Get credential info
        const cred = await client.getCredential();
        if (!isMounted()) return;

        if (cred === null) {
          setStatus('no-credential');
          return;
        }

        setCredential(cred);

        // Check for existing profile
        const existingProfile = await loadProfile(cred.hash);
        if (!isMounted()) return;

        if (existingProfile !== null) {
          setProfile(existingProfile);
          setStatus('ready');
        } else {
          setStatus('no-profile');
        }
      } catch (err) {
        if (!isMounted()) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('no-wallet');
      }
    }

    void init();

    return () => {
      mountedRef.current = false;
    };
  }, [isConnected, isInHost]);

  // Generate suggested pseudonym from credential
  const suggestedPseudonym = credential !== null ? generatePseudonym(credential.hash) : null;

  // Verify personhood action
  const verifyPersonhood = useCallback(async () => {
    if (dimClient === null) {
      throw new Error('DIM client not initialized');
    }

    setDimStatus('checking');

    try {
      const cred = await dimClient.verify();
      setCredential(cred);
      setDimStatus('verified');
      setStatus('no-profile');
    } catch (error) {
      setDimStatus('error');
      throw error;
    }
  }, [dimClient]);

  // Create profile action
  const createProfile = useCallback(
    async (data: NewFireflyProfile): Promise<void> => {
      if (credential === null) {
        throw new Error('No credential available');
      }

      const now = Date.now();
      const newProfile: FireflyProfile = {
        id: createFireflyId(`firefly-${credential.hash.slice(0, 16)}`),
        // Use canonical credential derivation from @cocuyo/types
        credentialHash: deriveCredentialFromString(credential.hash),
        pseudonym: data.pseudonym,
        disclosureLevel: data.disclosureLevel,
        ...(data.publicInfo !== undefined && { publicInfo: data.publicInfo }),
        stats: {
          postsCreated: 0,
          corroborationsGiven: 0,
          corroborationsReceived: 0,
          collectivesJoined: 0,
          verificationsCompleted: 0,
        },
        reputation: {
          overall: 0,
          byTopic: {},
          accuracyRate: 1.0,
        },
        collectiveMemberships: [],
        followedTopics: data.followedTopics ?? [],
        createdAt: now,
        updatedAt: now,
      };

      // Save locally
      await saveProfile(newProfile);

      // TODO: Also write to Bulletin Chain

      setProfile(newProfile);
      setStatus('ready');
    },
    [credential]
  );

  // Update profile action
  const updateProfile = useCallback(
    async (updates: Partial<FireflyProfile>): Promise<void> => {
      if (profile === null) {
        throw new Error('No profile to update');
      }

      const updated: FireflyProfile = {
        ...profile,
        ...updates,
        // Don't allow overwriting these
        id: profile.id,
        credentialHash: profile.credentialHash,
        createdAt: profile.createdAt,
        updatedAt: Date.now(),
      };

      await saveProfile(updated);

      // TODO: Also write to Bulletin Chain

      setProfile(updated);
    },
    [profile]
  );

  // Clear profile action
  const clearProfile = useCallback(async (): Promise<void> => {
    if (credential !== null) {
      await clearStoredProfile(credential.hash);
    }
    setProfile(null);
    setStatus(credential !== null ? 'no-profile' : 'no-credential');
  }, [credential]);

  return {
    status,
    credential,
    profile,
    dimStatus,
    suggestedPseudonym,
    error,
    verifyPersonhood,
    createProfile,
    updateProfile,
    clearProfile,
  };
}

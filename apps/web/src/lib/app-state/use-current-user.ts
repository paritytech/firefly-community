'use client';

/**
 * useCurrentUser — session/user-identity slice of the app state.
 *
 * Owns the outlet-mode flag and the per-session id arrays (created posts,
 * created stories, corroborations) and derives the public `currentUser` value
 * from the connected wallet. Cross-domain actions append to these id arrays via
 * the exposed setters.
 */

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { deriveCredentialFromString } from '@cocuyo/types';
import type { PostId, ChainId, CorroborationId } from '@cocuyo/types';
import type { CurrentUser } from './types';
import { generatePseudonym } from './helpers';

interface SignerLike {
  selectedAccount: { address: string } | null;
  isConnected: boolean;
}

export interface CurrentUserSlice {
  currentUser: CurrentUser;
  toggleOutletMode: () => void;
  setCreatedPostIds: Dispatch<SetStateAction<PostId[]>>;
  setCreatedStoryIds: Dispatch<SetStateAction<ChainId[]>>;
  setCorroborationIds: Dispatch<SetStateAction<CorroborationId[]>>;
}

export function useCurrentUser(signer: SignerLike): CurrentUserSlice {
  const { selectedAccount, isConnected } = signer;

  const [isOutletAccount, setIsOutletAccount] = useState(false);
  const [createdPostIds, setCreatedPostIds] = useState<PostId[]>([]);
  const [createdStoryIds, setCreatedStoryIds] = useState<ChainId[]>([]);
  const [corroborationIds, setCorroborationIds] = useState<CorroborationId[]>([]);

  // Compute current user from wallet state
  const currentUser: CurrentUser = useMemo(() => {
    if (!isConnected || !selectedAccount) {
      return {
        isConnected: false,
        isOutletAccount: false,
        credentialHash: null,
        pseudonym: null,
        createdPostIds: [],
        createdStoryIds: [],
        corroborationIds: [],
      };
    }

    const address = selectedAccount.address;
    // Use canonical credential derivation from @cocuyo/types
    const credentialHash = deriveCredentialFromString(address);
    const pseudonym = generatePseudonym(address);

    return {
      isConnected: true,
      isOutletAccount,
      credentialHash,
      pseudonym,
      createdPostIds,
      createdStoryIds,
      corroborationIds,
    };
  }, [
    isConnected,
    selectedAccount,
    isOutletAccount,
    createdPostIds,
    createdStoryIds,
    corroborationIds,
  ]);

  const toggleOutletMode = useCallback((): void => {
    setIsOutletAccount((prev) => !prev);
  }, []);

  return {
    currentUser,
    toggleOutletMode,
    setCreatedPostIds,
    setCreatedStoryIds,
    setCorroborationIds,
  };
}

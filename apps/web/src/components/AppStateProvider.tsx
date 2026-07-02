'use client';

/**
 * AppStateProvider — Central session state management for the Firefly Network.
 *
 * Manages session state with localStorage persistence for claims.
 * Claims are stored on Bulletin Chain and indexed in localStorage for
 * cross-session persistence.
 *
 * Key design principles:
 * - Single source of truth for all entities
 * - Derived data computed from core entities
 * - Actions return the created/modified entity
 * - Integrates with wallet state via useSigner
 * - Claims persist across page refreshes via localStorage index
 *
 * Internally the state is split into per-domain hooks under `@/lib/app-state`
 * (posts, corroborations, claims, campaigns, verdicts, stories, current user).
 * This provider composes those slices and assembles the public context value —
 * the shape and semantics of `useAppState()` are unchanged.
 */

import { createContext, useContext, useMemo, type ReactNode, type ReactElement } from 'react';
import { useSigner } from '@/lib/context/SignerContext';
import type { AppStateContextValue } from '@/lib/app-state/types';
import { useCurrentUser } from '@/lib/app-state/use-current-user';
import { usePostsState } from '@/lib/app-state/use-posts-state';
import { useCorroborationsState } from '@/lib/app-state/use-corroborations-state';
import { useClaimsState } from '@/lib/app-state/use-claims-state';
import { useCampaignsState } from '@/lib/app-state/use-campaigns-state';
import { useVerdictsState } from '@/lib/app-state/use-verdicts-state';
import { useStoriesState } from '@/lib/app-state/use-stories-state';

// Re-export the public input types so existing consumers that import them from
// this module keep working unchanged.
export type { EvidenceInput, NewCampaignInput, VerdictInput } from '@/lib/app-state/types';

// ============================================================================
// Context
// ============================================================================

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps): ReactElement {
  const { selectedAccount, isConnected } = useSigner();

  // User / session identity slice.
  const {
    currentUser,
    toggleOutletMode,
    setCreatedPostIds,
    setCreatedStoryIds,
    setCorroborationIds,
  } = useCurrentUser({ selectedAccount, isConnected });

  // Posts slice (owns `posts`/`setPosts`, shared with corroborations + stories).
  const { posts, setPosts, createPost, getPost, getAllPosts } = usePostsState({
    currentUser,
    selectedAccount,
    setCreatedPostIds,
  });

  // Corroborations slice (updates posts + the user's corroboration id list).
  const { corroborations, postCorroborations, submitCorroboration, getPostCorroborations } =
    useCorroborationsState({ currentUser, setPosts, setCorroborationIds });

  // Claims slice (owns `claims`/`setClaims`, shared with verdicts).
  const {
    claims,
    setClaims,
    postClaims,
    extractClaim,
    submitClaimForFactCheck,
    getClaim,
    getPostClaims,
    getAllClaims,
  } = useClaimsState({ currentUser });

  // Campaigns slice (reads the shared `posts` map to validate contributions).
  const {
    campaigns,
    postCampaigns,
    campaignPosts,
    claimCampaigns,
    createCampaign,
    contributeToCampaign,
    getCampaign,
    getPostCampaigns,
    getClaimCampaigns,
    getAllCampaigns,
  } = useCampaignsState({ currentUser, posts });

  // Verdicts slice (maps a verdict onto its claim via the claims setter).
  const { verdicts, claimVerdicts, issueVerdict } = useVerdictsState({
    currentUser,
    claims,
    setClaims,
  });

  // Story-chain slice (updates posts + the user's created-story list).
  const { storyChains, createStory, addPostToStory, getStory, getAllStories } = useStoriesState({
    currentUser,
    setPosts,
    setCreatedStoryIds,
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo(
    (): AppStateContextValue => ({
      // State
      posts,
      corroborations,
      claims,
      campaigns,
      storyChains,
      verdicts,
      currentUser,
      postClaims,
      postCorroborations,
      postCampaigns,
      campaignPosts,
      claimVerdicts,
      claimCampaigns,

      // Actions
      createPost,
      submitCorroboration,
      extractClaim,
      createCampaign,
      contributeToCampaign,
      issueVerdict,
      submitClaimForFactCheck,
      createStory,
      addPostToStory,
      toggleOutletMode,

      // Getters
      getPost,
      getClaim,
      getCampaign,
      getStory,
      getPostClaims,
      getPostCorroborations,
      getPostCampaigns,
      getClaimCampaigns,
      getAllPosts,
      getAllClaims,
      getAllCampaigns,
      getAllStories,
    }),
    [
      posts,
      corroborations,
      claims,
      campaigns,
      storyChains,
      verdicts,
      currentUser,
      postClaims,
      postCorroborations,
      postCampaigns,
      campaignPosts,
      claimVerdicts,
      claimCampaigns,
      createPost,
      submitCorroboration,
      extractClaim,
      createCampaign,
      contributeToCampaign,
      issueVerdict,
      submitClaimForFactCheck,
      createStory,
      addPostToStory,
      toggleOutletMode,
      getPost,
      getClaim,
      getCampaign,
      getStory,
      getPostClaims,
      getPostCorroborations,
      getPostCampaigns,
      getClaimCampaigns,
      getAllPosts,
      getAllClaims,
      getAllCampaigns,
      getAllStories,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the app state and actions.
 * Must be used within an AppStateProvider.
 */
export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return ctx;
}

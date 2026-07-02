'use client';

/**
 * useClaimsState — claims slice of the app state.
 *
 * Owns the `claims` map and the `postClaims` mapping, loads persisted claims
 * from the localStorage index (resolved against Bulletin Chain) on mount, and
 * exposes claim extraction and fact-check submission. `claims`/`setClaims` are
 * returned so the verdicts slice can map a verdict onto its claim's status.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createClaimId } from '@cocuyo/types';
import type { Claim, ClaimId, PostId } from '@cocuyo/types';
import type { CurrentUser } from './types';
import { createLogger } from '@/lib/logging';
import { uploadToBulletin } from '@/lib/services/service-utils';
import { indexClaim, loadClaimIndex, fetchClaims, cacheClaim } from '@/lib/services/claim-service';
import { seedClaims, seedPostClaims } from '@/lib/seed-data';

const log = createLogger('AppStateProvider');

interface UseClaimsStateArgs {
  currentUser: CurrentUser;
}

export interface ClaimsSlice {
  claims: Map<ClaimId, Claim>;
  setClaims: Dispatch<SetStateAction<Map<ClaimId, Claim>>>;
  postClaims: Map<PostId, ClaimId[]>;
  extractClaim: (postId: PostId, statement: string, topics?: string[]) => Promise<Claim | null>;
  submitClaimForFactCheck: (claimId: ClaimId) => boolean;
  getClaim: (id: ClaimId) => Claim | undefined;
  getPostClaims: (postId: PostId) => Claim[];
  getAllClaims: () => Claim[];
}

export function useClaimsState({ currentUser }: UseClaimsStateArgs): ClaimsSlice {
  const [claims, setClaims] = useState<Map<ClaimId, Claim>>(() => new Map(seedClaims));
  const [postClaims, setPostClaims] = useState<Map<PostId, ClaimId[]>>(
    () => new Map(seedPostClaims)
  );

  // Load persisted claims from localStorage on mount
  useEffect(() => {
    let mounted = true;

    async function loadPersistedClaims(): Promise<void> {
      try {
        const index = await loadClaimIndex();

        // Fetch all persisted claims from Bulletin Chain
        const persistedClaims = await fetchClaims(index.all);

        if (!mounted) return;

        // Merge persisted claims with seed data
        setClaims((prev) => {
          const merged = new Map(prev);
          for (const claim of persistedClaims) {
            merged.set(claim.id, claim);
            // Also cache in claim-service for consistency
            cacheClaim(claim);
          }
          return merged;
        });

        // Update postClaims mapping
        setPostClaims((prev) => {
          const merged = new Map(prev);
          for (const [postId, claimIds] of Object.entries(index.byPost)) {
            const existing = merged.get(postId as PostId) ?? [];
            const newIds = claimIds.filter((id) => !existing.includes(id as ClaimId));
            if (newIds.length > 0) {
              merged.set(postId as PostId, [...existing, ...(newIds as ClaimId[])]);
            }
          }
          return merged;
        });
      } catch (error) {
        log.swallowed('Failed to load persisted claims', 'loadPersistedClaims', error);
      }
    }

    void loadPersistedClaims();

    return () => {
      mounted = false;
    };
  }, []);

  const extractClaim = useCallback(
    async (postId: PostId, statement: string, topics?: string[]): Promise<Claim | null> => {
      if (!currentUser.isConnected || !currentUser.credentialHash) {
        log.error(
          'extractClaim blocked: not connected or no credential',
          'extractClaim',
          undefined,
          {
            isConnected: currentUser.isConnected,
            hasCredential: currentUser.credentialHash !== null,
          }
        );
        return null;
      }

      const now = Date.now();

      // Build claim without ID first (ID will be CID from Bulletin). Topics come from the caller
      // (which has the post in hand); we don't look the post up in the in-memory map, so claims work
      // for any post the user is viewing, not just seeded ones.
      const claimData = {
        statement,
        sourcePostId: postId,
        extractedBy: currentUser.credentialHash,
        topics: topics ?? [],
        evidence: [],
        status: 'pending' as const,
        createdAt: now,
        updatedAt: now,
      };

      // Upload to Bulletin Chain
      const uploadResult = await uploadToBulletin(claimData);
      if (!uploadResult.ok) {
        log.error('extractClaim: bulletin upload failed', 'extractClaim', uploadResult.error);
        return null;
      }

      // Use CID as the claim ID
      const id = createClaimId(uploadResult.value.cid);
      const claim: Claim = { id, ...claimData };

      // Cache in claim-service for consistency
      cacheClaim(claim);

      // Persist to localStorage index (survives page refresh)
      await indexClaim(id, postId);

      setClaims((prev) => new Map(prev).set(id, claim));

      // Update post-claims mapping
      setPostClaims((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(postId) ?? [];
        newMap.set(postId, [...existing, id]);
        return newMap;
      });

      return claim;
    },
    [currentUser]
  );

  const submitClaimForFactCheck = useCallback(
    (claimId: ClaimId): boolean => {
      if (!currentUser.isConnected) {
        return false;
      }

      const claim = claims.get(claimId);
      // Only allow submission of pending claims
      if (claim?.status !== 'pending') {
        return false;
      }

      // Update claim status to under_review to indicate it's been submitted
      setClaims((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(claimId);
        if (existing?.status === 'pending') {
          newMap.set(claimId, {
            ...existing,
            status: 'under_review',
            updatedAt: Date.now(),
          });
        }
        return newMap;
      });

      return true;
    },
    [currentUser, claims]
  );

  const getClaim = useCallback(
    (id: ClaimId): Claim | undefined => {
      return claims.get(id);
    },
    [claims]
  );

  const getPostClaims = useCallback(
    (postId: PostId): Claim[] => {
      const claimIds = postClaims.get(postId) ?? [];
      return claimIds.map((id) => claims.get(id)).filter((c): c is Claim => c !== undefined);
    },
    [postClaims, claims]
  );

  const getAllClaims = useCallback((): Claim[] => {
    return Array.from(claims.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [claims]);

  return {
    claims,
    setClaims,
    postClaims,
    extractClaim,
    submitClaimForFactCheck,
    getClaim,
    getPostClaims,
    getAllClaims,
  };
}

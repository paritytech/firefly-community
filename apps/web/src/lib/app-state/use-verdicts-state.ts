'use client';

/**
 * useVerdictsState — verdicts slice of the app state.
 *
 * Owns the `verdicts` map and the `claimVerdicts` mapping. Issuing a verdict
 * (outlet mode only) records the verdict, maps it onto the target claim's
 * status, and stamps the verdict reasoning on the claim. The claims map and its
 * setter are owned by the claims slice and injected here.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { createVerdictId, createCollectiveId } from '@cocuyo/types';
import type { Claim, ClaimId, Verdict, VerdictId, VerdictStatus } from '@cocuyo/types';
import type { CurrentUser, VerdictInput } from './types';
import { generateId } from './helpers';

interface UseVerdictsStateArgs {
  currentUser: CurrentUser;
  claims: Map<ClaimId, Claim>;
  setClaims: Dispatch<SetStateAction<Map<ClaimId, Claim>>>;
}

export interface VerdictsSlice {
  verdicts: Map<VerdictId, Verdict>;
  claimVerdicts: Map<ClaimId, VerdictId | null>;
  issueVerdict: (claimId: ClaimId, verdict: VerdictInput) => Verdict | null;
}

export function useVerdictsState({
  currentUser,
  claims,
  setClaims,
}: UseVerdictsStateArgs): VerdictsSlice {
  const [verdicts, setVerdicts] = useState<Map<VerdictId, Verdict>>(new Map());
  const [claimVerdicts, setClaimVerdicts] = useState<Map<ClaimId, VerdictId | null>>(new Map());

  const issueVerdict = useCallback(
    (claimId: ClaimId, input: VerdictInput): Verdict | null => {
      if (!currentUser.isConnected || !currentUser.isOutletAccount) {
        return null;
      }

      const claim = claims.get(claimId);
      if (!claim) {
        return null;
      }

      const now = Date.now();
      const id = createVerdictId(generateId());
      const collectiveId = createCollectiveId('demo-collective');

      const verdict: Verdict = {
        id,
        claimId,
        collectiveId,
        status: input.status,
        rationale: input.rationale,
        issuedAt: now,
      };

      setVerdicts((prev) => new Map(prev).set(id, verdict));

      // Update claim-verdicts mapping
      setClaimVerdicts((prev) => {
        const newMap = new Map(prev);
        newMap.set(claimId, id);
        return newMap;
      });

      // Update claim status based on verdict
      setClaims((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(claimId);
        if (existing) {
          // Map VerdictStatus to ClaimStatus
          const statusMap: Record<VerdictStatus, Claim['status']> = {
            confirmed: 'verified',
            disputed: 'disputed',
            false: 'false',
            synthetic: 'false',
            inconclusive: 'unverifiable',
          };
          const newStatus = statusMap[input.status];

          newMap.set(claimId, {
            ...existing,
            status: newStatus,
            verdict: {
              status: newStatus,
              collectiveId,
              reasoning: input.rationale,
              issuedAt: now,
            },
            updatedAt: now,
          });
        }
        return newMap;
      });

      return verdict;
    },
    [currentUser, claims, setClaims]
  );

  return { verdicts, claimVerdicts, issueVerdict };
}

'use client';

/**
 * useCorroborationsState — corroboration slice of the app state.
 *
 * Owns the `corroborations` map and the `postCorroborations` mapping. Uploads
 * evidence to Bulletin Chain and, on success, updates the corroboration store,
 * the per-post mapping, the user's corroboration id list, and the source post's
 * corroboration summary. Posts and the user id list are owned by other slices,
 * so their setters are injected.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { createCorroborationId, isSafeUrl, ok, err } from '@cocuyo/types';
import type {
  Post,
  PostId,
  Corroboration,
  CorroborationId,
  CorroborationType,
  EvidenceQuality,
  Result,
} from '@cocuyo/types';
import type { CurrentUser, EvidenceInput } from './types';
import { uploadToBulletin } from '@/lib/services/service-utils';
import { seedCorroborations, seedPostCorroborations } from '@/lib/seed-data';

interface UseCorroborationsStateArgs {
  currentUser: CurrentUser;
  setPosts: Dispatch<SetStateAction<Map<PostId, Post>>>;
  setCorroborationIds: Dispatch<SetStateAction<CorroborationId[]>>;
}

export interface CorroborationsSlice {
  corroborations: Map<CorroborationId, Corroboration>;
  postCorroborations: Map<PostId, CorroborationId[]>;
  submitCorroboration: (
    postId: PostId,
    type: 'corroborate' | 'dispute',
    evidence?: EvidenceInput
  ) => Promise<Result<Corroboration, string>>;
  getPostCorroborations: (postId: PostId) => Corroboration[];
}

export function useCorroborationsState({
  currentUser,
  setPosts,
  setCorroborationIds,
}: UseCorroborationsStateArgs): CorroborationsSlice {
  const [corroborations, setCorroborations] = useState<Map<CorroborationId, Corroboration>>(
    () => new Map(seedCorroborations)
  );
  const [postCorroborations, setPostCorroborations] = useState<Map<PostId, CorroborationId[]>>(
    () => new Map(seedPostCorroborations)
  );

  const submitCorroboration = useCallback(
    async (
      postId: PostId,
      type: 'corroborate' | 'dispute',
      evidence?: EvidenceInput
    ): Promise<Result<Corroboration, string>> => {
      if (!currentUser.isConnected || !currentUser.credentialHash) {
        return err('Connect your wallet before corroborating.');
      }

      // Validate evidence URLs (the live path previously skipped this). We no longer require the
      // post to be in the in-memory seed map, so corroboration works for any post the user views.
      if (evidence?.type === 'source_link' && !isSafeUrl(evidence.content)) {
        return err('That evidence link is not a valid URL.');
      }

      const now = Date.now();

      const corroborationType: CorroborationType =
        type === 'dispute'
          ? 'challenge'
          : evidence?.type === 'observation'
            ? 'witness'
            : 'evidence';

      // Determine evidence quality based on type and evidence
      const quality: EvidenceQuality =
        type === 'dispute'
          ? 'unverified'
          : evidence?.type === 'observation'
            ? 'observation'
            : evidence
              ? 'documented'
              : 'unverified';

      // Build corroboration without ID first (ID will be CID from Bulletin)
      const corroborationData = {
        postId,
        type: corroborationType,
        dimSignature: currentUser.credentialHash,
        quality,
        createdAt: now,
        ...(evidence !== undefined && {
          evidenceType: evidence.type,
          evidenceContent: evidence.content,
          ...(evidence.description !== undefined && { evidenceDescription: evidence.description }),
        }),
      };

      // Upload to Bulletin Chain
      const uploadResult = await uploadToBulletin(corroborationData);
      if (!uploadResult.ok) {
        // Surface the specific Bulletin failure (fail-closed host error, denied allowance, etc.)
        // to the caller so the UI can show it instead of a generic message.
        return err(uploadResult.error);
      }

      // Use CID as the corroboration ID
      const id = createCorroborationId(uploadResult.value.cid);
      const corroboration: Corroboration = { id, ...corroborationData };

      setCorroborations((prev) => new Map(prev).set(id, corroboration));
      setCorroborationIds((prev) => [...prev, id]);

      // Update post-corroborations mapping
      setPostCorroborations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(postId) ?? [];
        newMap.set(postId, [...existing, id]);
        return newMap;
      });

      // Update post's corroboration summary
      setPosts((prev) => {
        const newMap = new Map(prev);
        const existingPost = newMap.get(postId);
        if (existingPost) {
          const summary = { ...existingPost.corroborations };
          if (type === 'dispute') {
            summary.challengeCount += 1;
          } else if (evidence?.type === 'observation') {
            summary.witnessCount += 1;
          } else {
            summary.evidenceCount += 1;
          }
          newMap.set(postId, { ...existingPost, corroborations: summary });
        }
        return newMap;
      });

      return ok(corroboration);
    },
    [currentUser, setPosts, setCorroborationIds]
  );

  const getPostCorroborations = useCallback(
    (postId: PostId): Corroboration[] => {
      const ids = postCorroborations.get(postId) ?? [];
      return ids
        .map((id) => corroborations.get(id))
        .filter((c): c is Corroboration => c !== undefined);
    },
    [postCorroborations, corroborations]
  );

  return { corroborations, postCorroborations, submitCorroboration, getPostCorroborations };
}

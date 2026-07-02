/**
 * Collective Service implementation with Bulletin storage.
 *
 * Provides collective membership verification and data access.
 * Uses session cache for immediate feedback and Bulletin Chain for persistence.
 */

import type {
  CollectiveService,
  Collective,
  CollectivePreview,
  CollectiveMember,
  MemberRole,
  CollectiveId,
  DIMCredential,
  PaginationParams,
  PaginatedResult,
} from '@cocuyo/types';
import { createCollectiveId } from '@cocuyo/types';
import { paginate, filterByTopic, fetchFromBulletin } from './service-utils';

// Session cache for collectives (seed data + user-created)
const collectivesCache: Collective[] = [
  // Seed collective for testing
  {
    id: createCollectiveId('seed-collective-001'),
    name: 'Truth Seekers',
    description: 'A collective dedicated to verifying claims about current events.',
    mission: 'To illuminate truth through collaborative verification.',
    topics: ['politics', 'current-events', 'fact-checking'],
    members: [],
    governance: {
      minVotesForVerdict: 3,
      verdictThreshold: 66,
      membershipApproval: 'vote',
    },
    reputation: {
      score: 85,
      verificationsCompleted: 42,
      accuracyRate: 0.94,
      avgResponseTime: 24,
    },
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: createCollectiveId('seed-collective-002'),
    name: 'Science Verifiers',
    description: 'Scientists and researchers verifying scientific claims.',
    mission: 'Evidence-based verification of scientific information.',
    topics: ['science', 'health', 'environment'],
    members: [],
    governance: {
      minVotesForVerdict: 5,
      verdictThreshold: 80,
      membershipApproval: 'invite',
    },
    reputation: {
      score: 92,
      verificationsCompleted: 128,
      accuracyRate: 0.97,
      avgResponseTime: 48,
    },
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

// Track membership in session (credential -> collective IDs)
const membershipCache = new Map<string, Set<string>>();

function collectiveToPreview(collective: Collective): CollectivePreview {
  return {
    id: collective.id,
    name: collective.name,
    description: collective.description,
    topics: collective.topics,
    memberCount: collective.members.length,
    reputation: collective.reputation.score,
    verificationsCompleted: collective.reputation.verificationsCompleted,
  };
}

export class CollectiveServiceImpl implements CollectiveService {
  async getCollective(id: CollectiveId): Promise<Collective | null> {
    // Check cache first
    const cached = collectivesCache.find((c) => c.id === id);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<Collective>(id);
  }

  getCollectives(params: {
    topic?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CollectivePreview>> {
    let filtered = collectivesCache.map(collectiveToPreview);

    // Filter by topic
    filtered = filterByTopic(filtered, (c) => c.topics, params.topic);

    // Sort by reputation (highest first)
    filtered.sort((a, b) => b.reputation - a.reputation);

    return Promise.resolve(paginate(filtered, params.pagination));
  }

  async isMember(collectiveId: CollectiveId, credential: DIMCredential): Promise<boolean> {
    // Check membership cache first
    const memberships = membershipCache.get(credential);
    if (memberships?.has(collectiveId) === true) return true;

    // Check collective members
    const collective = await this.getCollective(collectiveId);
    if (!collective) return false;

    return collective.members.some((m) => m.credentialHash === credential);
  }

  async getMemberRole(
    collectiveId: CollectiveId,
    credential: DIMCredential
  ): Promise<MemberRole | null> {
    const member = await this.getMember(collectiveId, credential);
    return member?.role ?? null;
  }

  async getMember(
    collectiveId: CollectiveId,
    credential: DIMCredential
  ): Promise<CollectiveMember | null> {
    const collective = await this.getCollective(collectiveId);
    if (!collective) return null;

    return collective.members.find((m) => m.credentialHash === credential) ?? null;
  }

  async getCollectivesForMember(credential: DIMCredential): Promise<readonly CollectivePreview[]> {
    // Get from membership cache
    const memberships = membershipCache.get(credential);
    if (!memberships || memberships.size === 0) {
      // Check all cached collectives
      const results: CollectivePreview[] = [];
      for (const collective of collectivesCache) {
        if (collective.members.some((m) => m.credentialHash === credential)) {
          results.push(collectiveToPreview(collective));
        }
      }
      return results;
    }

    // Fetch each collective the user is a member of
    const results: CollectivePreview[] = [];
    for (const collectiveId of memberships) {
      const collective = await this.getCollective(collectiveId as CollectiveId);
      if (collective) {
        results.push(collectiveToPreview(collective));
      }
    }

    return results;
  }

  /**
   * Add a member to a collective (internal use).
   * Used during testing and collective join flows.
   */
  addMember(collectiveId: CollectiveId, member: CollectiveMember): void {
    const collective = collectivesCache.find((c) => c.id === collectiveId);
    if (!collective) return;

    // Add to collective members
    const mutableMembers = collective.members as CollectiveMember[];
    if (!mutableMembers.some((m) => m.credentialHash === member.credentialHash)) {
      mutableMembers.push(member);
    }

    // Update membership cache
    let memberships = membershipCache.get(member.credentialHash);
    if (!memberships) {
      memberships = new Set();
      membershipCache.set(member.credentialHash, memberships);
    }
    memberships.add(collectiveId);
  }
}

// Export singleton instance
export const collectiveService: CollectiveService = new CollectiveServiceImpl();

/**
 * List active collectives as previews (real seed + session-created data).
 *
 * Used by surfaces like Explore that show collectives without a per-user
 * membership context. Not part of the CollectiveService interface — a
 * standalone read over the same backing cache.
 */
export function getActiveCollectives(limit = 8): readonly CollectivePreview[] {
  return collectivesCache.slice(0, limit).map(collectiveToPreview);
}

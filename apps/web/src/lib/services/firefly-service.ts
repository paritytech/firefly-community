/**
 * Firefly Profile Service implementation.
 *
 * Manages firefly profiles by:
 * 1. Storing editable fields (pseudonym, disclosureLevel, publicInfo) in session cache
 * 2. Deriving system fields (personhood, memberships, fact-checker status) from existing services
 * 3. Assembling complete public profiles for display
 *
 * Data precedence: session cache > Bulletin Chain > seed data
 */

import type {
  FireflyProfileService,
  FireflyProfile,
  FireflyProfileUpdate,
  PublicFireflyProfile,
  PostPreviewForProfile,
  CollectiveMembershipSummary,
  CollectivePreview,
  FactCheckerStatus,
  DIMCredential,
  PaginationParams,
  PaginatedResult,
  Result,
  PublicProfileInfo,
  DisclosureLevel,
  ReputationScore,
  FireflyStats,
} from '@cocuyo/types';
import { ok, err, createFireflyId, createCollectiveId } from '@cocuyo/types';
import { personhoodService } from './personhood-service';
import { collectiveService } from './collective-service';
import { paginate } from './service-utils';
import { getSeedPostsForLocale, getSeedProfileData, SEED_CREDENTIAL_IDS } from '@/lib/seed-data';

type Locale = 'en' | 'es';

/**
 * LRU cache for profile updates.
 * MOCK DATA: In production, this would be replaced with persistent storage.
 * Limited to 1000 entries to prevent unbounded memory growth.
 */
const PROFILE_CACHE_MAX_SIZE = 1000;
const profileCache = new Map<string, FireflyProfileUpdate>();

/**
 * Set a value in the LRU cache, evicting oldest entry if at capacity.
 */
function setCacheEntry(key: string, value: FireflyProfileUpdate): void {
  // Delete and re-add to maintain insertion order (Map iterates in insertion order)
  if (profileCache.has(key)) {
    profileCache.delete(key);
  } else if (profileCache.size >= PROFILE_CACHE_MAX_SIZE) {
    // Evict oldest entry (first key in iteration order)
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey !== undefined) {
      profileCache.delete(oldestKey);
    }
  }
  profileCache.set(key, value);
}

/**
 * Get a value from the LRU cache, refreshing its position.
 */
function getCacheEntry(key: string): FireflyProfileUpdate | undefined {
  const value = profileCache.get(key);
  if (value !== undefined) {
    // Refresh position by re-inserting
    profileCache.delete(key);
    profileCache.set(key, value);
  }
  return value;
}

// Minimum verifications to be a fact-checker
const FACT_CHECKER_THRESHOLD = 10;

/**
 * Default reputation for new profiles.
 */
function createDefaultReputation(): ReputationScore {
  return {
    overall: 50,
    byTopic: {},
    accuracyRate: 0,
  };
}

/**
 * Filter publicInfo based on disclosure level.
 */
function filterByDisclosure(
  publicInfo: PublicProfileInfo | undefined,
  disclosureLevel: DisclosureLevel
): PublicProfileInfo | undefined {
  if (!publicInfo) return undefined;

  switch (disclosureLevel) {
    case 'anonymous':
      // Show nothing
      return undefined;
    case 'partial':
      // Show location only
      return publicInfo.location !== undefined && publicInfo.location !== ''
        ? { location: publicInfo.location }
        : undefined;
    case 'public':
      // Show everything
      return publicInfo;
    default:
      return undefined;
  }
}

/**
 * Derive fact-checker status from collective memberships.
 */
function deriveFactCheckerStatus(
  memberships: readonly CollectiveMembershipSummary[]
): FactCheckerStatus {
  const totalVerifications = memberships.reduce((sum, m) => sum + m.verificationsCompleted, 0);

  if (totalVerifications >= FACT_CHECKER_THRESHOLD) {
    return 'verified';
  }
  return 'none';
}

/**
 * Build a public profile from stored data and derived fields.
 * Ensures all optional properties are handled correctly for exactOptionalPropertyTypes.
 * MOCK DATA: createdAt is synthetic - replace with actual storage in production.
 */
function buildPublicProfile(
  credentialHash: DIMCredential,
  stored: FireflyProfileUpdate,
  personhoodLevel: 'none' | 'lite' | 'full',
  filteredPublicInfo: PublicProfileInfo | undefined,
  stats: FireflyStats,
  memberships: readonly CollectiveMembershipSummary[],
  factCheckerStatus: FactCheckerStatus
): PublicFireflyProfile {
  const base: PublicFireflyProfile = {
    credentialHash,
    pseudonym: stored.pseudonym,
    disclosureLevel: stored.disclosureLevel,
    personhoodLevel,
    stats,
    reputation: createDefaultReputation(),
    collectiveMemberships: memberships,
    factCheckerStatus,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  };

  // Only add publicInfo if defined
  if (filteredPublicInfo) {
    return { ...base, publicInfo: filteredPublicInfo };
  }
  return base;
}

/**
 * Build publicInfo object without undefined values.
 * Uses spread syntax to conditionally include properties.
 */
function buildPublicInfo(
  source: NonNullable<FireflyProfileUpdate['publicInfo']>
): PublicProfileInfo | undefined {
  const result: PublicProfileInfo = {
    ...(source.displayName !== undefined && source.displayName !== ''
      ? { displayName: source.displayName }
      : {}),
    ...(source.location !== undefined && source.location !== ''
      ? { location: source.location }
      : {}),
    ...(source.bio !== undefined && source.bio !== '' ? { bio: source.bio } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Build a FireflyProfile from stored data.
 * Ensures all optional properties are handled correctly for exactOptionalPropertyTypes.
 * MOCK DATA: createdAt/updatedAt are synthetic - replace with actual storage in production.
 */
function buildFireflyProfile(
  credentialHash: DIMCredential,
  stored: FireflyProfileUpdate,
  collectiveIds: readonly string[],
  stats: FireflyStats
): FireflyProfile {
  const base: FireflyProfile = {
    id: createFireflyId(credentialHash),
    credentialHash,
    pseudonym: stored.pseudonym,
    disclosureLevel: stored.disclosureLevel,
    stats,
    reputation: createDefaultReputation(),
    collectiveMemberships: collectiveIds.map((id) => createCollectiveId(id)),
    followedTopics: [],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  };

  // Only add publicInfo if defined and has content
  if (stored.publicInfo) {
    const publicInfo = buildPublicInfo(stored.publicInfo);
    if (publicInfo) {
      return { ...base, publicInfo };
    }
  }
  return base;
}

export class FireflyProfileServiceImpl implements FireflyProfileService {
  /**
   * Get a public profile by credential hash.
   * Assembles stored editable data with derived system fields.
   */
  async getPublicProfile(
    credentialHash: DIMCredential,
    locale: Locale = 'en'
  ): Promise<PublicFireflyProfile | null> {
    // 1. Get stored editable profile data
    const storedProfile = await this.getStoredProfile(credentialHash, locale);
    if (!storedProfile) return null;

    // 2. Derive system-determined fields from existing services
    const personhoodLevel = await personhoodService.getLevel(credentialHash);
    const collectivePreviews = await collectiveService.getCollectivesForMember(credentialHash);
    const memberships = await this.getMembershipsForFirefly(credentialHash);
    const factCheckerStatus = deriveFactCheckerStatus(memberships);

    // 3. Apply disclosure filtering to publicInfo
    const filteredPublicInfo = filterByDisclosure(
      storedProfile.publicInfo,
      storedProfile.disclosureLevel
    );

    // 4. Calculate stats from posts and collective memberships
    const stats = await this.calculateStats(credentialHash, locale, collectivePreviews);

    // 5. Assemble and return
    return buildPublicProfile(
      credentialHash,
      storedProfile,
      personhoodLevel,
      filteredPublicInfo,
      stats,
      memberships,
      factCheckerStatus
    );
  }

  /**
   * Get the user's own full profile (no disclosure filtering).
   */
  async getOwnProfile(
    credentialHash: DIMCredential,
    locale: Locale = 'en'
  ): Promise<FireflyProfile | null> {
    const stored = await this.getStoredProfile(credentialHash, locale);
    if (!stored) return null;

    const collectivePreviews = await collectiveService.getCollectivesForMember(credentialHash);
    const stats = await this.calculateStats(credentialHash, locale, collectivePreviews);

    return buildFireflyProfile(
      credentialHash,
      stored,
      collectivePreviews.map((c) => c.id as string),
      stats
    );
  }

  /**
   * Update editable profile fields.
   */
  async updateProfile(
    credentialHash: DIMCredential,
    updates: FireflyProfileUpdate
  ): Promise<Result<FireflyProfile, string>> {
    // Validate pseudonym
    const trimmedPseudonym = updates.pseudonym.trim();
    if (trimmedPseudonym.length === 0) {
      return err('Pseudonym cannot be empty');
    }
    if (trimmedPseudonym.length > 30) {
      return err('Pseudonym must be 30 characters or less');
    }

    // Validate bio if present
    if (
      updates.publicInfo?.bio !== undefined &&
      updates.publicInfo.bio !== '' &&
      updates.publicInfo.bio.length > 500
    ) {
      return err('Bio must be 500 characters or less');
    }

    // Build publicInfo without undefined values
    let publicInfo: FireflyProfileUpdate['publicInfo'];
    if (updates.publicInfo) {
      const info: { displayName?: string; location?: string; bio?: string } = {};
      const trimmedDisplayName = updates.publicInfo.displayName?.trim();
      const trimmedLocation = updates.publicInfo.location?.trim();
      const trimmedBio = updates.publicInfo.bio?.trim();

      if (trimmedDisplayName !== undefined && trimmedDisplayName !== '')
        info.displayName = trimmedDisplayName;
      if (trimmedLocation !== undefined && trimmedLocation !== '') info.location = trimmedLocation;
      if (trimmedBio !== undefined && trimmedBio !== '') info.bio = trimmedBio;

      if (Object.keys(info).length > 0) {
        publicInfo = info as FireflyProfileUpdate['publicInfo'];
      }
    }

    // Store in cache
    const profileUpdate: FireflyProfileUpdate = {
      pseudonym: trimmedPseudonym,
      disclosureLevel: updates.disclosureLevel,
    };

    if (publicInfo) {
      (profileUpdate as { publicInfo?: typeof publicInfo }).publicInfo = publicInfo;
    }

    setCacheEntry(credentialHash, profileUpdate);

    // Return updated profile
    const profile = await this.getOwnProfile(credentialHash);
    if (!profile) {
      return err('Failed to retrieve updated profile');
    }

    return ok(profile);
  }

  /**
   * Get posts authored by a credential.
   */
  getPostsByAuthor(
    credentialHash: DIMCredential,
    pagination: PaginationParams,
    locale: Locale = 'en'
  ): Promise<PaginatedResult<PostPreviewForProfile>> {
    const posts = getSeedPostsForLocale(locale);
    const authorPosts = Array.from(posts.values()).filter(
      (p) => p.author.credentialHash === credentialHash
    );

    // Sort by creation time (newest first)
    authorPosts.sort((a, b) => b.createdAt - a.createdAt);

    // Convert to previews - handle optional title correctly
    const previews: PostPreviewForProfile[] = authorPosts.map((post) => {
      const preview: PostPreviewForProfile = {
        id: post.id,
        excerpt: post.content.text.slice(0, 200),
        topics: [...post.context.topics],
        corroborationCount: post.corroborations.witnessCount + post.corroborations.expertiseCount,
        createdAt: post.createdAt,
      };
      // Only add title if defined
      if (post.content.title !== undefined && post.content.title !== '') {
        return { ...preview, title: post.content.title };
      }
      return preview;
    });

    return Promise.resolve(paginate(previews, pagination));
  }

  /**
   * Get stored profile data from cache or seed.
   */
  private getStoredProfile(
    credentialHash: DIMCredential,
    locale: Locale
  ): Promise<FireflyProfileUpdate | null> {
    // Check session cache first (LRU refreshes position on access)
    const cached = getCacheEntry(credentialHash);
    if (cached) return Promise.resolve(cached);

    // Check seed data
    const seedProfile = getSeedProfileData(credentialHash, locale);
    if (seedProfile) return Promise.resolve(seedProfile);

    // For non-seed credentials, create default profile
    if (!SEED_CREDENTIAL_IDS.includes(credentialHash)) {
      return Promise.resolve({
        pseudonym: `Firefly-${credentialHash.slice(-6)}`,
        disclosureLevel: 'anonymous',
      });
    }

    return Promise.resolve(null);
  }

  /**
   * Get collective memberships with full details.
   */
  private async getMembershipsForFirefly(
    credentialHash: DIMCredential
  ): Promise<readonly CollectiveMembershipSummary[]> {
    const collectivePreviews = await collectiveService.getCollectivesForMember(credentialHash);

    // Convert previews to membership summaries
    const summaries: CollectiveMembershipSummary[] = [];

    for (const preview of collectivePreviews) {
      const collective = await collectiveService.getCollective(preview.id);
      if (!collective) continue;

      const member = collective.members.find((m) => m.credentialHash === credentialHash);
      if (!member) continue;

      summaries.push({
        collectiveId: preview.id,
        collectiveName: preview.name,
        role: member.role,
        joinedAt: member.joinedAt,
        verificationsCompleted: member.verificationsCompleted,
      });
    }

    return summaries;
  }

  /**
   * Calculate stats from posts and collective memberships.
   */
  private calculateStats(
    credentialHash: DIMCredential,
    locale: Locale,
    collectivePreviews: readonly CollectivePreview[]
  ): Promise<FireflyStats> {
    const posts = getSeedPostsForLocale(locale);
    const authorPosts = Array.from(posts.values()).filter(
      (p) => p.author.credentialHash === credentialHash
    );

    const totalCorroborations = authorPosts.reduce(
      (sum, p) =>
        sum +
        p.corroborations.witnessCount +
        p.corroborations.evidenceCount +
        p.corroborations.expertiseCount,
      0
    );

    // Sum verifications completed by this user across all collectives
    const verificationsCompleted = collectivePreviews.reduce(
      (sum, c) => sum + c.verificationsCompleted,
      0
    );

    return Promise.resolve({
      postsCreated: authorPosts.length,
      corroborationsGiven: 0, // Would need to track this separately
      corroborationsReceived: totalCorroborations,
      collectivesJoined: collectivePreviews.length,
      verificationsCompleted,
    });
  }
}

// Singleton instance
export const fireflyService = new FireflyProfileServiceImpl();

/**
 * Clear the profile cache (for testing).
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

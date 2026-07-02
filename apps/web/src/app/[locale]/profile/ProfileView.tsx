'use client';

/**
 * ProfileView — Client component for self-profile page.
 *
 * Shows topic-weighted reputation scores for the connected user
 * and allows editing profile fields.
 * Requires wallet connection to view.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FireflyProfile, PersonhoodLevel, FactCheckerStatus } from '@cocuyo/types';
import { deriveCredentialFromString } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import {
  EmptyState,
  PersonhoodBadge,
  FactCheckerBadge,
  CollectiveMembershipBadge,
} from '@cocuyo/ui';
import { fireflyService } from '@/lib/services/firefly-service';
import { personhoodService } from '@/lib/services/service-instances';
import { collectiveService } from '@/lib/services/collective-service';
import { ReputationRadar } from './ReputationRadar';
import { ProfileEditForm } from './ProfileEditForm';

interface ProfileViewTranslations {
  signInRequired: string;
  signInDescription: string;
  reputation: string;
  overallScore: string;
  topicScores: string;
  contributions: string;
  posts: string;
  corroborations: string;
  challenges: string;
  noActivity: string;
  collectives: string;
  noCollectives: string;
  loadError: string;
  retry: string;
  // Edit form translations
  editProfile: string;
  save: string;
  saving: string;
  cancel: string;
  pseudonym: string;
  pseudonymHint: string;
  displayName: string;
  displayNameHint: string;
  location: string;
  locationHint: string;
  bio: string;
  bioHint: string;
  disclosureLevel: string;
  anonymous: string;
  anonymousDesc: string;
  partial: string;
  partialDesc: string;
  public: string;
  publicDesc: string;
  saved: string;
  saveFailed: string;
  // Badge translations
  personhood: {
    full: string;
    lite: string;
    none: string;
  };
  factChecker: {
    verified: string;
    suspended: string;
  };
}

export interface ProfileViewProps {
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Translation strings */
  translations: ProfileViewTranslations;
}

interface ProfileState {
  profile: FireflyProfile | null;
  personhoodLevel: PersonhoodLevel;
  factCheckerStatus: FactCheckerStatus;
  collectiveMemberships: Array<{
    collectiveId: string;
    collectiveName: string;
    role: 'founder' | 'moderator' | 'member';
  }>;
  loading: boolean;
  error: boolean;
}

export function ProfileView({
  topicTranslations,
  translations: t,
}: ProfileViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    personhoodLevel: 'none',
    factCheckerStatus: 'none',
    collectiveMemberships: [],
    loading: true,
    error: false,
  });

  // Reload trigger - increment to force profile refresh
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Memoize credential to avoid recreating on every render
  // Uses canonical derivation from @cocuyo/types
  const credential = useMemo(() => {
    if (selectedAccount?.address == null || selectedAccount.address === '') return null;
    return deriveCredentialFromString(selectedAccount.address);
  }, [selectedAccount?.address]);

  // Load profile when wallet connects or changes
  // Uses stale-request guard to prevent race conditions when credential changes mid-request
  useEffect(() => {
    let isActive = true;

    const loadProfile = async (): Promise<void> => {
      if (!isConnected || !credential) {
        if (isActive) {
          setState({
            profile: null,
            personhoodLevel: 'none',
            factCheckerStatus: 'none',
            collectiveMemberships: [],
            loading: false,
            error: false,
          });
        }
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        // Load profile data
        const [profile, personhoodLevel, collectives] = await Promise.all([
          fireflyService.getOwnProfile(credential),
          personhoodService.getLevel(credential),
          collectiveService.getCollectivesForMember(credential),
        ]);

        // Guard against stale requests
        if (!isActive) return;

        // Determine fact-checker status
        let factCheckerStatus: FactCheckerStatus = 'none';
        if (collectives.length > 0) {
          // Check if user has completed verifications
          const totalVerifications = collectives.reduce(
            (sum, c) => sum + c.verificationsCompleted,
            0
          );
          if (totalVerifications >= 10) {
            factCheckerStatus = 'verified';
          }
        }

        // Get collective memberships with roles
        const memberships = await Promise.all(
          collectives.map(async (c) => {
            const role = await collectiveService.getMemberRole(c.id, credential);
            return {
              collectiveId: c.id as string,
              collectiveName: c.name,
              role: role ?? 'member',
            };
          })
        );

        // Guard against stale requests after second async batch
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isActive is a closure flag the cleanup can flip to false during the awaited Promise.all above; control-flow analysis cannot see that mutation
        if (!isActive) return;

        setState({
          profile,
          personhoodLevel,
          factCheckerStatus,
          collectiveMemberships: memberships,
          loading: false,
          error: false,
        });
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [isConnected, credential, reloadKey]);

  // Memoize initialValues to prevent form resets on parent rerenders
  const editInitialValues = useMemo(() => {
    if (!state.profile) return null;
    const profile = state.profile;

    // Build initialValues without undefined (exactOptionalPropertyTypes)
    const values: {
      pseudonym: string;
      disclosureLevel: typeof profile.disclosureLevel;
      displayName?: string;
      location?: string;
      bio?: string;
    } = {
      pseudonym: profile.pseudonym,
      disclosureLevel: profile.disclosureLevel,
    };
    if (profile.publicInfo?.displayName != null && profile.publicInfo.displayName !== '') {
      values.displayName = profile.publicInfo.displayName;
    }
    if (profile.publicInfo?.location != null && profile.publicInfo.location !== '') {
      values.location = profile.publicInfo.location;
    }
    if (profile.publicInfo?.bio != null && profile.publicInfo.bio !== '') {
      values.bio = profile.publicInfo.bio;
    }
    return values;
  }, [state.profile]);

  // Access gate for non-connected users
  if (!isConnected) {
    return (
      <div className="py-16">
        <EmptyState title={t.signInRequired} description={t.signInDescription} />
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 text-[var(--fg-error)]">{t.loadError}</div>
        <button
          onClick={triggerReload}
          className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-primary)] transition-colors hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-surface-container)]"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const { profile, personhoodLevel, factCheckerStatus, collectiveMemberships } = state;

  // Narrow credential type - this can be null if selectedAccount.address is undefined
  // despite isConnected being true (possible race condition during wallet switching)
  if (!credential) {
    return (
      <div className="py-16">
        <EmptyState title={t.signInRequired} description={t.signInDescription} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Profile header with badges */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <div className="mb-6 flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-container)]">
            <span className="text-2xl font-medium text-[var(--fg-primary)]">
              {profile?.pseudonym.charAt(0).toUpperCase() ??
                selectedAccount?.address.slice(0, 2).toUpperCase() ??
                'FF'}
            </span>
          </div>

          {/* Pseudonym only — the raw wallet address is never shown; identity stays with the host */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-medium text-[var(--fg-primary)]">
              {profile?.pseudonym ?? 'Anonymous'}
            </h2>
          </div>
        </div>

        {/* System badges (read-only) */}
        <div className="mb-6 flex flex-wrap gap-2">
          <PersonhoodBadge level={personhoodLevel} showLabel size="md" labels={t.personhood} />
          {factCheckerStatus !== 'none' && (
            <FactCheckerBadge status={factCheckerStatus} size="md" labels={t.factChecker} />
          )}
        </div>

        {/* Edit form */}
        {profile && editInitialValues && (
          <ProfileEditForm
            credentialHash={credential}
            initialValues={editInitialValues}
            translations={{
              editProfile: t.editProfile,
              save: t.save,
              saving: t.saving,
              cancel: t.cancel,
              pseudonym: t.pseudonym,
              pseudonymHint: t.pseudonymHint,
              displayName: t.displayName,
              displayNameHint: t.displayNameHint,
              location: t.location,
              locationHint: t.locationHint,
              bio: t.bio,
              bioHint: t.bioHint,
              disclosureLevel: t.disclosureLevel,
              anonymous: t.anonymous,
              anonymousDesc: t.anonymousDesc,
              partial: t.partial,
              partialDesc: t.partialDesc,
              public: t.public,
              publicDesc: t.publicDesc,
              saved: t.saved,
              saveFailed: t.saveFailed,
            }}
            onSaved={triggerReload}
          />
        )}
      </div>

      {/* Collectives */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.collectives}</h2>
        {collectiveMemberships.length === 0 ? (
          <p className="text-sm text-[var(--fg-tertiary)]">{t.noCollectives}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {collectiveMemberships.map((m) => (
              <CollectiveMembershipBadge
                key={m.collectiveId}
                collectiveName={m.collectiveName}
                role={m.role}
                size="md"
              />
            ))}
          </div>
        )}
      </div>

      {/* Overall reputation score */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
        <h2 className="mb-2 text-sm font-medium text-[var(--fg-secondary)]">{t.overallScore}</h2>
        <div className="font-display text-4xl font-bold text-[var(--fg-primary)]">
          {profile?.reputation.overall ?? 50}
        </div>
        <div className="mt-1 text-xs text-[var(--fg-tertiary)]">/ 100</div>
      </div>

      {/* Topic reputation radar */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.topicScores}</h2>
        <ReputationRadar
          scores={profile?.reputation.byTopic ?? {}}
          topicTranslations={topicTranslations}
        />
      </div>

      {/* Contribution stats */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.contributions}</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-primary)]">
              {profile?.stats.postsCreated ?? 0}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.posts}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-success)]">
              {profile?.stats.corroborationsReceived ?? 0}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.corroborations}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-warning)]">
              {profile?.stats.verificationsCompleted ?? 0}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.challenges}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

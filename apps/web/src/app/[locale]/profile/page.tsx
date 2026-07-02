/**
 * Profile page — Private firefly profile with reputation dashboard.
 *
 * Shows topic-weighted reputation scores for the connected user
 * and allows editing profile fields.
 * This is a private page - users can only view their own profile.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileView } from './ProfileView';

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tProfile = await getTranslations('profile');
  const tProfileEdit = await getTranslations('profileEdit');
  const tPosts = await getTranslations('posts');

  // Build topic translation map for common topics
  const commonTopics = ['economy', 'health', 'politics', 'transparency', 'infrastructure'];
  const topicTranslations: Record<string, string> = {};
  for (const topic of commonTopics) {
    try {
      topicTranslations[topic] = tPosts(`topics.${topic}`);
    } catch {
      topicTranslations[topic] = topic.replace(/-/g, ' ');
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {tProfile('title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{tProfile('description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <ProfileView
            topicTranslations={topicTranslations}
            translations={{
              signInRequired: tProfile('signInRequired'),
              signInDescription: tProfile('signInDescription'),
              reputation: tProfile('reputation'),
              overallScore: tProfile('overallScore'),
              topicScores: tProfile('topicScores'),
              contributions: tProfile('contributions'),
              posts: tProfile('posts'),
              corroborations: tProfile('corroborations'),
              challenges: tProfile('challenges'),
              noActivity: tProfile('noActivity'),
              loadError: tProfile('loadError'),
              retry: tProfile('retry'),
              collectives: tProfileEdit('collectives'),
              noCollectives: tProfileEdit('noCollectives'),
              // Edit form translations
              editProfile: tProfileEdit('editProfile'),
              save: tProfileEdit('save'),
              saving: tProfileEdit('saving'),
              cancel: tProfileEdit('cancel'),
              pseudonym: tProfileEdit('pseudonym'),
              pseudonymHint: tProfileEdit('pseudonymHint'),
              displayName: tProfileEdit('displayName'),
              displayNameHint: tProfileEdit('displayNameHint'),
              location: tProfileEdit('location'),
              locationHint: tProfileEdit('locationHint'),
              bio: tProfileEdit('bio'),
              bioHint: tProfileEdit('bioHint'),
              disclosureLevel: tProfileEdit('disclosureLevel'),
              anonymous: tProfileEdit('anonymous'),
              anonymousDesc: tProfileEdit('anonymousDesc'),
              partial: tProfileEdit('partial'),
              partialDesc: tProfileEdit('partialDesc'),
              public: tProfileEdit('public'),
              publicDesc: tProfileEdit('publicDesc'),
              saved: tProfileEdit('saved'),
              saveFailed: tProfileEdit('saveFailed'),
              // Badge translations
              personhood: {
                full: tProfileEdit('personhood.full'),
                lite: tProfileEdit('personhood.lite'),
                none: tProfileEdit('personhood.none'),
              },
              factChecker: {
                verified: tProfileEdit('factChecker.verified'),
                suspended: tProfileEdit('factChecker.suspended'),
              },
            }}
          />
        </div>
      </section>
    </main>
  );
}

/**
 * Public Profile Page — View any firefly's public profile.
 *
 * Route: /[locale]/profile/[credentialHash]
 *
 * Server component that fetches and displays a firefly's public profile
 * based on their DIM credential hash.
 */

import type { ReactElement } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
// notFound could be used for more aggressive 404 handling
import { validateDIMCredential } from '@cocuyo/types';
import { fireflyService } from '@/lib/services/firefly-service';
import { SEED_CREDENTIAL_IDS } from '@/lib/seed-data';
import { PublicProfileView } from './PublicProfileView';

interface PublicProfilePageProps {
  params: Promise<{
    locale: string;
    credentialHash: string;
  }>;
}

/**
 * Generate static params for all seed credentials.
 * Uses '_' as a placeholder for dynamic routes.
 */
// Static export prebuilds only the credentials below; any other hash 404s in the export
// (dynamicParams=false makes that explicit). Note: `next dev` returns 500 for un-prebuilt ids —
// a dev-only output:export quirk that does not occur in the built static site.
export const dynamicParams = false;

export function generateStaticParams(): Array<{
  locale: string;
  credentialHash: string;
}> {
  const locales = ['en', 'es'];
  return locales.flatMap((locale) =>
    ['_', ...SEED_CREDENTIAL_IDS].map((credentialHash) => ({
      locale,
      credentialHash,
    }))
  );
}

/**
 * Generate metadata for the profile page.
 */
export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { locale, credentialHash } = await params;
  const t = await getTranslations({ locale, namespace: 'publicProfile' });

  // Validate credential
  const validCredential = validateDIMCredential(credentialHash);
  if (!validCredential) {
    return { title: t('notFound') };
  }

  // Get profile for metadata
  const profile = await fireflyService.getPublicProfile(validCredential, locale as 'en' | 'es');

  if (!profile) {
    return { title: t('notFound') };
  }

  return {
    title: `${profile.pseudonym} — ${t('title')}`,
  };
}

/**
 * Profile Not Found component.
 */
function ProfileNotFound({
  translations,
}: {
  translations: { notFound: string; notFoundDescription: string };
}): ReactElement {
  return (
    <main className="min-h-screen">
      <div className="container-wide py-16 text-center">
        <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
          {translations.notFound}
        </h1>
        <p className="text-sm text-[var(--fg-secondary)]">{translations.notFoundDescription}</p>
      </div>
    </main>
  );
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps): Promise<ReactElement> {
  const { locale, credentialHash } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('publicProfile');

  // Validate credential format
  const validCredential = validateDIMCredential(credentialHash);
  if (!validCredential) {
    return (
      <ProfileNotFound
        translations={{
          notFound: t('notFound'),
          notFoundDescription: t('notFoundDescription'),
        }}
      />
    );
  }

  // Fetch profile
  const profile = await fireflyService.getPublicProfile(validCredential, locale as 'en' | 'es');

  if (!profile) {
    return (
      <ProfileNotFound
        translations={{
          notFound: t('notFound'),
          notFoundDescription: t('notFoundDescription'),
        }}
      />
    );
  }

  // Fetch recent posts
  const recentPosts = await fireflyService.getPostsByAuthor(
    validCredential,
    { offset: 0, limit: 5 },
    locale as 'en' | 'es'
  );

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('title')}
          </h1>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <PublicProfileView
            profile={profile}
            posts={recentPosts.items}
            locale={locale}
            translations={{
              backToExplore: t('backToExplore'),
              memberSince: t('memberSince'),
              noCollectives: t('noCollectives'),
              noPosts: t('noPosts'),
              posts: t('posts'),
              corroborations: t('corroborations'),
              reputation: t('reputation'),
              collectives: t('collectives'),
              recentPosts: t('recentPosts'),
              personhood: {
                full: t('personhood.full'),
                lite: t('personhood.lite'),
                none: t('personhood.none'),
              },
              factChecker: {
                verified: t('factChecker.verified'),
                suspended: t('factChecker.suspended'),
              },
            }}
          />
        </div>
      </section>
    </main>
  );
}

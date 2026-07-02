/**
 * Landing page — The first impression of the Firefly Network.
 *
 * Simple intro with one CTA to enter the app.
 */

import type { ReactElement } from 'react';
import { Link } from '../../../i18n/navigation';
import { FireflySymbol, getButtonClassName } from '@cocuyo/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tActions = await getTranslations('actions');

  return (
    <main>
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
        {/* Background glow effect */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-firefly-gold opacity-20 blur-3xl"
          aria-hidden="true"
        />

        <div className="container-wide relative z-10 py-20 text-center">
          {/* Firefly symbol */}
          <div className="mb-8">
            <FireflySymbol size={48} color="gold" animate aria-hidden="true" />
          </div>

          {/* Headline */}
          <h1 className="hero-heading mx-auto mb-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
            {t('hero.title')}
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-secondary md:text-xl">
            {t('hero.subtitle')}
          </p>

          {/* Primary CTA - Enter the app */}
          <div className="mb-6">
            <Link href="/explore" className={getButtonClassName('illuminate', 'lg')}>
              <FireflySymbol size={14} color="inherit" aria-hidden="true" />
              {tActions('illuminate')}
            </Link>
          </div>

          {/* Secondary link to About */}
          <Link
            href="/about"
            className="text-sm text-secondary transition-colors hover:text-primary"
          >
            {t('cta.howItWorks')}
          </Link>
        </div>
      </section>
    </main>
  );
}

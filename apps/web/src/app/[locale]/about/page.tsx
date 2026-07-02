/**
 * About page — The story of the Firefly Network.
 *
 * This page covers:
 * - The firefly metaphor and its origin (Efecto Cocuyo / Caribbean cocuyos)
 * - What the network is (and what it is NOT)
 * - How story chains and corroboration work
 * - The surveillance resistance architecture
 * - Built on Polkadot
 * - Open source commitment
 */

import type { ReactElement } from 'react';
import { FireflySymbol } from '@cocuyo/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExternalLink, ExternalLinkSection } from '@/components/ExternalLink';

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AboutPage({ params }: AboutPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  return (
    <>
      <main>
        {/* Hero */}
        <section className="border-b border-[var(--color-border-default)] py-24">
          <div className="container-narrow text-center">
            <FireflySymbol size={40} color="gold" aria-hidden="true" />
            <h1 className="mb-6 mt-6 text-4xl font-bold md:text-5xl">{t('hero.title')}</h1>
            <p className="text-xl text-[var(--color-text-secondary)]">{t('hero.subtitle')}</p>
          </div>
        </section>

        {/* The Firefly Principle */}
        <section className="py-20">
          <div className="container-narrow">
            <h2 className="mb-6 text-2xl font-semibold">{t('fireflyPrinciple.title')}</h2>

            <div className="space-y-6 leading-relaxed text-[var(--color-text-secondary)]">
              <p>{t('fireflyPrinciple.p1')}</p>
              <p>{t('fireflyPrinciple.p2')}</p>
              <p>{t('fireflyPrinciple.p3')}</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container-narrow">
            <h2 className="mb-8 text-2xl font-semibold">{t('howItWorks.title')}</h2>

            <div className="space-y-12">
              <div>
                <h3 className="mb-4 flex items-center gap-3 text-xl font-semibold">
                  <span style={{ color: 'var(--color-accent)' }}>✦</span>
                  {t('howItWorks.posts.title')}
                </h3>
                <p className="leading-relaxed text-[var(--color-text-secondary)]">
                  {t('howItWorks.posts.description')}
                </p>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-3 text-xl font-semibold">
                  <span style={{ color: 'var(--color-corroborated)' }}>◉</span>
                  {t('howItWorks.corroboration.title')}
                </h3>
                <p className="leading-relaxed text-[var(--color-text-secondary)]">
                  {t('howItWorks.corroboration.description')}
                </p>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-3 text-xl font-semibold">
                  <span className="text-[var(--color-text-primary)]">⟁</span>
                  {t('howItWorks.storyChains.title')}
                </h3>
                <p className="leading-relaxed text-[var(--color-text-secondary)]">
                  {t('howItWorks.storyChains.description')}
                </p>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-3 text-xl font-semibold">
                  <span className="text-[var(--color-text-primary)]">◈</span>
                  {t('howItWorks.verificationTrails.title')}
                </h3>
                <p className="leading-relaxed text-[var(--color-text-secondary)]">
                  {t('howItWorks.verificationTrails.description')}
                </p>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-3 text-xl font-semibold">
                  <span style={{ color: 'var(--color-accent)' }}>◇</span>
                  {t('howItWorks.campaigns.title')}
                </h3>
                <p className="leading-relaxed text-[var(--color-text-secondary)]">
                  {t('howItWorks.campaigns.description')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Surveillance Resistance */}
        <section className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-20">
          <div className="container-narrow">
            <h2 className="mb-8 text-2xl font-semibold">{t('surveillanceResistance.title')}</h2>

            <div className="space-y-6 leading-relaxed text-[var(--color-text-secondary)]">
              <p>{t('surveillanceResistance.intro')}</p>

              <ul className="space-y-4 pl-6">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--color-accent)]">•</span>
                  <span>{t('surveillanceResistance.noUserDatabase')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--color-accent)]">•</span>
                  <span>{t('surveillanceResistance.noContentServer')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--color-accent)]">•</span>
                  <span>{t('surveillanceResistance.noMetadata')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--color-accent)]">•</span>
                  <span>{t('surveillanceResistance.noCookies')}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Built on Polkadot */}
        <section className="py-20">
          <div className="container-narrow">
            <h2 className="mb-8 text-2xl font-semibold">{t('builtOnPolkadot.title')}</h2>

            <div className="space-y-6 leading-relaxed text-[var(--color-text-secondary)]">
              <p>{t('builtOnPolkadot.intro')}</p>

              <ExternalLinkSection>
                <div className="flex flex-wrap gap-4 pt-6">
                  <ExternalLink
                    href="https://polkadot.com"
                    className="inline-flex items-center gap-2 rounded border border-[var(--color-border-default)] px-4 py-2 transition-colors hover:border-[var(--color-border-emphasis)]"
                  >
                    <span>Polkadot</span>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-polkadot-pink)' }}
                      aria-hidden="true"
                    />
                  </ExternalLink>
                  <ExternalLink
                    href="https://web3.foundation"
                    className="inline-flex items-center gap-2 rounded border border-[var(--color-border-default)] px-4 py-2 transition-colors hover:border-[var(--color-border-emphasis)]"
                  >
                    Web3 Foundation
                  </ExternalLink>
                </div>
              </ExternalLinkSection>
            </div>
          </div>
        </section>

        {/* Open Source - hidden in host mode */}
        <ExternalLinkSection>
          <section className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-20">
            <div className="container-narrow text-center">
              <h2 className="mb-6 text-2xl font-semibold">{t('openSource.title')}</h2>

              <p className="mb-8 leading-relaxed text-[var(--color-text-secondary)]">
                {t('openSource.description')}
              </p>

              <ExternalLink
                href="https://github.com/paritytech/firefly-community"
                className="inline-flex items-center gap-2 text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent)]"
              >
                <span>{t('openSource.viewOnGitHub')}</span>
                <span aria-hidden="true">→</span>
              </ExternalLink>
            </div>
          </section>
        </ExternalLinkSection>
      </main>
    </>
  );
}

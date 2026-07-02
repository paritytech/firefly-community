'use client';

/**
 * App-specific Navbar - minimal navigation.
 * Note: Theme is controlled by Triangle host, not by this app.
 */

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Navbar } from '@cocuyo/ui';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AppNavbar(): ReactElement {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('nav');

  // Nav links for primary navigation
  const navLinks: Array<{ href: string; label: string }> = [
    { href: `/${locale}/explore`, label: t('stories') },
    { href: `/${locale}/bounties`, label: t('helpNeeded') },
    { href: `/${locale}/about`, label: t('about') },
  ];

  return (
    <Navbar
      currentPath={pathname}
      actionsSlot={<LanguageSwitcher />}
      LinkComponent={Link}
      navLinks={navLinks}
      homeLabel={t('home')}
      homeHref={`/${locale}`}
      brandName={t('brandName')}
      stageBadge="ALPHA"
    />
  );
}

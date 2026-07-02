'use client';

/**
 * App-specific Footer with translations.
 */

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Footer } from '@cocuyo/ui';

export function AppFooter(): ReactElement {
  const t = useTranslations('footer');

  return (
    <Footer
      labels={{
        builtOn: t('builtOn'),
        tagline: t('tagline'),
      }}
    />
  );
}

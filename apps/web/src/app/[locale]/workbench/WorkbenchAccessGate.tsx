'use client';

/**
 * WorkbenchAccessGate — Access restriction message for non-members.
 *
 * Shown when a user is not connected or not a collective member.
 */

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@cocuyo/ui';

export function WorkbenchAccessGate(): ReactElement {
  const t = useTranslations('workbench');

  return (
    <div className="py-16">
      <EmptyState title={t('accessRequired')} description={t('accessDescription')} />
    </div>
  );
}

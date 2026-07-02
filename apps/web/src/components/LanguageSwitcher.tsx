'use client';

/**
 * LanguageSwitcher — Toggle between available locales.
 *
 * Uses next-intl's routing to switch locales while preserving the current path.
 */

import type { ReactElement } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

interface LocaleConfig {
  code: string;
  label: string;
}

const localeConfigs: LocaleConfig[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function LanguageSwitcher(): ReactElement {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: string): void => {
    // Remove current locale prefix and add new one
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  return (
    <div className="flex items-center gap-1">
      {localeConfigs.map((config) => {
        const isActive = locale === config.code;
        return (
          <button
            key={config.code}
            type="button"
            onClick={() => handleLocaleChange(config.code)}
            disabled={isActive}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors ${
              isActive
                ? 'cursor-default bg-[var(--bg-surface-container)] text-[var(--fg-primary)]'
                : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-surface-nested)] hover:text-[var(--fg-primary)]'
            } `}
            aria-label={`Switch to ${config.label}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="text-xs font-medium uppercase">{config.code}</span>
          </button>
        );
      })}
    </div>
  );
}

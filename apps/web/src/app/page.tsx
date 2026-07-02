import { redirect } from 'next/navigation';
import { routing } from '../../i18n/routing';

/**
 * Root redirect.
 *
 * The app lives entirely under `/[locale]`, and `output: 'export'` disables the next-intl
 * middleware that would otherwise redirect `/` → `/${defaultLocale}`. Without this, bare `/` is a
 * hard 404 — which breaks the Triangle host (and the host-wallet E2E), since the host loads the
 * product at its origin root. Statically redirect `/` to the default locale instead.
 */
export default function RootPage(): never {
  redirect(`/${routing.defaultLocale}`);
}

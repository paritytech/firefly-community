/**
 * Invite Member page — Form to invite a new team member.
 *
 * Allows authorized members to send invitations.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InviteFormView } from './InviteFormView';

interface InvitePageProps {
  params: Promise<{ locale: string }>;
}

export default async function InvitePage({ params }: InvitePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('invite.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Send an invitation to join your organization.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide max-w-2xl">
          <InviteFormView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Form fields
              credential: t('invite.credential'),
              credentialPlaceholder: t('invite.credentialPlaceholder'),
              role: t('invite.role'),
              message: t('invite.message'),
              messagePlaceholder: t('invite.messagePlaceholder'),
              // Actions
              send: t('invite.send'),
              sending: t('invite.sending'),
              // Success
              success: t('invite.success'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
              // Roles
              roleAdmin: t('roles.admin'),
              roleEditor: t('roles.editor'),
              roleContributor: t('roles.contributor'),
              roleViewer: t('roles.viewer'),
            }}
          />
        </div>
      </section>
    </main>
  );
}

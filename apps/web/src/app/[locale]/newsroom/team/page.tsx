/**
 * Team page — Manage organization team members.
 *
 * Shows members and pending invitations with role management.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TeamListView } from './TeamListView';

interface TeamPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TeamPage({ params }: TeamPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('team.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Manage your organization&apos;s team members and invitations.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <TeamListView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Team
              members: t('team.members'),
              invitations: t('team.invitations'),
              invite: t('team.invite'),
              noMembers: t('team.noMembers'),
              noInvitations: t('team.noInvitations'),
              role: t('team.role'),
              joinedAt: t('team.joinedAt'),
              status: t('team.status'),
              active: t('team.active'),
              suspended: t('team.suspended'),
              pending: t('team.pending'),
              changeRole: t('team.changeRole'),
              remove: t('team.remove'),
              revokeInvite: t('team.revokeInvite'),
              // Roles
              roleOwner: t('roles.owner'),
              roleAdmin: t('roles.admin'),
              roleEditor: t('roles.editor'),
              roleContributor: t('roles.contributor'),
              roleViewer: t('roles.viewer'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
            }}
          />
        </div>
      </section>
    </main>
  );
}

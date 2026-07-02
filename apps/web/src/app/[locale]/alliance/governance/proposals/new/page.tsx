/**
 * New Proposal page — Create a governance proposal.
 *
 * Form for creating new proposals with type-specific fields.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewProposalView } from './NewProposalView';

interface NewProposalPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewProposalPage({
  params,
}: NewProposalPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.governance');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('create.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{t('create.description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide max-w-2xl">
          <NewProposalView
            translations={{
              // Form fields
              typeLabel: t('create.typeLabel'),
              titleLabel: t('create.titleLabel'),
              titlePlaceholder: t('create.titlePlaceholder'),
              descriptionLabel: t('create.descriptionLabel'),
              descriptionPlaceholder: t('create.descriptionPlaceholder'),
              submit: t('create.submit'),
              submitting: t('create.submitting'),
              success: t('create.success'),
              // Types
              typeOutletAdd: t('types.outlet-add'),
              typeOutletRemove: t('types.outlet-remove'),
              typeWeightChange: t('types.weight-change'),
              typeParameterChange: t('types.parameter-change'),
              typeEmergency: t('types.emergency'),
              // Outlet Add fields
              outletAddTitle: t('create.outletAdd.title'),
              outletIdLabel: t('create.outletAdd.outletIdLabel'),
              outletIdPlaceholder: t('create.outletAdd.outletIdPlaceholder'),
              outletNameLabel: t('create.outletAdd.outletNameLabel'),
              outletNamePlaceholder: t('create.outletAdd.outletNamePlaceholder'),
              treasuryLabel: t('create.outletAdd.treasuryLabel'),
              treasuryPlaceholder: t('create.outletAdd.treasuryPlaceholder'),
              weightLabel: t('create.outletAdd.weightLabel'),
              weightHelp: t('create.outletAdd.weightHelp'),
              rationaleLabel: t('create.outletAdd.rationaleLabel'),
              rationalePlaceholder: t('create.outletAdd.rationalePlaceholder'),
              // Outlet Remove fields
              outletRemoveTitle: t('create.outletRemove.title'),
              outletToRemoveLabel: t('create.outletRemove.outletIdLabel'),
              removalReasonLabel: t('create.outletRemove.reasonLabel'),
              removalReasonPlaceholder: t('create.outletRemove.reasonPlaceholder'),
              // Weight Change fields
              weightChangeTitle: t('create.weightChange.title'),
              weightChangeDescription: t('create.weightChange.descriptionText'),
              newWeightsLabel: t('create.weightChange.newWeightsLabel'),
              weightRationaleLabel: t('create.weightChange.rationaleLabel'),
              weightRationalePlaceholder: t('create.weightChange.rationalePlaceholder'),
              // Parameter Change fields
              parameterChangeTitle: t('create.parameterChange.title'),
              parameterLabel: t('create.parameterChange.parameterLabel'),
              currentValueLabel: t('create.parameterChange.currentValueLabel'),
              newValueLabel: t('create.parameterChange.newValueLabel'),
              parameterRationaleLabel: t('create.parameterChange.rationaleLabel'),
              parameterRationalePlaceholder: t('create.parameterChange.rationalePlaceholder'),
              // Emergency fields
              emergencyTitle: t('create.emergency.title'),
              emergencyWarning: t('create.emergency.warning'),
              actionLabel: t('create.emergency.actionLabel'),
              emergencyDescriptionLabel: t('create.emergency.descriptionLabel'),
              emergencyDescriptionPlaceholder: t('create.emergency.descriptionPlaceholder'),
              // Access
              signInRequired: t('create.signInRequired'),
              tierRequired: t('create.tierRequired'),
            }}
          />
        </div>
      </section>
    </main>
  );
}

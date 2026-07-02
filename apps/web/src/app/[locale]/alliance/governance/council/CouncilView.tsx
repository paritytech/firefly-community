'use client';

/**
 * CouncilView — Alliance Council members directory.
 *
 * Shows council members and their governance responsibilities.
 */

import type { ReactElement } from 'react';
import { EmptyState } from '@cocuyo/ui';

interface CouncilViewTranslations {
  members: string;
  responsibilities: string;
  noMembers: string;
  responsibilityOutlets: string;
  responsibilityQuality: string;
  responsibilityEmergency: string;
  responsibilityDisputes: string;
}

export interface CouncilViewProps {
  translations: CouncilViewTranslations;
}

// Mock council members for demo
const COUNCIL_MEMBERS: Array<{
  address: string;
  role: string;
  joinedAt: Date;
}> = [
  // Initially empty - will be populated through governance
];

export function CouncilView({ translations: t }: CouncilViewProps): ReactElement {
  const responsibilities = [
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      ),
      text: t.responsibilityOutlets,
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      text: t.responsibilityQuality,
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      text: t.responsibilityEmergency,
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
      ),
      text: t.responsibilityDisputes,
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Council Members */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.members}</h2>

        {COUNCIL_MEMBERS.length > 0 ? (
          <div className="space-y-3">
            {COUNCIL_MEMBERS.map((member) => (
              <div
                key={member.address}
                className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface-nested)]">
                    <svg
                      className="h-5 w-5 text-[var(--fg-tertiary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="font-mono text-sm text-[var(--fg-primary)]">
                      {member.address.slice(0, 8)}...{member.address.slice(-6)}
                    </div>
                    <div className="text-xs text-[var(--fg-tertiary)]">{member.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t.noMembers} />
        )}
      </div>

      {/* Responsibilities */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.responsibilities}</h2>

        <div className="space-y-3">
          {responsibilities.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-4"
            >
              <div className="bg-[var(--color-firefly-gold)]/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-firefly-gold)]">
                {item.icon}
              </div>
              <p className="text-sm text-[var(--fg-secondary)]">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

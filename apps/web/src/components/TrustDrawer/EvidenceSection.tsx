'use client';

/**
 * EvidenceSection — Display corroborations/evidence in the TrustDrawer.
 */

import type { ReactElement } from 'react';
import type { Corroboration } from '@cocuyo/types';

interface EvidenceSectionProps {
  title: string;
  type: 'supporting' | 'challenging';
  corroborations: Corroboration[];
}

/** Map evidence type to display label */
const EVIDENCE_TYPE_DISPLAY: Record<string, { label: string }> = {
  source_link: { label: 'Link' },
  document: { label: 'Document' },
  photo: { label: 'Photo' },
  observation: { label: 'Firsthand' },
};

/** Map corroboration type to display label */
const CORR_TYPE_DISPLAY: Record<string, { label: string }> = {
  witness: { label: 'Witness' },
  evidence: { label: 'Evidence' },
  expertise: { label: 'Expert' },
  challenge: { label: 'Challenge' },
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return minutes <= 1 ? 'just now' : `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(ts).toLocaleDateString();
}

export function EvidenceSection({
  title,
  type,
  corroborations,
}: EvidenceSectionProps): ReactElement {
  const accentColor = type === 'supporting' ? 'var(--fg-success)' : 'var(--fg-error)';

  return (
    <section>
      <h3
        className="mb-3 flex items-center gap-2 text-sm font-medium"
        style={{ color: accentColor }}
      >
        {title} ({corroborations.length})
      </h3>

      <div className="space-y-3">
        {corroborations.map((corr) => {
          const defaultType = { label: 'Evidence' };
          const corrType = CORR_TYPE_DISPLAY[corr.type] ?? defaultType;
          const evidenceType =
            corr.evidenceType !== undefined ? EVIDENCE_TYPE_DISPLAY[corr.evidenceType] : undefined;

          return (
            <div
              key={corr.id}
              className="rounded-nested border border-subtle bg-surface-container p-4"
            >
              {/* Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-secondary">{corrType.label}</span>
                  {evidenceType !== undefined && (
                    <>
                      <span className="text-tertiary">•</span>
                      <span className="text-xs text-tertiary">{evidenceType.label}</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-tertiary">{formatRelativeTime(corr.createdAt)}</span>
              </div>

              {/* Content */}
              {corr.evidenceContent !== undefined && (
                <div className="mb-2">
                  {corr.evidenceType === 'source_link' ? (
                    <a
                      href={corr.evidenceContent}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-[var(--fg-accent)] hover:underline"
                    >
                      {corr.evidenceContent}
                    </a>
                  ) : (
                    <p className="text-sm text-primary">{corr.evidenceContent}</p>
                  )}
                </div>
              )}

              {/* Description */}
              {corr.evidenceDescription !== undefined && (
                <p className="text-xs italic text-secondary">
                  &ldquo;{corr.evidenceDescription}&rdquo;
                </p>
              )}

              {/* Quality indicator */}
              <div className="mt-2 flex items-center gap-2 border-t border-subtle pt-2 text-xs text-tertiary">
                <span>Quality: {corr.quality}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

'use client';

/**
 * ResultsSummary — Shows filtered count with clear filters button.
 */

import type { ReactElement } from 'react';

interface ResultsSummaryProps {
  /** Whether any filters are active */
  isFiltered: boolean;
  /** Count after filtering */
  filteredCount: number;
  /** Total count before filtering */
  totalCount: number;
  /** Singular word for item (e.g., "campaign") */
  singularWord: string;
  /** Plural word for items (e.g., "campaigns") */
  pluralWord: string;
  /** "of" connector word */
  ofWord: string;
  /** Clear filters button label */
  clearLabel: string;
  /** Callback to clear all filters */
  onClear: () => void;
}

export function ResultsSummary({
  isFiltered,
  filteredCount,
  totalCount,
  singularWord,
  pluralWord,
  ofWord,
  clearLabel,
  onClear,
}: ResultsSummaryProps): ReactElement {
  const countWord = (isFiltered ? filteredCount : totalCount) === 1 ? singularWord : pluralWord;

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-secondary">
        {isFiltered ? (
          <>
            <span className="font-medium text-primary">{filteredCount}</span> {ofWord} {totalCount}{' '}
            {countWord}
          </>
        ) : (
          <>
            <span className="font-medium text-primary">{totalCount}</span> {countWord}
          </>
        )}
      </p>
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="font-medium text-[var(--color-firefly-gold)] hover:underline"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}

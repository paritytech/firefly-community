'use client';

/**
 * WorkbenchFilters — Filter bar for the verification workbench.
 *
 * Uses shared filter components for consistent UX.
 */

import { useMemo, type ReactElement } from 'react';
import type { ClaimStatus } from '@cocuyo/types';
import { FilterDropdown, type FilterOption } from '@/components/FilterDropdown';
import { SearchInput } from '@/components/SearchInput';
import { ResultsSummary } from '@/components/ResultsSummary';

interface WorkbenchFiltersTranslations {
  all: string;
  filterByTopic: string;
  filterByStatus: string;
  searchPlaceholder: string;
  topicSelected: string;
  topicsSelected: string;
  claimWord: string;
  claimsWord: string;
  ofWord: string;
  clearFilters: string;
  pending: string;
  underReview: string;
}

export interface WorkbenchFiltersProps {
  /** Available topics */
  topics: readonly string[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Currently selected status */
  activeStatus: ClaimStatus | null;
  /** Currently selected topics */
  activeTopics: readonly string[];
  /** Current search query */
  searchQuery: string;
  /** Callback when status changes */
  onStatusChange: (status: ClaimStatus | null) => void;
  /** Callback when topics change */
  onTopicsChange: (topics: readonly string[]) => void;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Total count before filtering */
  totalCount: number;
  /** Count after filtering */
  filteredCount: number;
  /** Translation strings */
  translations: WorkbenchFiltersTranslations;
}

export function WorkbenchFilters({
  topics,
  topicTranslations,
  activeStatus,
  activeTopics,
  searchQuery,
  onStatusChange,
  onTopicsChange,
  onSearchChange,
  totalCount,
  filteredCount,
  translations: t,
}: WorkbenchFiltersProps): ReactElement {
  const isFiltered = activeStatus !== null || activeTopics.length > 0 || searchQuery.length > 0;

  const statusOptions = useMemo<FilterOption<ClaimStatus | null>[]>(
    () => [
      { value: null, label: t.all },
      { value: 'pending', label: t.pending },
      { value: 'under_review', label: t.underReview },
    ],
    [t]
  );

  const topicOptions = useMemo<FilterOption<string>[]>(
    () =>
      topics.map((topic) => ({
        value: topic,
        label: topicTranslations[topic] ?? topic.replace(/-/g, ' '),
      })),
    [topics, topicTranslations]
  );

  const handleClearAll = (): void => {
    onStatusChange(null);
    onTopicsChange([]);
    onSearchChange('');
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={t.searchPlaceholder}
          className="min-w-[200px] max-w-md flex-1"
        />

        {/* Status dropdown */}
        <FilterDropdown
          placeholder={t.filterByStatus}
          options={statusOptions}
          selected={activeStatus}
          mode="single"
          onChange={(value) => onStatusChange(value as ClaimStatus | null)}
          minWidth={140}
        />

        {/* Topic dropdown */}
        {topics.length > 0 && (
          <FilterDropdown
            placeholder={t.filterByTopic}
            options={topicOptions}
            selected={activeTopics}
            mode="multi"
            onChange={(value) => onTopicsChange(value as readonly string[])}
            selectedLabel={t.topicsSelected}
          />
        )}
      </div>

      {/* Results summary */}
      <ResultsSummary
        isFiltered={isFiltered}
        filteredCount={filteredCount}
        totalCount={totalCount}
        singularWord={t.claimWord}
        pluralWord={t.claimsWord}
        ofWord={t.ofWord}
        clearLabel={t.clearFilters}
        onClear={handleClearAll}
      />
    </div>
  );
}

'use client';

/**
 * PostFilters — Filter bar for the posts page.
 */

import { useCallback, type ReactElement } from 'react';

interface PostFiltersTranslations {
  all: string;
  filterByTopic: string;
  searchPlaceholder: string;
  topicSelected: string;
  topicsSelected: string;
  postWord: string;
  postsWord: string;
  ofWord: string;
  clearFilters: string;
}

export interface PostFiltersProps {
  /** Available topics */
  topics: readonly string[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Currently selected topics */
  activeTopics: readonly string[];
  /** Current search query */
  searchQuery: string;
  /** Callback when topics change */
  onTopicsChange: (topics: readonly string[]) => void;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Total count before filtering */
  totalCount: number;
  /** Count after filtering */
  filteredCount: number;
  /** Translation strings */
  translations: PostFiltersTranslations;
}

export function PostFilters({
  topics,
  topicTranslations,
  activeTopics,
  searchQuery,
  onTopicsChange,
  onSearchChange,
  totalCount,
  filteredCount,
  translations: t,
}: PostFiltersProps): ReactElement {
  const isFiltered = activeTopics.length > 0 || searchQuery.length > 0;

  const handleTopicToggle = useCallback(
    (topic: string) => {
      if (activeTopics.includes(topic)) {
        onTopicsChange(activeTopics.filter((t) => t !== topic));
      } else {
        onTopicsChange([...activeTopics, topic]);
      }
    },
    [activeTopics, onTopicsChange]
  );

  const handleClearFilters = useCallback(() => {
    onTopicsChange([]);
    onSearchChange('');
  }, [onTopicsChange, onSearchChange]);

  const countWord = filteredCount === 1 ? t.postWord : t.postsWord;

  return (
    <div className="space-y-4">
      {/* Search and topic filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="min-w-[200px] max-w-md flex-1">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="focus:ring-[var(--color-firefly-gold)]/50 focus:border-[var(--color-firefly-gold)]/50 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:outline-none focus:ring-1"
          />
        </div>

        {/* Topic dropdown or chips */}
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 6).map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => handleTopicToggle(topic)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                activeTopics.includes(topic)
                  ? 'border-[var(--color-firefly-gold)] bg-[var(--color-firefly-gold)] text-[var(--bg-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface-nested)] text-[var(--fg-secondary)] hover:border-[var(--fg-tertiary)]'
              } `}
            >
              {topicTranslations[topic] ?? topic.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Results count and clear filters */}
      <div className="flex items-center justify-between text-sm text-[var(--fg-secondary)]">
        <span>
          {isFiltered ? (
            <>
              {filteredCount} {t.ofWord} {totalCount} {countWord}
            </>
          ) : (
            <>
              {totalCount} {countWord}
            </>
          )}
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-[var(--color-firefly-gold)] hover:underline"
          >
            {t.clearFilters}
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * StoryLinkSection — Link post to existing or new story chains.
 *
 * Shows:
 * - Suggested chains based on topics (if any)
 * - "Browse all stories" expandable section
 * - "Create new story" inline form
 */

import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { useLocale } from 'next-intl';
import type { ChainId, ChainPreview } from '@cocuyo/types';
import { chainService } from '@/lib/services/service-instances';

interface StoryLinkSectionProps {
  suggestedChains: ChainPreview[];
  selectedChains: ChainId[];
  onChainToggle: (chainId: ChainId) => void;
  onCreateStory: (title: string, description: string) => void;
  isLoadingSuggestions: boolean;
}

type Locale = 'en' | 'es';

export function StoryLinkSection({
  suggestedChains,
  selectedChains,
  onChainToggle,
  onCreateStory,
  isLoadingSuggestions,
}: StoryLinkSectionProps): ReactElement {
  const locale = useLocale() as Locale;
  const [showBrowseAll, setShowBrowseAll] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [allChains, setAllChains] = useState<ChainPreview[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // New story form state
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch all chains when "Browse all" is expanded
  useEffect(() => {
    if (showBrowseAll && allChains.length === 0) {
      setIsLoadingAll(true);
      chainService
        .getFeaturedChains(locale)
        .then((chains) => {
          if (mountedRef.current) {
            setAllChains([...chains]);
          }
        })
        .catch(() => {
          // Silently fail - user can retry
        })
        .finally(() => {
          if (mountedRef.current) {
            setIsLoadingAll(false);
          }
        });
    }
  }, [showBrowseAll, allChains.length, locale]);

  const handleCreateStory = useCallback(() => {
    if (newStoryTitle.trim().length === 0) return;
    onCreateStory(newStoryTitle.trim(), newStoryDescription.trim());
    setNewStoryTitle('');
    setNewStoryDescription('');
    setShowCreateNew(false);
  }, [newStoryTitle, newStoryDescription, onCreateStory]);

  // Combine suggested + all chains, removing duplicates
  const displayChains = showBrowseAll
    ? [...new Map([...suggestedChains, ...allChains].map((c) => [c.id, c])).values()]
    : suggestedChains;

  // Sort: selected first, then by corroboration count
  const sortedChains = [...displayChains].sort((a, b) => {
    const aSelected = selectedChains.includes(a.id);
    const bSelected = selectedChains.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return b.corroborationCount - a.corroborationCount;
  });

  const hasSelectedChains = selectedChains.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-primary">
            Link to Story
            {hasSelectedChains && (
              <span className="ml-2 text-xs text-[var(--fg-accent)]">
                ({selectedChains.length} selected)
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-tertiary">
            Connect your post to an ongoing story chain
          </p>
        </div>
      </div>

      {/* Loading suggestions indicator */}
      {isLoadingSuggestions && suggestedChains.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Finding related stories...
        </div>
      )}

      {/* Chain list */}
      {sortedChains.length > 0 && (
        <div className="space-y-2">
          {sortedChains.slice(0, showBrowseAll ? 20 : 5).map((chain) => {
            const isSelected = selectedChains.includes(chain.id);
            return (
              <label
                key={chain.id}
                className={`flex cursor-pointer items-start gap-3 rounded-nested border p-3 transition-all ${
                  isSelected
                    ? 'border-[var(--fg-accent)]/50 bg-surface-nested'
                    : 'border-DEFAULT bg-surface-nested hover:border-emphasis'
                } `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onChainToggle(chain.id)}
                  className="mt-0.5 h-4 w-4 rounded border-emphasis bg-surface-muted text-[var(--fg-accent)] focus:ring-[var(--fg-accent)] focus:ring-offset-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-primary">
                    {chain.title}
                  </span>
                  <div className="mt-1 flex items-center gap-3 text-xs text-tertiary">
                    <span>{chain.postCount} posts</span>
                    <span className="text-[var(--fg-success)]">
                      {chain.corroborationCount} corroborations
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Browse all / Create new buttons */}
      <div className="flex flex-wrap gap-2">
        {!showBrowseAll && (
          <button
            type="button"
            onClick={() => setShowBrowseAll(true)}
            className="text-sm text-[var(--fg-accent)] hover:underline"
          >
            {isLoadingAll ? 'Loading...' : 'Browse all stories →'}
          </button>
        )}
        {showBrowseAll && sortedChains.length > 5 && (
          <button
            type="button"
            onClick={() => setShowBrowseAll(false)}
            className="text-sm text-secondary hover:text-primary"
          >
            Show less
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCreateNew(!showCreateNew)}
          className="text-sm text-[var(--fg-accent)] hover:underline"
        >
          {showCreateNew ? 'Cancel' : '+ Create new story'}
        </button>
      </div>

      {/* Create new story inline form */}
      {showCreateNew && (
        <div className="space-y-3 rounded-nested border border-DEFAULT bg-surface-nested p-4">
          <div>
            <label
              htmlFor="new-story-title"
              className="mb-1 block text-xs font-medium text-secondary"
            >
              Story Title
            </label>
            <input
              id="new-story-title"
              type="text"
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="Give your story a name..."
              className="w-full rounded-nested border border-DEFAULT bg-surface-muted px-3 py-2 text-sm text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="new-story-desc"
              className="mb-1 block text-xs font-medium text-secondary"
            >
              Description <span className="font-normal text-tertiary">(optional)</span>
            </label>
            <textarea
              id="new-story-desc"
              value={newStoryDescription}
              onChange={(e) => setNewStoryDescription(e.target.value)}
              placeholder="What is this story about?"
              rows={2}
              className="w-full resize-none rounded-nested border border-DEFAULT bg-surface-muted px-3 py-2 text-sm text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateStory}
            disabled={newStoryTitle.trim().length === 0}
            className="w-full rounded-nested bg-[var(--fg-accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create & Link Story
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoadingSuggestions && sortedChains.length === 0 && !showCreateNew && (
        <p className="text-sm text-tertiary">
          No stories found. Add topics to see suggestions, or create a new story.
        </p>
      )}
    </div>
  );
}

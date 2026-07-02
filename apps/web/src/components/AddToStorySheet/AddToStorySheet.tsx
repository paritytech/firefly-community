'use client';

/**
 * AddToStorySheet — Sheet for adding a post to a story chain.
 *
 * Two modes:
 * - Create new story with title and description
 * - Add to existing story from user's stories
 */

import { useEffect, useRef, useCallback, useState, type ReactElement } from 'react';
import type { ChainId } from '@cocuyo/types';
import { useToast } from '@cocuyo/ui';
import { useAddToStory } from './AddToStoryProvider';
import { useAppState } from '@/components/AppStateProvider';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Mode = 'select' | 'create';

export function AddToStorySheet(): ReactElement | null {
  const { isOpen, post, closeSheet } = useAddToStory();
  const { getAllStories, createStory, addPostToStory } = useAppState();
  const { addToast } = useToast();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // The post is supplied directly by the opener, so this works for any post
  // regardless of whether it lives in the in-memory seed map.
  const postId = post?.id ?? null;
  const stories = getAllStories();

  // Form state
  const [mode, setMode] = useState<Mode>('select');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      setMode(stories.length > 0 ? 'select' : 'create');
      setTitle('');
      setDescription('');
      setIsSubmitting(false);
    }
  }, [isOpen, stories.length]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeSheet();
      }
    },
    [closeSheet]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        closeSheet();
      }
    },
    [closeSheet]
  );

  // Setup event listeners
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable !== null && firstFocusable !== undefined) {
        firstFocusable.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  // Handle creating a new story
  const handleCreateStory = useCallback((): void => {
    if (post === null || title.trim().length === 0) return;

    setIsSubmitting(true);
    // Seed the new story's topics from the post so it stays discoverable.
    const result = createStory(title.trim(), description.trim(), post.id, [...post.context.topics]);

    if (result !== null) {
      closeSheet();
    } else {
      setIsSubmitting(false);
      addToast('Could not create story. Please try again.', 'error');
    }
  }, [post, title, description, createStory, closeSheet, addToast]);

  // Handle adding to existing story
  const handleAddToStory = useCallback(
    (chainId: ChainId): void => {
      if (postId === null) return;

      setIsSubmitting(true);
      const success = addPostToStory(chainId, postId);

      if (success) {
        closeSheet();
      } else {
        setIsSubmitting(false);
        addToast('Could not add to story. Please try again.', 'error');
      }
    },
    [postId, addPostToStory, closeSheet, addToast]
  );

  if (!isOpen || post === null || postId === null) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-story-title"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="animate-backdrop-in absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="animate-slide-up sm:animate-scale-in relative max-h-[90vh] w-full overflow-y-auto rounded-t-container border border-DEFAULT bg-surface-nested shadow-3 sm:max-w-lg sm:rounded-container"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-DEFAULT border-b bg-surface-nested p-4 sm:p-6">
          <h2 id="add-to-story-title" className="text-xl font-bold text-primary">
            Add to Story
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            className="rounded-nested p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-4 sm:p-6">
          {/* Post preview */}
          <div className="rounded-nested border border-subtle bg-surface-container p-4">
            {post.content.title !== undefined && (
              <p className="mb-1 text-sm font-medium text-primary">{post.content.title}</p>
            )}
            <p className="line-clamp-2 text-sm text-secondary">{post.content.text}</p>
          </div>

          {/* Mode tabs */}
          {stories.length > 0 && (
            <div className="flex gap-2 border-b border-subtle">
              <button
                type="button"
                onClick={() => setMode('select')}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'select'
                    ? 'border-[var(--fg-accent)] text-[var(--fg-accent)]'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                Existing Stories
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'create'
                    ? 'border-[var(--fg-accent)] text-[var(--fg-accent)]'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                New Story
              </button>
            </div>
          )}

          {/* Select existing story */}
          {mode === 'select' && stories.length > 0 && (
            <div className="space-y-3">
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => handleAddToStory(story.id)}
                  disabled={isSubmitting || story.postIds.includes(postId)}
                  className="w-full rounded-nested border border-subtle bg-surface-container p-4 text-left transition-colors hover:border-[var(--fg-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-primary">{story.title}</p>
                  <p className="mt-1 text-xs text-tertiary">
                    {story.stats.postCount} posts
                    {story.postIds.includes(postId) && ' • Already in this story'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Create new story form */}
          {mode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-primary">Story Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your story a name..."
                  className="w-full rounded-nested border border-DEFAULT bg-surface-container px-4 py-3 text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-primary">
                  Description
                  <span className="font-normal text-tertiary"> (optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this story about?"
                  rows={3}
                  className="w-full resize-none rounded-nested border border-DEFAULT bg-surface-container px-4 py-3 text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateStory}
                disabled={title.trim().length === 0 || isSubmitting}
                className="w-full rounded-nested bg-[var(--fg-accent)] px-6 py-3 font-medium text-[var(--bg-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Story'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

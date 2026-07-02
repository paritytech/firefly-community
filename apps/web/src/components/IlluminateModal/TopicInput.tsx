'use client';

/**
 * TopicInput — Tag selector for signal topics.
 *
 * Features:
 * - Selected topics displayed as removable pills
 * - Suggestions dropdown with existing topics
 * - Add on Enter or comma
 * - Remove on backspace when input is empty
 */

import { useState, useCallback, useRef, type ReactElement, type KeyboardEvent } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface TopicInputProps {
  id?: string;
  topics: string[];
  onChange: (topics: string[]) => void;
  placeholder?: string;
}

// Common topics in the network (would come from API in production)
const SUGGESTED_TOPICS = [
  'media',
  'disinformation',
  'venezuela',
  'social-media',
  'politics',
  'economy',
  'health',
  'infrastructure',
  'governance',
  'finance',
  'transparency',
  'crisis',
  'daily-life',
  'medication',
  'food-security',
  'inflation',
  'wages',
];

export function TopicInput({
  id,
  topics,
  onChange,
  placeholder = 'Add a topic',
}: TopicInputProps): ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and already selected topics
  const filteredSuggestions = SUGGESTED_TOPICS.filter(
    (topic) => !topics.includes(topic) && topic.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addTopic = useCallback(
    (topic: string): void => {
      const normalized = topic.toLowerCase().trim().replace(/\s+/g, '-');
      if (normalized.length > 0 && !topics.includes(normalized)) {
        onChange([...topics, normalized]);
      }
      setInputValue('');
      setHighlightedIndex(-1);
    },
    [topics, onChange]
  );

  const removeTopic = useCallback(
    (topicToRemove: string): void => {
      onChange(topics.filter((t) => t !== topicToRemove));
    },
    [topics, onChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value;
      // Check for comma to add topic
      if (value.includes(',')) {
        const parts = value.split(',');
        const topicToAdd = parts[0];
        if (topicToAdd != null) {
          addTopic(topicToAdd);
        }
      } else {
        setInputValue(value);
        setShowSuggestions(value.length > 0);
        setHighlightedIndex(-1);
      }
    },
    [addTopic]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
            const suggestion = filteredSuggestions[highlightedIndex];
            if (suggestion != null) {
              addTopic(suggestion);
            }
          } else if (inputValue.trim().length > 0) {
            addTopic(inputValue);
          }
          break;

        case 'Backspace':
          if (inputValue.length === 0 && topics.length > 0) {
            const lastTopic = topics[topics.length - 1];
            if (lastTopic != null) {
              removeTopic(lastTopic);
            }
          }
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (showSuggestions && filteredSuggestions.length > 0) {
            setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (showSuggestions && filteredSuggestions.length > 0) {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
          }
          break;

        case 'Escape':
          setShowSuggestions(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [
      inputValue,
      topics,
      filteredSuggestions,
      highlightedIndex,
      showSuggestions,
      addTopic,
      removeTopic,
    ]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string): void => {
      addTopic(suggestion);
      inputRef.current?.focus();
    },
    [addTopic]
  );

  // Close suggestions when clicking outside
  const closeSuggestions = useCallback((): void => setShowSuggestions(false), []);
  useClickOutside(containerRef, closeSuggestions);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3 transition-colors focus-within:border-[var(--color-accent)]"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected topic pills */}
        {topics.map((topic) => (
          <span
            key={topic}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-sm text-[var(--color-text-primary)]"
          >
            {topic}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTopic(topic);
              }}
              className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
              aria-label={`Remove ${topic}`}
            >
              <svg
                className="h-3 w-3"
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
          </span>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.length > 0 || filteredSuggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={topics.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none"
          autoComplete="off"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-controls={showSuggestions ? 'topic-suggestions' : undefined}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          id="topic-suggestions"
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-lg"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`cursor-pointer px-4 py-2 text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
              } `}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

/**
 * FilterDropdown — Reusable dropdown component for filter bars.
 *
 * Supports single-select and multi-select modes with consistent styling.
 */

import { useState, useRef, useCallback, type ReactElement, type ReactNode } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export interface FilterOption<T> {
  value: T;
  label: string;
  color?: string;
}

interface FilterDropdownProps<T> {
  /** Button label when nothing selected */
  placeholder: string;
  /** Available options */
  options: readonly FilterOption<T>[];
  /** Currently selected value(s) */
  selected: T | readonly T[] | null;
  /** Selection mode */
  mode: 'single' | 'multi';
  /** Callback when selection changes */
  onChange: (value: T | readonly T[] | null) => void;
  /** Label for selected count in multi mode */
  selectedLabel?: string;
  /** Clear all label for multi mode */
  clearAllLabel?: string;
  /** Minimum width for dropdown button */
  minWidth?: number;
}

export function FilterDropdown<T extends string | null>({
  placeholder,
  options,
  selected,
  mode,
  onChange,
  selectedLabel = 'selected',
  clearAllLabel = 'Clear all',
  minWidth = 160,
}: FilterDropdownProps<T>): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);
  useEscapeKey(closeDropdown, isOpen);

  const isMulti = mode === 'multi';
  const selectedArray = isMulti ? (selected as readonly T[]) : [];
  const selectedSingle = !isMulti ? (selected as T | null) : null;
  const hasSelection = isMulti ? selectedArray.length > 0 : selectedSingle !== null;

  const getButtonLabel = (): ReactNode => {
    if (!hasSelection) return placeholder;

    if (isMulti) {
      if (selectedArray.length === 1) {
        const opt = options.find((o) => o.value === selectedArray[0]);
        return opt?.label ?? placeholder;
      }
      return `${selectedArray.length} ${selectedLabel}`;
    }

    const opt = options.find((o) => o.value === selectedSingle);
    return (
      <>
        {opt?.color !== undefined && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
        )}
        <span>{opt?.label ?? placeholder}</span>
      </>
    );
  };

  const handleSelect = (value: T): void => {
    if (isMulti) {
      const arr = selectedArray as T[];
      if (arr.includes(value)) {
        onChange(arr.filter((v) => v !== value));
      } else {
        onChange([...arr, value]);
      }
    } else {
      onChange(value);
      setIsOpen(false);
    }
  };

  const handleClearAll = (): void => {
    onChange(isMulti ? [] : null);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
          hasSelection
            ? 'bg-[var(--color-firefly-gold)]/10 border-[var(--color-firefly-gold)]/30 text-[var(--color-firefly-gold)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-surface-nested)] text-secondary hover:border-[var(--border-emphasis)]'
        } `}
        style={{ minWidth }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {getButtonLabel()}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[220px] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-container)] shadow-3"
          role="listbox"
          aria-multiselectable={isMulti}
        >
          {isMulti && selectedArray.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full border-b border-[var(--border-subtle)] px-3 py-2 text-left text-xs text-tertiary hover:text-secondary"
            >
              {clearAllLabel}
            </button>
          )}
          {options.map((option) => {
            const isSelected = isMulti
              ? selectedArray.includes(option.value)
              : selectedSingle === option.value;

            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? isMulti
                      ? 'bg-[var(--color-firefly-gold)]/10 text-[var(--color-firefly-gold)]'
                      : 'bg-[var(--bg-surface-hover)] font-medium text-primary'
                    : 'text-secondary hover:bg-[var(--bg-surface-hover)] hover:text-primary'
                } `}
              >
                {isMulti && (
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-[var(--color-firefly-gold)] bg-[var(--color-firefly-gold)]'
                        : 'border-[var(--border-emphasis)]'
                    } `}
                  >
                    {isSelected && (
                      <svg
                        className="h-3 w-3 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                )}
                {option.color !== undefined && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

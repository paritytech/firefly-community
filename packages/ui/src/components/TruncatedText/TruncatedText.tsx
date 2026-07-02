/**
 * TruncatedText — Text with expandable truncation.
 *
 * Shows truncated text with a "read more" button that expands inline.
 */

'use client';

import { useState, type ReactElement } from 'react';

export interface TruncatedTextProps {
  /** Full text content */
  text: string;
  /** Maximum characters before truncation */
  maxLength?: number;
  /** "Read more" button text */
  expandLabel?: string;
  /** "Read less" button text */
  collapseLabel?: string;
  /** Additional className for the text */
  className?: string;
}

export function TruncatedText({
  text,
  maxLength = 280,
  expandLabel = 'Read more',
  collapseLabel = 'Read less',
  className = '',
}: TruncatedTextProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxLength;

  if (!shouldTruncate) {
    return <span className={className}>{text}</span>;
  }

  const displayText = isExpanded ? text : `${text.slice(0, maxLength).trim()}...`;

  return (
    <span className={className}>
      {displayText}{' '}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="font-medium text-[var(--fg-accent)] hover:underline"
      >
        {isExpanded ? collapseLabel : expandLabel}
      </button>
    </span>
  );
}

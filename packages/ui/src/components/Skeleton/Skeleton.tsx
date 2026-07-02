/**
 * Skeleton — Loading placeholder for content.
 *
 * Displays animated placeholder shapes while content loads.
 * Use to prevent layout shift and indicate loading state.
 */

import type { ReactElement } from 'react';

export interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape variant */
  variant?: 'text' | 'rectangular' | 'circular';
  /** Additional className */
  className?: string;
}

export function Skeleton({
  width,
  height,
  variant = 'text',
  className = '',
}: SkeletonProps): ReactElement {
  const baseClasses = 'animate-pulse bg-[var(--bg-surface-container)] overflow-hidden';

  const variantClasses = {
    text: 'rounded-nested',
    rectangular: 'rounded-nested',
    circular: 'rounded-full',
  };

  const defaultDimensions = {
    text: { width: '100%', height: '1em' },
    rectangular: { width: '100%', height: '100px' },
    circular: { width: '40px', height: '40px' },
  };

  const style: React.CSSProperties = {
    width: width ?? defaultDimensions[variant].width,
    height: height ?? defaultDimensions[variant].height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
}

/** Pre-built skeleton for text content */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}): ReactElement {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/** Pre-built skeleton for card content */
export function SkeletonCard({ className = '' }: { className?: string }): ReactElement {
  return (
    <div
      className={`rounded-container space-y-4 bg-[var(--bg-surface-container)] p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" height={14} />
          <Skeleton variant="text" width="25%" height={12} />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" width={80} height={24} />
        <Skeleton variant="rectangular" width={80} height={24} />
      </div>
    </div>
  );
}

/** Skeleton for PostCard */
export function SkeletonPostCard({ className = '' }: { className?: string }): ReactElement {
  return (
    <div
      className={`rounded-container space-y-4 border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 ${className}`}
    >
      {/* Title */}
      <Skeleton variant="text" width="75%" height={20} />
      {/* Excerpt */}
      <SkeletonText lines={2} />
      {/* Meta row */}
      <div className="flex items-center gap-3">
        <Skeleton variant="rectangular" width={60} height={20} />
        <Skeleton variant="rectangular" width={60} height={20} />
        <Skeleton variant="rectangular" width={80} height={20} />
      </div>
      {/* Stats */}
      <div className="flex gap-4">
        <Skeleton variant="text" width={80} height={14} />
        <Skeleton variant="text" width={80} height={14} />
      </div>
    </div>
  );
}

/** Skeleton for ClaimCard */
export function SkeletonClaimCard({ className = '' }: { className?: string }): ReactElement {
  return (
    <div
      className={`rounded-container space-y-3 border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 ${className}`}
    >
      {/* Status badge */}
      <Skeleton variant="rectangular" width={80} height={22} className="rounded-full" />
      {/* Statement */}
      <SkeletonText lines={2} />
      {/* Topics */}
      <div className="flex gap-2">
        <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
        <Skeleton variant="rectangular" width={70} height={20} className="rounded-full" />
      </div>
      {/* Evidence stats */}
      <div className="flex gap-4">
        <Skeleton variant="text" width={100} height={14} />
        <Skeleton variant="text" width={100} height={14} />
      </div>
    </div>
  );
}

/** Skeleton for FeedPostCard */
export function SkeletonFeedPostCard({ className = '' }: { className?: string }): ReactElement {
  return (
    <div
      className={`rounded-container space-y-4 border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-5 ${className}`}
    >
      {/* Author row */}
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={36} height={36} />
        <div className="flex-1 space-y-1">
          <Skeleton variant="text" width="35%" height={14} />
          <Skeleton variant="text" width="20%" height={12} />
        </div>
        <Skeleton variant="rectangular" width={70} height={22} className="rounded-full" />
      </div>
      {/* Content */}
      <SkeletonText lines={3} />
      {/* Topics */}
      <div className="flex gap-2">
        <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
        <Skeleton variant="rectangular" width={80} height={20} className="rounded-full" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
        <div className="flex gap-4">
          <Skeleton variant="text" width={50} height={14} />
          <Skeleton variant="text" width={50} height={14} />
        </div>
        <Skeleton variant="text" width={80} height={14} />
      </div>
    </div>
  );
}

'use client';

/**
 * PostsHeader — Header for the posts page.
 */

import type { ReactElement } from 'react';

export interface PostsHeaderProps {
  title: string;
  description: string;
}

export function PostsHeader({ title, description }: PostsHeaderProps): ReactElement {
  return (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <div className="container-wide py-8">
        <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">{title}</h1>
        <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{description}</p>
      </div>
    </header>
  );
}

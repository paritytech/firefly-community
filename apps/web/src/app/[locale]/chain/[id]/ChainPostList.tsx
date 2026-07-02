'use client';

/**
 * Post list component for chain detail page.
 * Shows posts as a timeline with corroboration actions.
 */

import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Post, CorroborationType } from '@cocuyo/types';
import { useFormatters } from '@/hooks/useFormatters';
import { ExternalLink } from '@/components/ExternalLink';

interface ChainPostListProps {
  posts: Post[];
}

interface CorroborationModalProps {
  post: Post;
  onClose: () => void;
  onSubmit: (type: CorroborationType, note: string) => void;
  translations: {
    title: string;
    stakingWarning: string;
    witness: string;
    witnessDesc: string;
    evidence: string;
    evidenceDesc: string;
    expertise: string;
    expertiseDesc: string;
    challenge: string;
    challengeDesc: string;
    noteLabel: string;
    notePlaceholder: string;
    cancel: string;
    submitChallenge: string;
    corroborate: string;
  };
}

function CorroborationModal({
  post: _post,
  onClose,
  onSubmit,
  translations: t,
}: CorroborationModalProps): ReactElement {
  const [selectedType, setSelectedType] = useState<CorroborationType | null>(null);
  const [note, setNote] = useState('');

  const corroborationTypes: { type: CorroborationType; label: string; description: string }[] = [
    {
      type: 'witness',
      label: t.witness,
      description: t.witnessDesc,
    },
    {
      type: 'evidence',
      label: t.evidence,
      description: t.evidenceDesc,
    },
    {
      type: 'expertise',
      label: t.expertise,
      description: t.expertiseDesc,
    },
    {
      type: 'challenge',
      label: t.challenge,
      description: t.challengeDesc,
    },
  ];

  const handleSubmit = (): void => {
    if (selectedType != null) {
      onSubmit(selectedType, note);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-6">
        <h3 className="mb-2 text-xl font-semibold">{t.title}</h3>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">{t.stakingWarning}</p>

        <div className="mb-6 space-y-3">
          {corroborationTypes.map((ct) => (
            <button
              key={ct.type}
              type="button"
              onClick={() => setSelectedType(ct.type)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selectedType === ct.type
                  ? ct.type === 'challenge'
                    ? 'border-[var(--color-challenged)] bg-[rgba(248,113,113,0.1)]'
                    : 'border-[var(--color-accent)] bg-[var(--color-accent-glow)]'
                  : 'border-[var(--color-border-default)] hover:border-[var(--color-border-emphasis)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg ${
                    ct.type === 'challenge'
                      ? 'text-[var(--color-challenged)]'
                      : selectedType === ct.type
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {ct.type === 'witness' && '◉'}
                  {ct.type === 'evidence' && '◆'}
                  {ct.type === 'expertise' && '◈'}
                  {ct.type === 'challenge' && '△'}
                </span>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{ct.label}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{ct.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label
            htmlFor="corroboration-note"
            className="mb-2 block text-sm text-[var(--color-text-secondary)]"
          >
            {t.noteLabel}
          </label>
          <textarea
            id="corroboration-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[var(--color-border-default)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text-primary)]"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedType == null}
            className={`flex-1 rounded-md px-4 py-2 text-sm transition-colors ${
              selectedType == null
                ? 'cursor-not-allowed bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]'
                : selectedType === 'challenge'
                  ? 'bg-[var(--color-challenged)] text-[var(--color-text-primary)] hover:opacity-90'
                  : 'bg-[var(--color-accent)] text-black hover:opacity-90'
            }`}
          >
            {selectedType === 'challenge' ? t.submitChallenge : t.corroborate}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChainPostList({ posts }: ChainPostListProps): ReactElement {
  const [corroboratingPost, setCorroboratingPost] = useState<Post | null>(null);
  const { formatRelativeTime } = useFormatters();
  const t = useTranslations('corroboration');

  const handleCorroborate = (type: CorroborationType, note: string): void => {
    // In real implementation, this would submit to the chain
    alert(`Corroboration submitted: ${type}${note ? ` - "${note}"` : ''}`);
    setCorroboratingPost(null);
  };

  const modalTranslations = {
    title: t('modal.title'),
    stakingWarning: t('modal.stakingWarning'),
    witness: t('types.witness'),
    witnessDesc: t('types.witnessDesc'),
    evidence: t('types.evidence'),
    evidenceDesc: t('types.evidenceDesc'),
    expertise: t('types.expertise'),
    expertiseDesc: t('types.expertiseDesc'),
    challenge: t('types.challenge'),
    challengeDesc: t('types.challengeDesc'),
    noteLabel: t('modal.noteLabel'),
    notePlaceholder: t('modal.notePlaceholder'),
    cancel: t('modal.cancel'),
    submitChallenge: t('modal.submitChallenge'),
    corroborate: t('modal.corroborate'),
  };

  return (
    <>
      <div className="relative">
        {/* Timeline line */}
        <div
          className="absolute bottom-0 left-4 top-0 w-px bg-[var(--color-border-default)]"
          aria-hidden="true"
        />

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post, index) => (
            <article
              key={post.id}
              className={`relative pl-12 ${index < 10 ? 'animate-stagger-item' : ''}`}
              style={{ '--stagger-index': index } as React.CSSProperties}
            >
              {/* Timeline dot */}
              <div
                className="absolute left-2 top-6 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--color-border-emphasis)] bg-[var(--color-bg-primary)]"
                aria-hidden="true"
              >
                <span className="text-xs" style={{ color: 'var(--color-accent)' }}>
                  {index + 1}
                </span>
              </div>

              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-6">
                {/* Context */}
                <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  {post.context.topics.length > 0 && (
                    <span className="capitalize">{post.context.topics[0]}</span>
                  )}
                  {post.context.locationName != null && (
                    <>
                      <span aria-hidden="true">&middot;</span>
                      <span>{post.context.locationName}</span>
                    </>
                  )}
                  <span aria-hidden="true">&middot;</span>
                  <time dateTime={new Date(post.createdAt).toISOString()}>
                    {formatRelativeTime(post.createdAt)}
                  </time>
                </div>

                {/* Content */}
                <p className="mb-4 text-base leading-relaxed text-[var(--color-text-primary)]">
                  {post.content.text}
                </p>

                {/* Links if any */}
                {post.content.links != null && post.content.links.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs text-[var(--color-text-tertiary)]">
                      {t('referencedLinks')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {post.content.links.map((link, i) => (
                        <ExternalLink
                          key={i}
                          href={link}
                          className="text-sm text-[var(--color-accent)] hover:underline"
                        >
                          {t('source')} {i + 1}
                        </ExternalLink>
                      ))}
                    </div>
                  </div>
                )}

                {/* Corroboration stats */}
                <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4">
                  <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1">
                      <span className="text-[var(--color-corroborated)]">◉</span>
                      <span>
                        <span className="text-[var(--color-corroborated)]">
                          {post.corroborations.witnessCount + post.corroborations.expertiseCount}
                        </span>
                      </span>
                    </span>
                    {post.corroborations.evidenceCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span>◆</span>
                        <span>{post.corroborations.evidenceCount}</span>
                      </span>
                    )}
                    {post.corroborations.challengeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-challenged)]">△</span>
                        <span className="text-[var(--color-challenged)]">
                          {post.corroborations.challengeCount}
                        </span>
                      </span>
                    )}
                    <span className="text-[var(--color-text-tertiary)]">
                      {t('evidence')}: {post.corroborations.evidenceCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCorroboratingPost(post)}
                    className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                  >
                    {t('modal.corroborate')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Corroboration Modal */}
      {corroboratingPost != null && (
        <CorroborationModal
          post={corroboratingPost}
          onClose={() => setCorroboratingPost(null)}
          onSubmit={handleCorroborate}
          translations={modalTranslations}
        />
      )}
    </>
  );
}

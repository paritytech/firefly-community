'use client';

/**
 * ReputationRadar — Visual display of topic-weighted reputation.
 *
 * A simple bar chart showing reputation scores across topics.
 * (A full radar chart would be implemented with a charting library.)
 */

import type { ReactElement } from 'react';

export interface ReputationRadarProps {
  /** Reputation scores by topic (0-100) */
  scores: Record<string, number>;
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
}

export function ReputationRadar({ scores, topicTranslations }: ReputationRadarProps): ReactElement {
  const topics = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-4">
      {topics.map(([topic, score]) => (
        <div key={topic}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm capitalize text-[var(--fg-secondary)]">
              {topicTranslations[topic] ?? topic.replace(/-/g, ' ')}
            </span>
            <span className="text-sm font-medium text-[var(--fg-primary)]">{score}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-container)]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${score}%`,
                backgroundColor: getScoreColor(score),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Get color based on reputation score.
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--fg-success)';
  if (score >= 60) return 'var(--color-firefly-gold)';
  if (score >= 40) return 'var(--fg-warning)';
  return 'var(--fg-error)';
}

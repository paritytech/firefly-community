'use client';

/**
 * ChainTabs — Tabbed navigation for story chain detail page.
 *
 * Tabs:
 * - What's Happening: Latest posts (raw observations)
 * - Deep Dives: Analysis posts related to this chain
 * - Help Needed: Active campaigns for this chain
 */

import { useState, type ReactElement, type ReactNode } from 'react';

type TabId = 'whats-happening' | 'deep-dives' | 'help-needed';

interface Tab {
  id: TabId;
  label: string;
  count?: number;
  hasContent: boolean;
}

interface ChainTabsProps {
  /** Signals content */
  signalsContent: ReactNode;
  /** Posts/analysis content */
  postsContent: ReactNode;
  /** Campaigns content */
  campaignsContent: ReactNode;
  /** Counts for badges */
  signalsCount: number;
  postsCount: number;
  campaignsCount: number;
  /** Translation strings */
  translations: {
    whatsHappening: string;
    deepDives: string;
    helpNeeded: string;
  };
}

export function ChainTabs({
  signalsContent,
  postsContent,
  campaignsContent,
  signalsCount,
  postsCount,
  campaignsCount,
  translations: t,
}: ChainTabsProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('whats-happening');

  const tabs: Tab[] = [
    {
      id: 'whats-happening',
      label: t.whatsHappening,
      count: signalsCount,
      hasContent: signalsCount > 0,
    },
    { id: 'deep-dives', label: t.deepDives, count: postsCount, hasContent: postsCount > 0 },
    {
      id: 'help-needed',
      label: t.helpNeeded,
      count: campaignsCount,
      hasContent: campaignsCount > 0,
    },
  ];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const showGoldAccent =
            tab.id === 'help-needed' && tab.count !== undefined && tab.count > 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[var(--fg-primary)]'
                  : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              } `}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      showGoldAccent
                        ? 'bg-[var(--color-firefly-gold)]/20 text-[var(--color-firefly-gold)]'
                        : 'bg-[var(--bg-surface-nested)] text-[var(--fg-tertiary)]'
                    } `}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-firefly-gold)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="py-6">
        {activeTab === 'whats-happening' && signalsContent}
        {activeTab === 'deep-dives' && postsContent}
        {activeTab === 'help-needed' && campaignsContent}
      </div>
    </div>
  );
}

/**
 * ContributionHistoryTable — Shows contribution and withdrawal history.
 *
 * Displays a chronological list of all contributions and withdrawals
 * for the contributor's account.
 */

import type { ReactElement } from 'react';
import type { PUSDAmount } from '@cocuyo/types';

export interface HistoryEntry {
  /** Unique entry ID */
  readonly id: string;
  /** Type of transaction */
  readonly type: 'contribution' | 'withdrawal';
  /** Amount in pUSD */
  readonly amount: PUSDAmount;
  /** Shares involved (received for contribution, withdrawn for withdrawal) */
  readonly shares: bigint;
  /** Transaction hash */
  readonly txHash: string;
  /** When the transaction occurred (Unix timestamp) */
  readonly timestamp: number;
}

interface ContributionHistoryTableTranslations {
  type: string;
  amount: string;
  shares: string;
  date: string;
  txHash: string;
  contribution: string;
  withdrawal: string;
  noHistory: string;
}

export interface ContributionHistoryTableProps {
  entries: readonly HistoryEntry[];
  translations: ContributionHistoryTableTranslations;
}

export function ContributionHistoryTable({
  entries,
  translations: t,
}: ContributionHistoryTableProps): ReactElement {
  // Format pUSD amount for display (6 decimals to dollars)
  const formatAmount = (amount: PUSDAmount): string => {
    const dollars = Number(amount) / 1_000_000;
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format shares for display (18 decimals)
  const formatShares = (shares: bigint): string => {
    const formatted = Number(shares) / 1e18;
    return formatted.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  // Format timestamp to readable date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Truncate transaction hash
  const formatTxHash = (hash: string): string => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
        <p className="text-[var(--fg-tertiary)]">{t.noHistory}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-container border border-[var(--border-default)]">
      <table className="w-full">
        <thead className="bg-[var(--bg-surface-container)]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--fg-secondary)]">
              {t.type}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-[var(--fg-secondary)]">
              {t.amount}
            </th>
            <th className="hidden px-4 py-3 text-right text-sm font-medium text-[var(--fg-secondary)] sm:table-cell">
              {t.shares}
            </th>
            <th className="hidden px-4 py-3 text-left text-sm font-medium text-[var(--fg-secondary)] md:table-cell">
              {t.date}
            </th>
            <th className="hidden px-4 py-3 text-left text-sm font-medium text-[var(--fg-secondary)] lg:table-cell">
              {t.txHash}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-surface-nested)]">
          {entries.map((entry) => (
            <tr key={entry.id} className="transition-colors hover:bg-[var(--bg-surface-container)]">
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    entry.type === 'contribution'
                      ? 'text-[var(--color-corroborated)]'
                      : 'text-[var(--fg-secondary)]'
                  }`}
                >
                  {entry.type === 'contribution' ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  )}
                  {entry.type === 'contribution' ? t.contribution : t.withdrawal}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-mono text-sm ${
                    entry.type === 'contribution'
                      ? 'text-[var(--color-corroborated)]'
                      : 'text-[var(--fg-primary)]'
                  }`}
                >
                  {entry.type === 'contribution' ? '+' : '-'}
                  {formatAmount(entry.amount)}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-right sm:table-cell">
                <span className="font-mono text-sm text-[var(--fg-secondary)]">
                  {formatShares(entry.shares)}
                </span>
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                <span className="text-sm text-[var(--fg-tertiary)]">
                  {formatDate(entry.timestamp)}
                </span>
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <code className="font-mono text-xs text-[var(--fg-tertiary)]">
                  {formatTxHash(entry.txHash)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

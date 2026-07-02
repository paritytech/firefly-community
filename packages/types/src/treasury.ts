/**
 * Treasury types — organizational fund management.
 *
 * Provides multi-sig treasury management for organizations with
 * budget categories, transaction tracking, and governance integration.
 */

import type {
  DIMCredential,
  OrganizationId,
  PolkadotAddress,
  TreasuryId,
  TransactionHash,
} from './brands';
import type { PUSDAmount } from './currency';
import { createPUSDAmount } from './currency';
import type { BudgetCategory } from './governance';

// Re-export BudgetCategory for convenience
export type { BudgetCategory } from './governance';

/**
 * Treasury transaction types.
 */
export type TreasuryTransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'allocation';

/**
 * Source of deposit funds (for income tracking).
 */
export type DepositSource = 'campaigns' | 'grants' | 'donations' | 'other';

/**
 * Treasury transaction status.
 */
export type TreasuryTransactionStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'cancelled';

/**
 * Treasury balance for an organization.
 */
export interface TreasuryBalance {
  /** Treasury identifier */
  readonly treasuryId: TreasuryId;
  /** Associated organization */
  readonly organizationId: OrganizationId;
  /** Total balance across all categories */
  readonly total: PUSDAmount;
  /** Available balance (total - escrowed) */
  readonly available: PUSDAmount;
  /** Amount currently escrowed (pending transactions) */
  readonly escrowed: PUSDAmount;
  /** Balance breakdown by category */
  readonly byCategory: Readonly<Record<BudgetCategory, PUSDAmount>>;
  /** Last updated timestamp */
  readonly updatedAt: number;
}

/**
 * A treasury transaction.
 */
export interface TreasuryTransaction {
  /** Transaction identifier */
  readonly id: string;
  /** Treasury this transaction belongs to */
  readonly treasuryId: TreasuryId;
  /** Type of transaction */
  readonly type: TreasuryTransactionType;
  /** Transaction amount */
  readonly amount: PUSDAmount;
  /** Budget category (for withdrawals/allocations) */
  readonly category?: BudgetCategory;
  /** Current status */
  readonly status: TreasuryTransactionStatus;
  /** Associated governance proposal ID (for governed transactions) */
  readonly proposalId?: string;
  /** Who initiated the transaction */
  readonly initiatedBy: DIMCredential;
  /** Signers who approved */
  readonly approvers: readonly DIMCredential[];
  /** Recipient address (for withdrawals/transfers) */
  readonly recipient?: PolkadotAddress;
  /** Source address (for deposits) */
  readonly source?: PolkadotAddress;
  /** Source type for deposits (campaigns, grants, donations, other) */
  readonly depositSource?: DepositSource;
  /** Purpose/description */
  readonly purpose: string;
  /** On-chain transaction hash (when executed) */
  readonly txHash?: TransactionHash;
  /** When initiated */
  readonly createdAt: number;
  /** When last updated */
  readonly updatedAt: number;
  /** When executed (if applicable) */
  readonly executedAt?: number;
}

/**
 * Treasury configuration.
 */
export interface TreasuryConfig {
  /** Treasury identifier */
  readonly treasuryId: TreasuryId;
  /** Associated organization */
  readonly organizationId: OrganizationId;
  /** Number of signatures required (multi-sig threshold) */
  readonly multisigThreshold: number;
  /** Authorized signers (wallet addresses) */
  readonly signers: readonly PolkadotAddress[];
  /** Daily spending limit (optional) */
  readonly dailyLimit?: PUSDAmount;
  /** Per-transaction limit before requiring full governance */
  readonly perTransactionLimit?: PUSDAmount;
  /** Budget category limits (optional) */
  readonly categoryLimits?: Readonly<Partial<Record<BudgetCategory, PUSDAmount>>>;
  /** Whether to require governance for all withdrawals */
  readonly requireGovernance: boolean;
  /** Contract address (when deployed) */
  readonly contractAddress?: PolkadotAddress;
  /** When config was last updated */
  readonly updatedAt: number;
}

/**
 * Budget summary for a time period.
 *
 * Note: When `isEstimate` is true, some values may be approximated:
 * - `startingBalance` may be zero if historical snapshots aren't available
 * - `incomeBySource` may have all income classified as 'donations' if source metadata isn't tracked
 */
export interface BudgetSummary {
  /** Treasury identifier */
  readonly treasuryId: TreasuryId;
  /** Period start (Unix timestamp) */
  readonly periodStart: number;
  /** Period end (Unix timestamp) */
  readonly periodEnd: number;
  /** Starting balance */
  readonly startingBalance: PUSDAmount;
  /** Ending balance */
  readonly endingBalance: PUSDAmount;
  /** Total income during period */
  readonly totalIncome: PUSDAmount;
  /** Total expenses during period */
  readonly totalExpenses: PUSDAmount;
  /** Income breakdown by source */
  readonly incomeBySource: {
    readonly campaigns: PUSDAmount;
    readonly grants: PUSDAmount;
    readonly donations: PUSDAmount;
    readonly other: PUSDAmount;
  };
  /** Expenses breakdown by category */
  readonly expensesByCategory: Readonly<Record<BudgetCategory, PUSDAmount>>;
  /** Monthly burn rate (expenses per month) */
  readonly burnRate: PUSDAmount;
  /** Runway in months (at current burn rate) */
  readonly runwayMonths: number;
  /** Whether this summary contains estimated/incomplete data */
  readonly isEstimate?: boolean;
}

/**
 * A point-in-time balance snapshot for historical tracking.
 */
export interface BalanceSnapshot {
  /** Treasury identifier */
  readonly treasuryId: TreasuryId;
  /** Snapshot timestamp */
  readonly timestamp: number;
  /** Balance at this point in time */
  readonly balance: PUSDAmount;
  /** Transaction that caused this snapshot (if any) */
  readonly transactionId?: string;
}

/**
 * Input for creating a new treasury.
 */
export interface NewTreasury {
  readonly organizationId: OrganizationId;
  readonly multisigThreshold: number;
  readonly signers: readonly PolkadotAddress[];
  readonly dailyLimit?: PUSDAmount;
  readonly perTransactionLimit?: PUSDAmount;
  readonly requireGovernance?: boolean;
}

/**
 * Input for proposing a withdrawal.
 */
export interface WithdrawalProposal {
  readonly treasuryId: TreasuryId;
  readonly amount: PUSDAmount;
  readonly category: BudgetCategory;
  readonly recipient: PolkadotAddress;
  readonly purpose: string;
}

/**
 * Treasury preview for listings.
 */
export interface TreasuryPreview {
  readonly treasuryId: TreasuryId;
  readonly organizationId: OrganizationId;
  readonly organizationName: string;
  readonly total: PUSDAmount;
  readonly available: PUSDAmount;
  readonly signerCount: number;
  readonly threshold: number;
}

/**
 * Helper to create an empty balance record.
 */
export function createEmptyBalance(
  treasuryId: TreasuryId,
  organizationId: OrganizationId
): TreasuryBalance {
  const zero = createPUSDAmount(0n);
  return {
    treasuryId,
    organizationId,
    total: zero,
    available: zero,
    escrowed: zero,
    byCategory: {
      editorial: zero,
      technology: zero,
      administration: zero,
      'field-operations': zero,
      legal: zero,
      'grants-out': zero,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Helper to check if a transaction requires additional approvals.
 */
export function requiresMoreApprovals(
  transaction: TreasuryTransaction,
  config: TreasuryConfig
): boolean {
  return transaction.approvers.length < config.multisigThreshold;
}

/**
 * Helper to check if a credential has already approved a transaction.
 */
export function hasApproved(transaction: TreasuryTransaction, credential: DIMCredential): boolean {
  return transaction.approvers.includes(credential);
}

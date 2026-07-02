/**
 * Treasury Service implementation with Bulletin storage.
 *
 * Provides multi-sig treasury management for organizations.
 * Uses session cache for immediate feedback and Bulletin Chain for persistence.
 */

import type {
  TreasuryService,
  TreasuryBalance,
  TreasuryTransaction,
  TreasuryConfig,
  BudgetSummary,
  BalanceSnapshot,
  NewTreasury,
  WithdrawalProposal,
  TreasuryTransactionStatus,
  TreasuryId,
  OrganizationId,
  PolkadotAddress,
  TransactionHash,
  PaginationParams,
  PaginatedResult,
  Result,
  PUSDAmount,
  BudgetCategory,
  DepositSource,
} from '@cocuyo/types';
import {
  createTreasuryId,
  ok,
  err,
  createEmptyBalance,
  requiresMoreApprovals,
  hasApproved,
  ZERO_PUSD,
  addPUSD,
  subtractPUSD,
  comparePUSD,
  createTransactionHash,
  toPUSDCents,
  parsePUSDCents,
} from '@cocuyo/types';
// PolkadotSigner is used for type assertion when calling distribute
import {
  paginate,
  fetchFromBulletin,
  uploadToBulletin,
  requireConnectedWallet,
  getConnectedSigner,
  generateId,
} from './service-utils';
import { organizationService } from './organization-service';
import { storage } from '../host/storage';
import { createLogger } from '../logging';
import { CHAIN_CONFIG } from '../chain/config';
import { pusdToEvmAmount } from '../chain/asset-hub-provider';
import {
  getOutletRegistryClient,
  type OutletDistribution,
} from '../chain/contracts/outlet-registry';

const logger = createLogger('TreasuryService');

// ============================================================
// Persistent CID Registry (localStorage-backed)
// ============================================================

const TREASURY_BALANCE_CID_KEY = 'treasury-balance-cid-map';
const TREASURY_CONFIG_CID_KEY = 'treasury-config-cid-map';
const ORG_TO_TREASURY_KEY = 'org-to-treasury-map';

/** CID registry type for persistence */
type CidRegistry = Record<string, string>;

/** Pending CID update */
interface PendingCidUpdate {
  key: string;
  id: string;
  cid: string;
}

/** Write queue for serialized CID registry updates (prevents race conditions) */
let writeQueue: PendingCidUpdate[] = [];
let writeInProgress = false;

/** Process the write queue serially to prevent read-modify-write races */
async function processWriteQueue(): Promise<void> {
  if (writeInProgress || writeQueue.length === 0) return;

  writeInProgress = true;

  // Take a snapshot of the current queue to process
  const batch = [...writeQueue];

  try {
    // Group updates by registry key for batched writes
    const updatesByKey = new Map<string, Map<string, string>>();
    for (const update of batch) {
      let keyUpdates = updatesByKey.get(update.key);
      if (!keyUpdates) {
        keyUpdates = new Map();
        updatesByKey.set(update.key, keyUpdates);
      }
      keyUpdates.set(update.id, update.cid);
    }

    // Apply batched updates for each registry
    for (const [key, updates] of updatesByKey) {
      const registry = (await storage.read<CidRegistry>(key)) ?? {};
      for (const [id, cid] of updates) {
        registry[id] = cid;
      }
      await storage.write(key, registry);
    }

    // Only clear processed items after successful writes
    writeQueue = writeQueue.filter((item) => !batch.includes(item));
  } catch (writeError) {
    logger.error('Failed to persist CID registry updates', 'processWriteQueue', writeError);
    // Items remain in queue for retry on next call
  } finally {
    writeInProgress = false;
    // Process any updates queued while we were writing
    if (writeQueue.length > 0) {
      void processWriteQueue();
    }
  }
}

/** Queue a CID entry update (serialized to prevent races) */
function queueCidUpdate(key: string, id: string, cid: string): void {
  writeQueue.push({ key, id, cid });
  void processWriteQueue();
}

/** Initialize in-memory maps from persistent storage */
async function initializeCidMapsFromStorage(): Promise<void> {
  try {
    const [balanceRegistry, configRegistry, orgRegistry] = await Promise.all([
      storage.read<CidRegistry>(TREASURY_BALANCE_CID_KEY),
      storage.read<CidRegistry>(TREASURY_CONFIG_CID_KEY),
      storage.read<CidRegistry>(ORG_TO_TREASURY_KEY),
    ]);

    // Populate in-memory maps
    for (const [id, cid] of Object.entries(balanceRegistry ?? {})) {
      treasuryBalanceCidMap.set(id, cid);
    }
    for (const [id, cid] of Object.entries(configRegistry ?? {})) {
      treasuryConfigCidMap.set(id, cid);
    }
    for (const [orgId, treasuryId] of Object.entries(orgRegistry ?? {})) {
      orgToTreasuryMap.set(orgId, treasuryId as TreasuryId);
    }

    logger.debug('CID registries initialized from storage', 'initializeCidMapsFromStorage', {
      balances: treasuryBalanceCidMap.size,
      configs: treasuryConfigCidMap.size,
      orgs: orgToTreasuryMap.size,
    });
  } catch (initError) {
    logger.swallowed(
      'Failed to initialize CID maps from storage',
      'initializeCidMapsFromStorage',
      initError
    );
  }
}

// Initialize on module load (non-blocking)
let cidMapsInitialized = false;
let initPromise = initializeCidMapsFromStorage().then(() => {
  cidMapsInitialized = true;
});

/** Ensure CID maps are initialized before use */
async function ensureCidMapsInitialized(): Promise<void> {
  if (!cidMapsInitialized) {
    await initPromise;
  }
}

/** Reinitialize CID maps (for use after cache clear) */
function reinitializeCidMaps(): void {
  cidMapsInitialized = false;
  initPromise = initializeCidMapsFromStorage().then(() => {
    cidMapsInitialized = true;
  });
}

// Session caches for treasury data
const treasuryBalanceCache = new Map<string, TreasuryBalance>();
const treasuryConfigCache = new Map<string, TreasuryConfig>();
const transactionsCache: TreasuryTransaction[] = [];

// Map organization ID to treasury ID
const orgToTreasuryMap = new Map<string, TreasuryId>();

// CID mappings for Bulletin Chain persistence
// These map treasuryId -> CID so we can fetch data after cache eviction
const treasuryBalanceCidMap = new Map<string, string>();
const treasuryConfigCidMap = new Map<string, string>();

// Balance snapshots for historical tracking (keyed by treasuryId)
const balanceSnapshotsCache = new Map<string, BalanceSnapshot[]>();

/**
 * Record a balance snapshot after a transaction.
 * Snapshots are always appended in timestamp order (no sorting needed).
 */
function recordBalanceSnapshot(
  treasuryId: TreasuryId,
  balance: PUSDAmount,
  timestamp: number,
  transactionId?: string
): void {
  const snapshot: BalanceSnapshot = {
    treasuryId,
    timestamp,
    balance,
    ...(transactionId !== undefined ? { transactionId } : {}),
  };

  const snapshots = balanceSnapshotsCache.get(treasuryId) ?? [];
  snapshots.push(snapshot);

  // Limit to last 1000 snapshots per treasury to prevent unbounded growth
  if (snapshots.length > 1000) {
    snapshots.splice(0, snapshots.length - 1000);
  }

  balanceSnapshotsCache.set(treasuryId, snapshots);
}

/**
 * Get the balance at a specific point in time.
 * Returns the balance from the most recent snapshot at or before the given timestamp.
 */
function getBalanceAtTime(treasuryId: TreasuryId, timestamp: number): PUSDAmount | null {
  const snapshots = balanceSnapshotsCache.get(treasuryId);
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  // Find the most recent snapshot at or before the timestamp
  let result: BalanceSnapshot | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.timestamp <= timestamp) {
      result = snapshot;
    } else {
      break; // Snapshots are sorted, so we can stop
    }
  }

  return result?.balance ?? null;
}

/**
 * Generate a unique transaction ID.
 */
function generateTransactionId(): string {
  return generateId('tx');
}

/**
 * Persist updated balance to Bulletin Chain and update CID mapping.
 * Critical: Without this, balance changes are lost on cache eviction.
 */
async function persistBalance(balance: TreasuryBalance): Promise<void> {
  const uploadResult = await uploadToBulletin(balance);
  if (!uploadResult.ok) {
    logger.error('Failed to persist balance update', 'persistBalance', {
      treasuryId: balance.treasuryId,
      error: uploadResult.error,
    });
    return;
  }

  // Update CID mapping so future fetches get the new balance
  treasuryBalanceCidMap.set(balance.treasuryId, uploadResult.value.cid);
  queueCidUpdate(TREASURY_BALANCE_CID_KEY, balance.treasuryId, uploadResult.value.cid);

  logger.debug('Balance persisted', 'persistBalance', {
    treasuryId: balance.treasuryId,
    cid: uploadResult.value.cid,
  });
}

export class TreasuryServiceImpl implements TreasuryService {
  async getTreasury(treasuryId: TreasuryId): Promise<TreasuryBalance | null> {
    // Ensure CID maps are loaded from persistent storage
    await ensureCidMapsInitialized();

    // Check cache first
    const cached = treasuryBalanceCache.get(treasuryId);
    if (cached) return cached;

    // Try Bulletin Chain using stored CID
    const cid = treasuryBalanceCidMap.get(treasuryId);
    if (cid === undefined) {
      logger.debug('No CID found for treasury balance', 'getTreasury', { treasuryId });
      return null;
    }

    const balance = await fetchFromBulletin<TreasuryBalance>(cid);
    if (balance) {
      // Re-populate cache
      treasuryBalanceCache.set(treasuryId, balance);
    }
    return balance;
  }

  async getTreasuryForOrganization(
    organizationId: OrganizationId
  ): Promise<TreasuryBalance | null> {
    // Ensure CID maps are loaded from persistent storage
    await ensureCidMapsInitialized();

    // Check mapping first
    const treasuryId = orgToTreasuryMap.get(organizationId);
    if (treasuryId) {
      return this.getTreasury(treasuryId);
    }

    // Check organization for treasury ID
    const org = await organizationService.getOrganization(organizationId);
    if (org?.treasuryId) {
      orgToTreasuryMap.set(organizationId, org.treasuryId);
      // Persist discovered mapping (queued to prevent races)
      queueCidUpdate(ORG_TO_TREASURY_KEY, organizationId, org.treasuryId);
      return this.getTreasury(org.treasuryId);
    }

    return null;
  }

  async getTreasuryConfig(treasuryId: TreasuryId): Promise<TreasuryConfig | null> {
    // Ensure CID maps are loaded from persistent storage
    await ensureCidMapsInitialized();

    // Check cache first
    const cached = treasuryConfigCache.get(treasuryId);
    if (cached) return cached;

    // Try Bulletin Chain using stored CID
    const cid = treasuryConfigCidMap.get(treasuryId);
    if (cid === undefined) {
      logger.debug('No CID found for treasury config', 'getTreasuryConfig', { treasuryId });
      return null;
    }

    const config = await fetchFromBulletin<TreasuryConfig>(cid);
    if (config) {
      // Re-populate cache
      treasuryConfigCache.set(treasuryId, config);
    }
    return config;
  }

  async createTreasury(params: NewTreasury): Promise<Result<TreasuryId, string>> {
    const walletCheck = requireConnectedWallet('to create a treasury');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    // Verify user has permission in the organization
    const canCreate = await organizationService.hasPermission(
      params.organizationId,
      credential,
      'treasury:approve'
    );
    if (!canCreate) {
      return err('You do not have permission to create a treasury for this organization.');
    }

    // Check if organization already has a treasury
    const existingTreasury = await this.getTreasuryForOrganization(params.organizationId);
    if (existingTreasury) {
      return err('This organization already has a treasury.');
    }

    // Validate threshold
    if (params.multisigThreshold > params.signers.length) {
      return err(
        `Multi-sig threshold (${params.multisigThreshold}) cannot exceed number of signers (${params.signers.length}).`
      );
    }

    if (params.multisigThreshold < 1) {
      return err('Multi-sig threshold must be at least 1.');
    }

    const now = Date.now();
    const treasuryId = createTreasuryId(`treasury-${params.organizationId}-${now}`);

    // Create config
    const config: TreasuryConfig = {
      treasuryId,
      organizationId: params.organizationId,
      multisigThreshold: params.multisigThreshold,
      signers: params.signers,
      requireGovernance: params.requireGovernance ?? false,
      updatedAt: now,
      ...(params.dailyLimit !== undefined ? { dailyLimit: params.dailyLimit } : {}),
      ...(params.perTransactionLimit !== undefined
        ? { perTransactionLimit: params.perTransactionLimit }
        : {}),
    };

    // Create initial balance
    const balance = createEmptyBalance(treasuryId, params.organizationId);

    // Upload to Bulletin Chain
    const configUploadResult = await uploadToBulletin(config);
    if (!configUploadResult.ok) {
      return err(`Failed to create treasury config: ${configUploadResult.error}`);
    }

    const balanceUploadResult = await uploadToBulletin(balance);
    if (!balanceUploadResult.ok) {
      return err(`Failed to create treasury balance: ${balanceUploadResult.error}`);
    }

    // Store CID mappings in memory
    treasuryConfigCidMap.set(treasuryId, configUploadResult.value.cid);
    treasuryBalanceCidMap.set(treasuryId, balanceUploadResult.value.cid);
    orgToTreasuryMap.set(params.organizationId, treasuryId);

    // Persist CID mappings to storage (queued to prevent races)
    queueCidUpdate(TREASURY_CONFIG_CID_KEY, treasuryId, configUploadResult.value.cid);
    queueCidUpdate(TREASURY_BALANCE_CID_KEY, treasuryId, balanceUploadResult.value.cid);
    queueCidUpdate(ORG_TO_TREASURY_KEY, params.organizationId, treasuryId);

    // Update caches
    treasuryConfigCache.set(treasuryId, config);
    treasuryBalanceCache.set(treasuryId, balance);

    logger.info('Treasury created', 'createTreasury', {
      treasuryId,
      organizationId: params.organizationId,
      signers: params.signers.length,
      threshold: params.multisigThreshold,
    });

    return ok(treasuryId);
  }

  getTransactionHistory(params: {
    treasuryId: TreasuryId;
    status?: TreasuryTransactionStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<TreasuryTransaction>> {
    let filtered = transactionsCache.filter((t) => t.treasuryId === params.treasuryId);

    // Filter by status
    if (params.status !== undefined) {
      filtered = filtered.filter((t) => t.status === params.status);
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return Promise.resolve(paginate(filtered, params.pagination));
  }

  getTransaction(transactionId: string): Promise<TreasuryTransaction | null> {
    return Promise.resolve(transactionsCache.find((t) => t.id === transactionId) ?? null);
  }

  async proposeWithdrawal(params: WithdrawalProposal): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to propose a withdrawal');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    // Get treasury config
    const config = await this.getTreasuryConfig(params.treasuryId);
    if (!config) {
      return err('Treasury configuration not found.');
    }

    // Verify user has permission
    const org = await organizationService.getOrganization(config.organizationId);
    if (!org) {
      return err('Organization not found.');
    }

    const canPropose = await organizationService.hasPermission(
      config.organizationId,
      credential,
      'treasury:propose'
    );
    if (!canPropose) {
      return err('You do not have permission to propose withdrawals.');
    }

    // Check balance
    const balance = await this.getTreasury(params.treasuryId);
    if (!balance) {
      return err('Treasury balance not found.');
    }

    if (comparePUSD(params.amount, balance.available) > 0) {
      return err(
        `Insufficient balance. Available: ${balance.available}, Requested: ${params.amount}`
      );
    }

    // Check per-transaction limit
    if (config.perTransactionLimit !== undefined) {
      if (comparePUSD(params.amount, config.perTransactionLimit) > 0) {
        return err(
          `Amount exceeds per-transaction limit of ${config.perTransactionLimit}. Use governance for larger withdrawals.`
        );
      }
    }

    const now = Date.now();
    const transaction: TreasuryTransaction = {
      id: generateTransactionId(),
      treasuryId: params.treasuryId,
      type: 'withdrawal',
      amount: params.amount,
      category: params.category,
      status: 'pending',
      initiatedBy: credential,
      approvers: [credential], // Proposer auto-approves
      recipient: params.recipient,
      purpose: params.purpose,
      createdAt: now,
      updatedAt: now,
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(transaction);
    if (!uploadResult.ok) {
      return err(`Failed to create withdrawal proposal: ${uploadResult.error}`);
    }

    const transactionWithCid: TreasuryTransaction = {
      ...transaction,
      id: uploadResult.value.cid,
    };

    transactionsCache.unshift(transactionWithCid);

    // Update escrowed balance
    const updatedBalance: TreasuryBalance = {
      ...balance,
      escrowed: addPUSD(balance.escrowed, params.amount),
      available: subtractPUSD(balance.available, params.amount),
      updatedAt: now,
    };
    treasuryBalanceCache.set(params.treasuryId, updatedBalance);

    // Persist balance to Bulletin Chain (critical for durability)
    await persistBalance(updatedBalance);

    logger.info('Withdrawal proposed', 'proposeWithdrawal', {
      transactionId: transactionWithCid.id,
      treasuryId: params.treasuryId,
      amount: params.amount,
      category: params.category,
    });

    // Check if threshold already met (single-sig treasury)
    if (!requiresMoreApprovals(transactionWithCid, config)) {
      logger.info('Withdrawal auto-approved (threshold met)', 'proposeWithdrawal', {
        transactionId: transactionWithCid.id,
      });
    }

    return ok(transactionWithCid.id);
  }

  async approveWithdrawal(transactionId: string): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to approve withdrawals');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const txIndex = transactionsCache.findIndex((t) => t.id === transactionId);
    if (txIndex === -1) {
      return err('Transaction not found.');
    }

    const transaction = transactionsCache[txIndex];
    if (!transaction) {
      return err('Transaction not found.');
    }

    if (transaction.status !== 'pending') {
      return err(`Transaction cannot be approved (status: ${transaction.status}).`);
    }

    // Get config to check signer and threshold
    const config = await this.getTreasuryConfig(transaction.treasuryId);
    if (!config) {
      return err('Treasury configuration not found.');
    }

    // Check if user has approval permission
    const canApprove = await organizationService.hasPermission(
      config.organizationId,
      credential,
      'treasury:approve'
    );
    if (!canApprove) {
      return err('You do not have permission to approve withdrawals.');
    }

    // Check if already approved
    if (hasApproved(transaction, credential)) {
      return err('You have already approved this transaction.');
    }

    // Add approval
    const updatedTransaction: TreasuryTransaction = {
      ...transaction,
      approvers: [...transaction.approvers, credential],
      updatedAt: Date.now(),
    };

    // Check if threshold reached
    if (!requiresMoreApprovals(updatedTransaction, config)) {
      const approvedTransaction: TreasuryTransaction = {
        ...updatedTransaction,
        status: 'approved',
      };
      transactionsCache[txIndex] = approvedTransaction;
    } else {
      transactionsCache[txIndex] = updatedTransaction;
    }

    // Persist update
    const uploadResult = await uploadToBulletin(transactionsCache[txIndex]);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist approval', 'approveWithdrawal', {
        error: uploadResult.error,
      });
    }

    logger.info('Withdrawal approved', 'approveWithdrawal', {
      transactionId,
      approver: credential,
      totalApprovals: updatedTransaction.approvers.length,
      required: config.multisigThreshold,
    });

    return ok(undefined);
  }

  async executeWithdrawal(transactionId: string): Promise<Result<TransactionHash, string>> {
    const walletCheck = requireConnectedWallet('to execute withdrawals');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const txIndex = transactionsCache.findIndex((t) => t.id === transactionId);
    if (txIndex === -1) {
      return err('Transaction not found.');
    }

    const transaction = transactionsCache[txIndex];
    if (!transaction) {
      return err('Transaction not found.');
    }

    if (transaction.status !== 'approved') {
      return err(`Transaction cannot be executed (status: ${transaction.status}).`);
    }

    const config = await this.getTreasuryConfig(transaction.treasuryId);
    if (!config) {
      return err('Treasury configuration not found.');
    }

    // Verify permission
    const canExecute = await organizationService.hasPermission(
      config.organizationId,
      credential,
      'treasury:approve'
    );
    if (!canExecute) {
      return err('You do not have permission to execute withdrawals.');
    }

    // In production, this would call the treasury smart contract
    // For now, simulate execution
    const txHash = createTransactionHash(
      `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    );

    const now = Date.now();
    const executedTransaction: TreasuryTransaction = {
      ...transaction,
      status: 'executed',
      txHash,
      updatedAt: now,
      executedAt: now,
    };

    transactionsCache[txIndex] = executedTransaction;

    // Update balance
    const balance = await this.getTreasury(transaction.treasuryId);
    if (balance) {
      const newTotal = subtractPUSD(balance.total, transaction.amount);
      const updatedBalance: TreasuryBalance = {
        ...balance,
        total: newTotal,
        escrowed: subtractPUSD(balance.escrowed, transaction.amount),
        updatedAt: now,
      };

      // Update category balance if applicable
      let finalBalance: TreasuryBalance;
      if (transaction.category) {
        const categoryAmount = updatedBalance.byCategory[transaction.category];
        const newCategoryBalance = subtractPUSD(categoryAmount, transaction.amount);
        const newByCategory = {
          ...updatedBalance.byCategory,
          [transaction.category]: newCategoryBalance,
        };
        finalBalance = {
          ...updatedBalance,
          byCategory: newByCategory,
        };
      } else {
        finalBalance = updatedBalance;
      }

      treasuryBalanceCache.set(transaction.treasuryId, finalBalance);

      // Persist balance to Bulletin Chain (critical for durability)
      await persistBalance(finalBalance);

      // Record balance snapshot for historical tracking
      recordBalanceSnapshot(transaction.treasuryId, newTotal, now, transactionId);
    }

    // Persist
    const uploadResult = await uploadToBulletin(executedTransaction);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist execution', 'executeWithdrawal', {
        error: uploadResult.error,
      });
    }

    logger.info('Withdrawal executed', 'executeWithdrawal', {
      transactionId,
      amount: transaction.amount,
      recipient: transaction.recipient,
      txHash,
    });

    return ok(txHash);
  }

  async cancelWithdrawal(transactionId: string): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to cancel withdrawals');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const txIndex = transactionsCache.findIndex((t) => t.id === transactionId);
    if (txIndex === -1) {
      return err('Transaction not found.');
    }

    const transaction = transactionsCache[txIndex];
    if (!transaction) {
      return err('Transaction not found.');
    }

    if (transaction.status !== 'pending') {
      return err(`Transaction cannot be cancelled (status: ${transaction.status}).`);
    }

    // Only initiator or admin can cancel
    const config = await this.getTreasuryConfig(transaction.treasuryId);
    if (!config) {
      return err('Treasury configuration not found.');
    }

    if (transaction.initiatedBy !== credential) {
      const canCancel = await organizationService.hasPermission(
        config.organizationId,
        credential,
        'treasury:approve'
      );
      if (!canCancel) {
        return err('Only the initiator or an admin can cancel this transaction.');
      }
    }

    const now = Date.now();
    const cancelledTransaction: TreasuryTransaction = {
      ...transaction,
      status: 'cancelled',
      updatedAt: now,
    };

    transactionsCache[txIndex] = cancelledTransaction;

    // Release escrowed funds
    const balance = await this.getTreasury(transaction.treasuryId);
    if (balance) {
      const updatedBalance: TreasuryBalance = {
        ...balance,
        escrowed: subtractPUSD(balance.escrowed, transaction.amount),
        available: addPUSD(balance.available, transaction.amount),
        updatedAt: now,
      };
      treasuryBalanceCache.set(transaction.treasuryId, updatedBalance);

      // Persist balance to Bulletin Chain (critical for durability)
      await persistBalance(updatedBalance);
    }

    // Persist
    const uploadResult = await uploadToBulletin(cancelledTransaction);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist cancellation', 'cancelWithdrawal', {
        error: uploadResult.error,
      });
    }

    logger.info('Withdrawal cancelled', 'cancelWithdrawal', { transactionId });

    return ok(undefined);
  }

  async deposit(params: {
    treasuryId: TreasuryId;
    amount: PUSDAmount;
    source: PolkadotAddress;
    category?: BudgetCategory;
    depositSource?: DepositSource;
  }): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to deposit funds');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const balance = await this.getTreasury(params.treasuryId);
    if (!balance) {
      return err('Treasury not found.');
    }

    const now = Date.now();
    const transaction: TreasuryTransaction = {
      id: generateTransactionId(),
      treasuryId: params.treasuryId,
      type: 'deposit',
      amount: params.amount,
      status: 'executed', // Deposits are instant
      initiatedBy: credential,
      approvers: [credential],
      source: params.source,
      depositSource: params.depositSource ?? 'donations', // Default to donations
      purpose: 'Deposit',
      createdAt: now,
      updatedAt: now,
      executedAt: now,
      ...(params.category !== undefined ? { category: params.category } : {}),
    };

    // Update balance
    const newTotal = addPUSD(balance.total, params.amount);
    const updatedBalance: TreasuryBalance = {
      ...balance,
      total: newTotal,
      available: addPUSD(balance.available, params.amount),
      updatedAt: now,
    };

    // Update category balance if specified
    let finalBalance: TreasuryBalance;
    if (params.category) {
      const categoryAmount = updatedBalance.byCategory[params.category];
      const newCategoryBalance = addPUSD(categoryAmount, params.amount);
      finalBalance = {
        ...updatedBalance,
        byCategory: {
          ...updatedBalance.byCategory,
          [params.category]: newCategoryBalance,
        },
      };
    } else {
      finalBalance = updatedBalance;
    }

    treasuryBalanceCache.set(params.treasuryId, finalBalance);

    // Persist balance to Bulletin Chain (critical for durability)
    await persistBalance(finalBalance);

    // Upload transaction
    const uploadResult = await uploadToBulletin(transaction);
    if (!uploadResult.ok) {
      return err(`Failed to record deposit: ${uploadResult.error}`);
    }

    const transactionWithCid: TreasuryTransaction = {
      ...transaction,
      id: uploadResult.value.cid,
    };

    transactionsCache.unshift(transactionWithCid);

    // Record balance snapshot for historical tracking
    recordBalanceSnapshot(params.treasuryId, newTotal, now, transactionWithCid.id);

    logger.info('Deposit recorded', 'deposit', {
      transactionId: transactionWithCid.id,
      treasuryId: params.treasuryId,
      amount: params.amount,
      category: params.category,
      depositSource: params.depositSource ?? 'donations',
    });

    return ok(transactionWithCid.id);
  }

  async getBudgetSummary(params: {
    treasuryId: TreasuryId;
    periodStart: number;
    periodEnd: number;
  }): Promise<BudgetSummary> {
    const balance = await this.getTreasury(params.treasuryId);
    const zero = ZERO_PUSD;

    // Get transactions in period
    const periodTransactions = transactionsCache.filter(
      (t) =>
        t.treasuryId === params.treasuryId &&
        t.status === 'executed' &&
        t.executedAt !== undefined &&
        t.executedAt >= params.periodStart &&
        t.executedAt <= params.periodEnd
    );

    // Calculate income by source
    const deposits = periodTransactions.filter((t) => t.type === 'deposit');
    let totalIncome = zero;
    const incomeBySource: {
      campaigns: PUSDAmount;
      grants: PUSDAmount;
      donations: PUSDAmount;
      other: PUSDAmount;
    } = {
      campaigns: zero,
      grants: zero,
      donations: zero,
      other: zero,
    };

    for (const d of deposits) {
      totalIncome = addPUSD(totalIncome, d.amount);
      // Track by source - use depositSource field or default to 'donations'
      const source = d.depositSource ?? 'donations';
      incomeBySource[source] = addPUSD(incomeBySource[source], d.amount);
    }

    // Calculate expenses by category
    const withdrawals = periodTransactions.filter((t) => t.type === 'withdrawal');
    let totalExpenses = zero;
    const expensesByCategory: Record<BudgetCategory, PUSDAmount> = {
      editorial: zero,
      technology: zero,
      administration: zero,
      'field-operations': zero,
      legal: zero,
      'grants-out': zero,
    };

    for (const w of withdrawals) {
      totalExpenses = addPUSD(totalExpenses, w.amount);
      if (w.category) {
        expensesByCategory[w.category] = addPUSD(expensesByCategory[w.category], w.amount);
      }
    }

    // Calculate starting balance from historical snapshots
    const historicalBalance = getBalanceAtTime(params.treasuryId, params.periodStart);
    const hasHistoricalData = historicalBalance !== null;

    // If no historical data, calculate from all transactions before period
    let startingBalance: PUSDAmount;
    if (hasHistoricalData) {
      startingBalance = historicalBalance;
    } else {
      // Calculate starting balance by replaying all transactions before period start
      const prePeriodTransactions = transactionsCache.filter(
        (t) =>
          t.treasuryId === params.treasuryId &&
          t.status === 'executed' &&
          t.executedAt !== undefined &&
          t.executedAt < params.periodStart
      );

      let calculatedBalance = zero;
      for (const t of prePeriodTransactions) {
        if (t.type === 'deposit') {
          calculatedBalance = addPUSD(calculatedBalance, t.amount);
        } else if (t.type === 'withdrawal' || t.type === 'transfer') {
          calculatedBalance = subtractPUSD(calculatedBalance, t.amount);
        }
      }
      startingBalance = calculatedBalance;
    }

    // Calculate period metrics
    const periodDays = (params.periodEnd - params.periodStart) / (24 * 60 * 60 * 1000);
    const totalExpensesCents = toPUSDCents(totalExpenses);
    const monthlyBurnRateCents =
      periodDays > 0 ? Math.round((totalExpensesCents / periodDays) * 30) : 0;
    const monthlyBurnRate = parsePUSDCents(monthlyBurnRateCents);

    const currentBalanceCents = toPUSDCents(balance?.total ?? zero);
    const runwayMonths =
      monthlyBurnRateCents > 0 ? Math.floor(currentBalanceCents / monthlyBurnRateCents) : 999;

    // Mark as estimate if we don't have historical snapshot data
    // Without snapshots, we can't be certain about the starting balance
    // (transactions might have been evicted from cache)
    const isEstimate = !hasHistoricalData;

    return {
      treasuryId: params.treasuryId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      startingBalance,
      endingBalance: balance?.total ?? zero,
      totalIncome,
      totalExpenses,
      incomeBySource,
      expensesByCategory,
      burnRate: monthlyBurnRate,
      runwayMonths,
      ...(isEstimate ? { isEstimate: true } : {}),
    };
  }

  async updateConfig(
    treasuryId: TreasuryId,
    updates: Partial<Omit<TreasuryConfig, 'treasuryId' | 'organizationId' | 'updatedAt'>>
  ): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to update treasury config');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const config = await this.getTreasuryConfig(treasuryId);
    if (!config) {
      return err('Treasury configuration not found.');
    }

    // Verify permission (requires governance or owner)
    const canUpdate = await organizationService.hasPermission(
      config.organizationId,
      credential,
      'settings:edit'
    );
    if (!canUpdate) {
      return err('You do not have permission to update treasury configuration.');
    }

    // Validate new threshold if changing
    const newSigners = updates.signers ?? config.signers;
    const newThreshold = updates.multisigThreshold ?? config.multisigThreshold;

    if (newThreshold > newSigners.length) {
      return err(
        `Multi-sig threshold (${newThreshold}) cannot exceed number of signers (${newSigners.length}).`
      );
    }

    const updatedConfig: TreasuryConfig = {
      ...config,
      ...updates,
      updatedAt: Date.now(),
    };

    // Persist
    const uploadResult = await uploadToBulletin(updatedConfig);
    if (!uploadResult.ok) {
      return err(`Failed to update config: ${uploadResult.error}`);
    }

    // Update CID mapping and cache
    treasuryConfigCidMap.set(treasuryId, uploadResult.value.cid);
    treasuryConfigCache.set(treasuryId, updatedConfig);

    // Persist CID mapping to storage (queued to prevent races)
    queueCidUpdate(TREASURY_CONFIG_CID_KEY, treasuryId, uploadResult.value.cid);

    logger.info('Treasury config updated', 'updateConfig', {
      treasuryId,
      updates: Object.keys(updates),
    });

    return ok(undefined);
  }

  async isSigner(treasuryId: TreasuryId, address: PolkadotAddress): Promise<boolean> {
    const config = await this.getTreasuryConfig(treasuryId);
    if (!config) return false;

    return config.signers.includes(address);
  }

  // ============================================================
  // Outlet Distribution Methods
  // ============================================================

  /**
   * Calculate how funds would be distributed to outlets.
   * Uses the OutletRegistry contract when chain contracts are enabled.
   */
  async calculateOutletDistributions(amount: PUSDAmount): Promise<OutletDistribution[]> {
    if (!CHAIN_CONFIG.features.useChainContracts) {
      // Return mock distribution
      return [];
    }

    try {
      const client = getOutletRegistryClient();
      // Convert pUSD (6 decimals) to EVM wei (18 decimals)
      const amountWei = pusdToEvmAmount(BigInt(amount.toString()));
      return await client.calculateDistributions(amountWei);
    } catch (error) {
      logger.warn('Failed to calculate outlet distributions', 'calculateOutletDistributions', {
        error,
      });
      return [];
    }
  }

  /**
   * Distribute funds to outlets via the OutletRegistry contract.
   * Requires distributor authorization.
   */
  async distributeToOutlets(
    treasuryId: TreasuryId,
    amount: PUSDAmount
  ): Promise<Result<TransactionHash, string>> {
    const walletCheck = requireConnectedWallet('to distribute funds');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;
    const signer = getConnectedSigner();
    if (signer === null) {
      return err('Wallet not connected. Please connect to distribute funds.');
    }

    // Verify treasury exists
    const balance = await this.getTreasury(treasuryId);
    if (!balance) {
      return err('Treasury not found.');
    }

    // Check sufficient balance
    if (comparePUSD(amount, balance.available) > 0) {
      return err(`Insufficient balance. Available: ${balance.available}, Requested: ${amount}`);
    }

    if (!CHAIN_CONFIG.features.useChainContracts) {
      // Mock distribution - just record the transaction
      const now = Date.now();
      const txHash = createTransactionHash(
        `0x${now.toString(16)}${Math.random().toString(16).slice(2)}`
      );

      const transaction: TreasuryTransaction = {
        id: generateTransactionId(),
        treasuryId,
        type: 'transfer',
        amount,
        status: 'executed',
        initiatedBy: credential,
        approvers: [credential],
        purpose: 'Outlet distribution',
        createdAt: now,
        updatedAt: now,
        executedAt: now,
        txHash,
      };

      // Update balance
      const newTotal = subtractPUSD(balance.total, amount);
      const updatedBalance: TreasuryBalance = {
        ...balance,
        total: newTotal,
        available: subtractPUSD(balance.available, amount),
        updatedAt: now,
      };

      treasuryBalanceCache.set(treasuryId, updatedBalance);
      await persistBalance(updatedBalance);

      // Upload transaction
      const uploadResult = await uploadToBulletin(transaction);
      if (uploadResult.ok) {
        transactionsCache.unshift({ ...transaction, id: uploadResult.value.cid });
      }

      recordBalanceSnapshot(treasuryId, newTotal, now, transaction.id);

      logger.info('Mock outlet distribution completed', 'distributeToOutlets', {
        treasuryId,
        amount,
        txHash,
      });

      return ok(txHash);
    }

    try {
      const client = getOutletRegistryClient();
      // Convert pUSD (6 decimals) to EVM wei (18 decimals)
      const amountWei = pusdToEvmAmount(BigInt(amount.toString()));

      const txHash = await client.distribute(amountWei, signer);

      // Record the transaction
      const now = Date.now();
      const transaction: TreasuryTransaction = {
        id: generateTransactionId(),
        treasuryId,
        type: 'transfer',
        amount,
        status: 'executed',
        initiatedBy: credential,
        approvers: [credential],
        purpose: 'Outlet distribution',
        createdAt: now,
        updatedAt: now,
        executedAt: now,
        txHash,
      };

      // Update balance
      const newTotal = subtractPUSD(balance.total, amount);
      const updatedBalance: TreasuryBalance = {
        ...balance,
        total: newTotal,
        available: subtractPUSD(balance.available, amount),
        updatedAt: now,
      };

      treasuryBalanceCache.set(treasuryId, updatedBalance);
      await persistBalance(updatedBalance);

      // Upload transaction
      const uploadResult = await uploadToBulletin(transaction);
      if (uploadResult.ok) {
        transactionsCache.unshift({ ...transaction, id: uploadResult.value.cid });
      }

      recordBalanceSnapshot(treasuryId, newTotal, now, transaction.id);

      logger.info('Outlet distribution completed', 'distributeToOutlets', {
        treasuryId,
        amount,
        txHash,
      });

      return ok(txHash);
    } catch (error) {
      logger.error('Failed to distribute to outlets', 'distributeToOutlets', { error });
      return err(error instanceof Error ? error.message : 'Distribution failed');
    }
  }
}

// Export singleton instance
export const treasuryService = new TreasuryServiceImpl();

// ============================================================
// Test Helpers (exported for test isolation)
// ============================================================

const CACHE_MAX_SIZE = 100;

/**
 * Clear all treasury caches. Use in tests for isolation.
 */
export async function clearTreasuryCache(): Promise<void> {
  // Clear in-memory caches
  treasuryBalanceCache.clear();
  treasuryConfigCache.clear();
  transactionsCache.length = 0;
  orgToTreasuryMap.clear();
  treasuryBalanceCidMap.clear();
  treasuryConfigCidMap.clear();
  balanceSnapshotsCache.clear();

  // Clear persistent storage
  await Promise.all([
    storage.clear(TREASURY_BALANCE_CID_KEY),
    storage.clear(TREASURY_CONFIG_CID_KEY),
    storage.clear(ORG_TO_TREASURY_KEY),
  ]);

  // Clear write queue
  writeQueue = [];

  // Reset initialization state so maps reload on next access
  reinitializeCidMaps();
}

/**
 * Add a treasury balance directly to cache. Use in tests for seeding.
 */
export function addTreasuryToCache(balance: TreasuryBalance, config: TreasuryConfig): void {
  treasuryBalanceCache.set(balance.treasuryId, balance);
  treasuryConfigCache.set(config.treasuryId, config);
  orgToTreasuryMap.set(balance.organizationId, balance.treasuryId);
  // Enforce size limit (simple eviction - clear oldest)
  if (treasuryBalanceCache.size > CACHE_MAX_SIZE) {
    const firstKey = treasuryBalanceCache.keys().next().value;
    if (firstKey !== undefined) {
      treasuryBalanceCache.delete(firstKey);
      treasuryConfigCache.delete(firstKey);
    }
  }
}

/**
 * Add a transaction directly to cache. Use in tests for seeding.
 */
export function addTransactionToCache(transaction: TreasuryTransaction): void {
  transactionsCache.unshift(transaction);
  // Enforce size limit
  while (transactionsCache.length > CACHE_MAX_SIZE) {
    transactionsCache.pop();
  }
}

/**
 * Get cache stats for debugging.
 */
export function getTreasuryCacheStats(): {
  balancesCount: number;
  configsCount: number;
  transactionsCount: number;
  maxSize: number;
} {
  return {
    balancesCount: treasuryBalanceCache.size,
    configsCount: treasuryConfigCache.size,
    transactionsCount: transactionsCache.length,
    maxSize: CACHE_MAX_SIZE,
  };
}

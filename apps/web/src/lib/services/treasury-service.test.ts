/**
 * Tests for TreasuryService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TreasuryServiceImpl,
  clearTreasuryCache,
  addTreasuryToCache,
  addTransactionToCache,
  getTreasuryCacheStats,
} from './treasury-service';
import { clearOrganizationCache, addOrganizationToCache } from './organization-service';
import { setConnectedWallet } from './service-utils';
import * as serviceUtils from './service-utils';
import {
  deriveCredentialFromString,
  createOrganizationId,
  createTreasuryId,
  createPolkadotAddress,
  createPUSDAmount,
  createEmptyBalance,
  DEFAULT_GOVERNANCE,
  ZERO_PUSD,
} from '@cocuyo/types';
import type {
  DIMCredential,
  OrganizationId,
  TreasuryId,
  Organization,
  TreasuryConfig,
  TreasuryTransaction,
} from '@cocuyo/types';

// Spy on Bulletin chain functions instead of full mock
vi.spyOn(serviceUtils, 'uploadToBulletin').mockResolvedValue({
  ok: true,
  value: { cid: 'mock-cid-123' },
});
vi.spyOn(serviceUtils, 'fetchFromBulletin').mockResolvedValue(null);

describe('TreasuryServiceImpl', () => {
  let service: TreasuryServiceImpl;
  let testCredential: DIMCredential;
  let testWalletAddress: string;
  let testOrgId: OrganizationId;
  let testTreasuryId: TreasuryId;
  let testOrg: Organization;
  let testPolkadotAddress: ReturnType<typeof createPolkadotAddress>;

  beforeEach(async () => {
    await clearTreasuryCache();
    clearOrganizationCache();
    service = new TreasuryServiceImpl();
    testWalletAddress = '0x' + '1'.repeat(40);
    testCredential = deriveCredentialFromString(testWalletAddress);
    testOrgId = createOrganizationId('test-org-treasury');
    testTreasuryId = createTreasuryId('test-treasury-123');
    testPolkadotAddress = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

    // Create a test organization with treasury permissions
    testOrg = {
      id: testOrgId,
      type: 'outlet',
      name: 'Test Treasury Org',
      description: 'A test organization for treasury testing',
      mission: 'Testing treasury',
      topics: ['treasury', 'testing'],
      members: [
        {
          credentialHash: testCredential,
          pseudonym: 'Test Owner',
          role: 'owner',
          status: 'active',
          joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        },
      ],
      governance: DEFAULT_GOVERNANCE,
      reputation: {
        score: 50,
        contentPublished: 0,
        engagementScore: 50,
      },
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    };
    addOrganizationToCache(testOrg);

    // Connect the test wallet
    setConnectedWallet(testWalletAddress);
  });

  describe('createTreasury', () => {
    it('creates a treasury successfully', async () => {
      const result = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 2,
        signers: [testPolkadotAddress, testPolkadotAddress],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(typeof result.value).toBe('string');
      }
    });

    it('fails without wallet connection', async () => {
      setConnectedWallet(null);

      const result = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Wallet not connected');
      }
    });

    it('fails when threshold exceeds signers count', async () => {
      const result = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 3,
        signers: [testPolkadotAddress, testPolkadotAddress],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cannot exceed number of signers');
      }
    });

    it('fails when threshold is less than 1', async () => {
      const result = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 0,
        signers: [testPolkadotAddress],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('at least 1');
      }
    });

    it('fails when organization already has a treasury', async () => {
      // Create first treasury
      await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      // Try to create second treasury
      const result = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('already has a treasury');
      }
    });
  });

  describe('getTreasury', () => {
    it('returns null for non-existent treasury', async () => {
      const result = await service.getTreasury(createTreasuryId('non-existent'));
      expect(result).toBeNull();
    });

    it('returns treasury from cache', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const treasury = await service.getTreasury(createResult.value);
        expect(treasury).not.toBeNull();
        expect(treasury?.organizationId).toBe(testOrgId);
      }
    });
  });

  describe('getTreasuryForOrganization', () => {
    it('returns null when organization has no treasury', async () => {
      const result = await service.getTreasuryForOrganization(testOrgId);
      expect(result).toBeNull();
    });

    it('returns treasury after creation', async () => {
      await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      const result = await service.getTreasuryForOrganization(testOrgId);
      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe(testOrgId);
    });
  });

  describe('deposit', () => {
    it('deposits funds successfully', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const depositAmount = createPUSDAmount(10000n); // $100.00
        const depositResult = await service.deposit({
          treasuryId: createResult.value,
          amount: depositAmount,
          source: testPolkadotAddress,
          category: 'editorial',
        });

        expect(depositResult.ok).toBe(true);

        // Verify balance updated
        const treasury = await service.getTreasury(createResult.value);
        expect(treasury).not.toBeNull();
        expect(treasury?.total).toEqual(depositAmount);
      }
    });

    it('fails without wallet connection', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        setConnectedWallet(null);

        const depositResult = await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n),
          source: testPolkadotAddress,
        });

        expect(depositResult.ok).toBe(false);
        if (!depositResult.ok) {
          expect(depositResult.error).toContain('Wallet not connected');
        }
      }
    });
  });

  describe('proposeWithdrawal', () => {
    it('proposes withdrawal successfully', async () => {
      // Create treasury
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Deposit funds first
        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n),
          source: testPolkadotAddress,
        });

        // Propose withdrawal
        const withdrawalResult = await service.proposeWithdrawal({
          treasuryId: createResult.value,
          amount: createPUSDAmount(5000n),
          category: 'editorial',
          recipient: testPolkadotAddress,
          purpose: 'Test withdrawal',
        });

        expect(withdrawalResult.ok).toBe(true);
      }
    });

    it('fails with insufficient balance', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // No deposits, try to withdraw
        const withdrawalResult = await service.proposeWithdrawal({
          treasuryId: createResult.value,
          amount: createPUSDAmount(5000n),
          category: 'editorial',
          recipient: testPolkadotAddress,
          purpose: 'Test withdrawal',
        });

        expect(withdrawalResult.ok).toBe(false);
        if (!withdrawalResult.ok) {
          expect(withdrawalResult.error).toContain('Insufficient balance');
        }
      }
    });

    it('fails when exceeding per-transaction limit', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
        perTransactionLimit: createPUSDAmount(1000n), // $10 limit
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Deposit enough funds
        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n),
          source: testPolkadotAddress,
        });

        // Try to withdraw more than limit
        const withdrawalResult = await service.proposeWithdrawal({
          treasuryId: createResult.value,
          amount: createPUSDAmount(5000n), // Exceeds $10 limit
          category: 'editorial',
          recipient: testPolkadotAddress,
          purpose: 'Test withdrawal',
        });

        expect(withdrawalResult.ok).toBe(false);
        if (!withdrawalResult.ok) {
          expect(withdrawalResult.error).toContain('exceeds per-transaction limit');
        }
      }
    });
  });

  describe('getBudgetSummary', () => {
    it('returns budget summary with isEstimate flag', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const now = Date.now();
        const periodStart = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
        const periodEnd = now;

        const summary = await service.getBudgetSummary({
          treasuryId: createResult.value,
          periodStart,
          periodEnd,
        });

        expect(summary.treasuryId).toBe(createResult.value);
        expect(summary.periodStart).toBe(periodStart);
        expect(summary.periodEnd).toBe(periodEnd);
        expect(summary.isEstimate).toBe(true); // Should be marked as estimate
      }
    });

    it('calculates burn rate from period transactions', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Deposit funds
        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(100000n), // $1000
          source: testPolkadotAddress,
        });

        // Make a withdrawal proposal
        await service.proposeWithdrawal({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n), // $100
          category: 'editorial',
          recipient: testPolkadotAddress,
          purpose: 'Test expense',
        });

        const now = Date.now();
        const summary = await service.getBudgetSummary({
          treasuryId: createResult.value,
          periodStart: now - 30 * 24 * 60 * 60 * 1000,
          periodEnd: now,
        });

        expect(summary.totalIncome).not.toEqual(ZERO_PUSD);
        // Note: Withdrawals start as 'pending' so may not be in totalExpenses yet
      }
    });
  });

  describe('getTransactionHistory', () => {
    it('returns paginated transactions', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Make some transactions
        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n),
          source: testPolkadotAddress,
        });

        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(5000n),
          source: testPolkadotAddress,
        });

        const history = await service.getTransactionHistory({
          treasuryId: createResult.value,
          pagination: { offset: 0, limit: 10 },
        });

        expect(history.items.length).toBeGreaterThanOrEqual(2);
        expect(history.total).toBeGreaterThanOrEqual(2);
      }
    });

    it('filters by status', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        await service.deposit({
          treasuryId: createResult.value,
          amount: createPUSDAmount(10000n),
          source: testPolkadotAddress,
        });

        const history = await service.getTransactionHistory({
          treasuryId: createResult.value,
          status: 'executed',
          pagination: { offset: 0, limit: 10 },
        });

        expect(history.items.every((tx) => tx.status === 'executed')).toBe(true);
      }
    });
  });

  describe('isSigner', () => {
    it('returns true for signers', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const isSigner = await service.isSigner(createResult.value, testPolkadotAddress);
        expect(isSigner).toBe(true);
      }
    });

    it('returns false for non-signers', async () => {
      const createResult = await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const otherAddress = createPolkadotAddress(
          '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
        );
        const isSigner = await service.isSigner(createResult.value, otherAddress);
        expect(isSigner).toBe(false);
      }
    });
  });

  describe('cache helpers', () => {
    it('clearTreasuryCache clears all caches', async () => {
      await service.createTreasury({
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
      });

      const beforeStats = getTreasuryCacheStats();
      expect(beforeStats.balancesCount).toBeGreaterThan(0);

      await clearTreasuryCache();

      const afterStats = getTreasuryCacheStats();
      expect(afterStats.balancesCount).toBe(0);
      expect(afterStats.configsCount).toBe(0);
      expect(afterStats.transactionsCount).toBe(0);
    });

    it('addTreasuryToCache adds treasury to cache', async () => {
      const mockBalance = createEmptyBalance(testTreasuryId, testOrgId);
      const mockConfig: TreasuryConfig = {
        treasuryId: testTreasuryId,
        organizationId: testOrgId,
        multisigThreshold: 1,
        signers: [testPolkadotAddress],
        requireGovernance: false,
        updatedAt: Date.now(),
      };

      addTreasuryToCache(mockBalance, mockConfig);

      const retrieved = await service.getTreasury(testTreasuryId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.treasuryId).toBe(testTreasuryId);
    });

    it('addTransactionToCache adds transaction to cache', async () => {
      const mockTransaction: TreasuryTransaction = {
        id: 'mock-tx-id',
        treasuryId: testTreasuryId,
        type: 'deposit',
        amount: createPUSDAmount(10000n),
        status: 'executed',
        initiatedBy: testCredential,
        approvers: [testCredential],
        source: testPolkadotAddress,
        purpose: 'Mock deposit',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        executedAt: Date.now(),
      };

      addTransactionToCache(mockTransaction);

      const retrieved = await service.getTransaction('mock-tx-id');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('mock-tx-id');
    });

    it('getTreasuryCacheStats returns correct counts', () => {
      const stats = getTreasuryCacheStats();

      expect(stats).toHaveProperty('balancesCount');
      expect(stats).toHaveProperty('configsCount');
      expect(stats).toHaveProperty('transactionsCount');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.balancesCount).toBe('number');
    });
  });
});

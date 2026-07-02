/**
 * Tests for treasury utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyBalance,
  requiresMoreApprovals,
  hasApproved,
  type TreasuryTransaction,
  type TreasuryConfig,
} from './treasury';
import { createTreasuryId, createOrganizationId, createDIMCredential } from './brands';
import { createPUSDAmount } from './currency';

describe('createEmptyBalance', () => {
  it('creates a balance with zero values', () => {
    const treasuryId = createTreasuryId('treasury-1');
    const orgId = createOrganizationId('org-1');

    const balance = createEmptyBalance(treasuryId, orgId);

    expect(balance.treasuryId).toBe(treasuryId);
    expect(balance.organizationId).toBe(orgId);
    expect(balance.total).toBe(createPUSDAmount(0n));
    expect(balance.available).toBe(createPUSDAmount(0n));
    expect(balance.escrowed).toBe(createPUSDAmount(0n));
  });

  it('creates balance with all budget categories at zero', () => {
    const treasuryId = createTreasuryId('treasury-1');
    const orgId = createOrganizationId('org-1');

    const balance = createEmptyBalance(treasuryId, orgId);

    expect(balance.byCategory.editorial).toBe(createPUSDAmount(0n));
    expect(balance.byCategory.technology).toBe(createPUSDAmount(0n));
    expect(balance.byCategory.administration).toBe(createPUSDAmount(0n));
    expect(balance.byCategory['field-operations']).toBe(createPUSDAmount(0n));
    expect(balance.byCategory.legal).toBe(createPUSDAmount(0n));
    expect(balance.byCategory['grants-out']).toBe(createPUSDAmount(0n));
  });

  it('sets updatedAt timestamp', () => {
    const treasuryId = createTreasuryId('treasury-1');
    const orgId = createOrganizationId('org-1');
    const before = Date.now();

    const balance = createEmptyBalance(treasuryId, orgId);

    const after = Date.now();
    expect(balance.updatedAt).toBeGreaterThanOrEqual(before);
    expect(balance.updatedAt).toBeLessThanOrEqual(after);
  });
});

describe('requiresMoreApprovals', () => {
  const createMockTransaction = (approverCount: number): TreasuryTransaction => ({
    id: 'tx-1',
    treasuryId: createTreasuryId('treasury-1'),
    type: 'withdrawal',
    amount: createPUSDAmount(1000n),
    status: 'pending',
    initiatedBy: createDIMCredential('initiator'),
    approvers: Array.from({ length: approverCount }, (_, i) =>
      createDIMCredential(`approver-${i}`)
    ),
    purpose: 'Test transaction',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const createMockConfig = (threshold: number): TreasuryConfig => ({
    treasuryId: createTreasuryId('treasury-1'),
    organizationId: createOrganizationId('org-1'),
    multisigThreshold: threshold,
    signers: [],
    requireGovernance: false,
    updatedAt: Date.now(),
  });

  it('returns true when approvers less than threshold', () => {
    const transaction = createMockTransaction(1);
    const config = createMockConfig(3);

    expect(requiresMoreApprovals(transaction, config)).toBe(true);
  });

  it('returns false when approvers equal to threshold', () => {
    const transaction = createMockTransaction(3);
    const config = createMockConfig(3);

    expect(requiresMoreApprovals(transaction, config)).toBe(false);
  });

  it('returns false when approvers exceed threshold', () => {
    const transaction = createMockTransaction(5);
    const config = createMockConfig(3);

    expect(requiresMoreApprovals(transaction, config)).toBe(false);
  });

  it('returns true when no approvers yet', () => {
    const transaction = createMockTransaction(0);
    const config = createMockConfig(2);

    expect(requiresMoreApprovals(transaction, config)).toBe(true);
  });
});

describe('hasApproved', () => {
  const credential1 = createDIMCredential('user-1');
  const credential2 = createDIMCredential('user-2');
  const credential3 = createDIMCredential('user-3');

  const createMockTransaction = (approvers: (typeof credential1)[]): TreasuryTransaction => ({
    id: 'tx-1',
    treasuryId: createTreasuryId('treasury-1'),
    type: 'withdrawal',
    amount: createPUSDAmount(1000n),
    status: 'pending',
    initiatedBy: createDIMCredential('initiator'),
    approvers,
    purpose: 'Test transaction',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it('returns true when credential is in approvers', () => {
    const transaction = createMockTransaction([credential1, credential2]);

    expect(hasApproved(transaction, credential1)).toBe(true);
    expect(hasApproved(transaction, credential2)).toBe(true);
  });

  it('returns false when credential is not in approvers', () => {
    const transaction = createMockTransaction([credential1, credential2]);

    expect(hasApproved(transaction, credential3)).toBe(false);
  });

  it('returns false when no approvers', () => {
    const transaction = createMockTransaction([]);

    expect(hasApproved(transaction, credential1)).toBe(false);
  });
});

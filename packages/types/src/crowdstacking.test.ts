import { describe, it, expect } from 'vitest';
import {
  TIER_THRESHOLDS,
  TIER_GOVERNANCE_WEIGHTS,
  SHARE_PRECISION,
  INITIAL_SHARE_PRICE,
  MIN_CONTRIBUTION,
  BASIS_POINTS,
  getTierForAmount,
  getGovernanceWeight,
  getNextTier,
  calculateShareValue,
  calculateSharesForContribution,
  calculateSharePriceAfterYield,
  calculateSharePriceAfterLoss,
  meetsMinimumContribution,
  getWithdrawalCooldownRemaining,
  isWithdrawalReady,
  validateOutletWeights,
  calculateDistributions,
  type WithdrawalRequest,
  type OutletAllocation,
} from './crowdstacking';
import {
  createOutletId,
  createTreasuryId,
  createPolkadotAddress,
  createPoolId,
  createWithdrawalRequestId,
} from './brands';
import { createPUSDAmount } from './currency';

describe('TIER_THRESHOLDS', () => {
  it('has correct threshold for none tier', () => {
    expect(TIER_THRESHOLDS.none.min).toBe(0);
    expect(TIER_THRESHOLDS.none.max).toBe(4_99);
  });

  it('has correct threshold for spark tier ($5 - $49.99)', () => {
    expect(TIER_THRESHOLDS.spark.min).toBe(5_00);
    expect(TIER_THRESHOLDS.spark.max).toBe(49_99);
  });

  it('has correct threshold for flame tier ($50 - $499.99)', () => {
    expect(TIER_THRESHOLDS.flame.min).toBe(50_00);
    expect(TIER_THRESHOLDS.flame.max).toBe(499_99);
  });

  it('has correct threshold for beacon tier ($500 - $4,999.99)', () => {
    expect(TIER_THRESHOLDS.beacon.min).toBe(500_00);
    expect(TIER_THRESHOLDS.beacon.max).toBe(4999_99);
  });

  it('has correct threshold for lighthouse tier ($5,000+)', () => {
    expect(TIER_THRESHOLDS.lighthouse.min).toBe(5000_00);
    expect(TIER_THRESHOLDS.lighthouse.max).toBe(Infinity);
  });
});

describe('TIER_GOVERNANCE_WEIGHTS', () => {
  it('has zero weight for none tier', () => {
    expect(TIER_GOVERNANCE_WEIGHTS.none).toBe(0);
  });

  it('has increasing weights for higher tiers', () => {
    expect(TIER_GOVERNANCE_WEIGHTS.spark).toBe(1);
    expect(TIER_GOVERNANCE_WEIGHTS.flame).toBe(3);
    expect(TIER_GOVERNANCE_WEIGHTS.beacon).toBe(10);
    expect(TIER_GOVERNANCE_WEIGHTS.lighthouse).toBe(25);
  });
});

describe('Constants', () => {
  it('has correct share precision (18 decimals)', () => {
    expect(SHARE_PRECISION).toBe(10n ** 18n);
  });

  it('has correct initial share price (1:1 with pUSD)', () => {
    expect(INITIAL_SHARE_PRICE).toBe(SHARE_PRECISION);
  });

  it('has correct minimum contribution ($5 pUSD)', () => {
    expect(MIN_CONTRIBUTION).toBe(5_000_000n);
  });

  it('has correct basis points (10000 = 100%)', () => {
    expect(BASIS_POINTS).toBe(10000);
  });
});

describe('getTierForAmount', () => {
  it('returns none for amounts below $5', () => {
    expect(getTierForAmount(0)).toBe('none');
    expect(getTierForAmount(4_99)).toBe('none');
  });

  it('returns spark for $5 - $49.99', () => {
    expect(getTierForAmount(5_00)).toBe('spark');
    expect(getTierForAmount(25_00)).toBe('spark');
    expect(getTierForAmount(49_99)).toBe('spark');
  });

  it('returns flame for $50 - $499.99', () => {
    expect(getTierForAmount(50_00)).toBe('flame');
    expect(getTierForAmount(200_00)).toBe('flame');
    expect(getTierForAmount(499_99)).toBe('flame');
  });

  it('returns beacon for $500 - $4,999.99', () => {
    expect(getTierForAmount(500_00)).toBe('beacon');
    expect(getTierForAmount(2500_00)).toBe('beacon');
    expect(getTierForAmount(4999_99)).toBe('beacon');
  });

  it('returns lighthouse for $5,000+', () => {
    expect(getTierForAmount(5000_00)).toBe('lighthouse');
    expect(getTierForAmount(10000_00)).toBe('lighthouse');
    expect(getTierForAmount(1000000_00)).toBe('lighthouse');
  });
});

describe('getGovernanceWeight', () => {
  it('returns correct weight for each tier', () => {
    expect(getGovernanceWeight('none')).toBe(0);
    expect(getGovernanceWeight('spark')).toBe(1);
    expect(getGovernanceWeight('flame')).toBe(3);
    expect(getGovernanceWeight('beacon')).toBe(10);
    expect(getGovernanceWeight('lighthouse')).toBe(25);
  });
});

describe('getNextTier', () => {
  it('returns spark for none', () => {
    expect(getNextTier('none')).toBe('spark');
  });

  it('returns flame for spark', () => {
    expect(getNextTier('spark')).toBe('flame');
  });

  it('returns beacon for flame', () => {
    expect(getNextTier('flame')).toBe('beacon');
  });

  it('returns lighthouse for beacon', () => {
    expect(getNextTier('beacon')).toBe('lighthouse');
  });

  it('returns null for lighthouse (max tier)', () => {
    expect(getNextTier('lighthouse')).toBe(null);
  });
});

describe('calculateShareValue', () => {
  it('calculates value at initial price (1:1)', () => {
    const shares = 100n * SHARE_PRECISION;
    const value = calculateShareValue(shares, INITIAL_SHARE_PRICE);
    // At 1:1, 100 shares = 100 pUSD
    expect(value).toBe(100n * SHARE_PRECISION);
  });

  it('calculates value at higher price', () => {
    const shares = 100n * SHARE_PRECISION;
    const sharePrice = 2n * SHARE_PRECISION; // 2x price
    const value = calculateShareValue(shares, sharePrice);
    // At 2:1, 100 shares = 200 pUSD
    expect(value).toBe(200n * SHARE_PRECISION);
  });

  it('returns zero for zero shares', () => {
    expect(calculateShareValue(0n, INITIAL_SHARE_PRICE)).toBe(0n);
  });
});

describe('calculateSharesForContribution', () => {
  it('calculates shares at initial price (1:1)', () => {
    const assets = 100n * SHARE_PRECISION;
    const shares = calculateSharesForContribution(assets, INITIAL_SHARE_PRICE);
    // At 1:1, 100 pUSD = 100 shares
    expect(shares).toBe(100n * SHARE_PRECISION);
  });

  it('calculates shares at higher price', () => {
    const assets = 100n * SHARE_PRECISION;
    const sharePrice = 2n * SHARE_PRECISION; // 2x price
    const shares = calculateSharesForContribution(assets, sharePrice);
    // At 2:1, 100 pUSD = 50 shares
    expect(shares).toBe(50n * SHARE_PRECISION);
  });

  it('returns zero for zero contribution', () => {
    expect(calculateSharesForContribution(0n, INITIAL_SHARE_PRICE)).toBe(0n);
  });
});

describe('calculateSharePriceAfterYield', () => {
  it('increases price when yield is received', () => {
    const totalAssets = 1000n * SHARE_PRECISION;
    const totalShares = 1000n * SHARE_PRECISION;
    const yieldAmount = 100n * SHARE_PRECISION; // 10% yield

    const newPrice = calculateSharePriceAfterYield(totalAssets, totalShares, yieldAmount);

    // New price should be (1000 + 100) / 1000 = 1.1
    expect(newPrice).toBe((1100n * SHARE_PRECISION) / 1000n);
  });

  it('returns initial price for zero shares', () => {
    const newPrice = calculateSharePriceAfterYield(0n, 0n, 100n);
    expect(newPrice).toBe(INITIAL_SHARE_PRICE);
  });
});

describe('calculateSharePriceAfterLoss', () => {
  it('decreases price when loss occurs', () => {
    const totalAssets = 1000n * SHARE_PRECISION;
    const totalShares = 1000n * SHARE_PRECISION;
    const lossAmount = 100n * SHARE_PRECISION; // 10% loss

    const newPrice = calculateSharePriceAfterLoss(totalAssets, totalShares, lossAmount);

    // New price should be (1000 - 100) / 1000 = 0.9
    expect(newPrice).toBe((900n * SHARE_PRECISION) / 1000n);
  });

  it('returns zero price when loss exceeds assets', () => {
    const totalAssets = 100n * SHARE_PRECISION;
    const totalShares = 100n * SHARE_PRECISION;
    const lossAmount = 200n * SHARE_PRECISION; // 200% loss

    const newPrice = calculateSharePriceAfterLoss(totalAssets, totalShares, lossAmount);

    expect(newPrice).toBe(0n);
  });

  it('returns initial price for zero shares', () => {
    const newPrice = calculateSharePriceAfterLoss(100n, 0n, 50n);
    expect(newPrice).toBe(INITIAL_SHARE_PRICE);
  });
});

describe('meetsMinimumContribution', () => {
  it('returns true for amounts at minimum', () => {
    expect(meetsMinimumContribution(MIN_CONTRIBUTION)).toBe(true);
  });

  it('returns true for amounts above minimum', () => {
    expect(meetsMinimumContribution(MIN_CONTRIBUTION + 1n)).toBe(true);
    expect(meetsMinimumContribution(100_000_000n)).toBe(true);
  });

  it('returns false for amounts below minimum', () => {
    expect(meetsMinimumContribution(MIN_CONTRIBUTION - 1n)).toBe(false);
    expect(meetsMinimumContribution(0n)).toBe(false);
  });
});

describe('getWithdrawalCooldownRemaining', () => {
  it('returns positive time when cooldown not complete', () => {
    const request = createMockWithdrawalRequest({
      availableAt: 1000,
    });

    const remaining = getWithdrawalCooldownRemaining(request, 500);
    expect(remaining).toBe(500);
  });

  it('returns zero when cooldown is complete', () => {
    const request = createMockWithdrawalRequest({
      availableAt: 1000,
    });

    const remaining = getWithdrawalCooldownRemaining(request, 1000);
    expect(remaining).toBe(0);
  });

  it('returns zero when past cooldown', () => {
    const request = createMockWithdrawalRequest({
      availableAt: 1000,
    });

    const remaining = getWithdrawalCooldownRemaining(request, 2000);
    expect(remaining).toBe(0);
  });
});

describe('isWithdrawalReady', () => {
  it('returns true when pending and past cooldown', () => {
    const request = createMockWithdrawalRequest({
      status: 'pending',
      availableAt: 1000,
    });

    expect(isWithdrawalReady(request, 1000)).toBe(true);
    expect(isWithdrawalReady(request, 2000)).toBe(true);
  });

  it('returns false when pending but before cooldown', () => {
    const request = createMockWithdrawalRequest({
      status: 'pending',
      availableAt: 1000,
    });

    expect(isWithdrawalReady(request, 500)).toBe(false);
  });

  it('returns false when not pending', () => {
    const completedRequest = createMockWithdrawalRequest({
      status: 'completed',
      availableAt: 1000,
    });

    expect(isWithdrawalReady(completedRequest, 2000)).toBe(false);
  });
});

describe('validateOutletWeights', () => {
  it('returns true for empty outlet list', () => {
    expect(validateOutletWeights([])).toBe(true);
  });

  it('returns true when active outlets sum to 100%', () => {
    const outlets = [
      createMockOutletAllocation({ weight: 5000, isActive: true }),
      createMockOutletAllocation({ weight: 3000, isActive: true }),
      createMockOutletAllocation({ weight: 2000, isActive: true }),
    ];

    expect(validateOutletWeights(outlets)).toBe(true);
  });

  it('ignores inactive outlets in calculation', () => {
    const outlets = [
      createMockOutletAllocation({ weight: 10000, isActive: true }),
      createMockOutletAllocation({ weight: 5000, isActive: false }),
    ];

    expect(validateOutletWeights(outlets)).toBe(true);
  });

  it('returns false when weights do not sum to 100%', () => {
    const outlets = [
      createMockOutletAllocation({ weight: 5000, isActive: true }),
      createMockOutletAllocation({ weight: 3000, isActive: true }),
    ];

    expect(validateOutletWeights(outlets)).toBe(false);
  });
});

describe('calculateDistributions', () => {
  it('distributes proportionally to weights', () => {
    const totalAmount = 1000n;
    const outlets = [
      createMockOutletAllocation({
        outletId: createOutletId('outlet-1'),
        weight: 5000,
        isActive: true,
      }),
      createMockOutletAllocation({
        outletId: createOutletId('outlet-2'),
        weight: 3000,
        isActive: true,
      }),
      createMockOutletAllocation({
        outletId: createOutletId('outlet-3'),
        weight: 2000,
        isActive: true,
      }),
    ];

    const distributions = calculateDistributions(totalAmount, outlets);

    expect(distributions.get(createOutletId('outlet-1'))).toBe(500n);
    expect(distributions.get(createOutletId('outlet-2'))).toBe(300n);
    expect(distributions.get(createOutletId('outlet-3'))).toBe(200n);
  });

  it('excludes inactive outlets', () => {
    const totalAmount = 1000n;
    const outlets = [
      createMockOutletAllocation({
        outletId: createOutletId('outlet-1'),
        weight: 5000,
        isActive: true,
      }),
      createMockOutletAllocation({
        outletId: createOutletId('outlet-2'),
        weight: 5000,
        isActive: false,
      }),
    ];

    const distributions = calculateDistributions(totalAmount, outlets);

    expect(distributions.get(createOutletId('outlet-1'))).toBe(500n);
    expect(distributions.has(createOutletId('outlet-2'))).toBe(false);
  });

  it('returns empty map for no active outlets', () => {
    const outlets = [createMockOutletAllocation({ weight: 10000, isActive: false })];

    const distributions = calculateDistributions(1000n, outlets);

    expect(distributions.size).toBe(0);
  });
});

// Helper functions for creating mock objects

function createMockWithdrawalRequest(overrides: Partial<WithdrawalRequest>): WithdrawalRequest {
  return {
    id: createWithdrawalRequestId('test-request-id'),
    poolId: createPoolId('test-pool-id'),
    requester: createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
    shares: 100n,
    status: 'pending',
    requestedAt: 0,
    availableAt: 1000,
    ...overrides,
  };
}

function createMockOutletAllocation(overrides: Partial<OutletAllocation>): OutletAllocation {
  return {
    outletId: createOutletId('test-outlet-id'),
    treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
    name: 'Test Outlet',
    weight: 10000,
    isActive: true,
    addedAt: 0,
    totalDistributed: createPUSDAmount(0n),
    ...overrides,
  };
}

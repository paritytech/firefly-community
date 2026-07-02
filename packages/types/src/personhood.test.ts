/**
 * Tests for personhood utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  PERSONHOOD_CAPABILITIES,
  getCapabilities,
  canPerform,
  canFundAmount,
  canClaimAmount,
  type PersonhoodLevel,
} from './personhood';
import { createPUSDAmount } from './currency';

describe('PERSONHOOD_CAPABILITIES', () => {
  it('none level has all capabilities disabled', () => {
    const caps = PERSONHOOD_CAPABILITIES.none;
    expect(caps.canIlluminate).toBe(false);
    expect(caps.canCorroborate).toBe(false);
    expect(caps.canChallenge).toBe(false);
    expect(caps.canFundBounty).toBe(false);
    expect(caps.canClaimPayout).toBe(false);
    expect(caps.canReceiveCoinage).toBe(false);
  });

  it('lite level has all capabilities enabled with limits', () => {
    const caps = PERSONHOOD_CAPABILITIES.lite;
    expect(caps.canIlluminate).toBe(true);
    expect(caps.canCorroborate).toBe(true);
    expect(caps.canChallenge).toBe(true);
    expect(caps.canFundBounty).toBe(true);
    expect(caps.canClaimPayout).toBe(true);
    expect(caps.canReceiveCoinage).toBe(true);
    expect(caps.maxBountyFunding).not.toBeNull();
    expect(caps.maxBountyClaim).not.toBeNull();
  });

  it('full level has all capabilities enabled with no limits', () => {
    const caps = PERSONHOOD_CAPABILITIES.full;
    expect(caps.canIlluminate).toBe(true);
    expect(caps.canCorroborate).toBe(true);
    expect(caps.canChallenge).toBe(true);
    expect(caps.canFundBounty).toBe(true);
    expect(caps.canClaimPayout).toBe(true);
    expect(caps.canReceiveCoinage).toBe(true);
    expect(caps.maxBountyFunding).toBeNull();
    expect(caps.maxBountyClaim).toBeNull();
  });
});

describe('getCapabilities', () => {
  it('returns none capabilities', () => {
    expect(getCapabilities('none')).toBe(PERSONHOOD_CAPABILITIES.none);
  });

  it('returns lite capabilities', () => {
    expect(getCapabilities('lite')).toBe(PERSONHOOD_CAPABILITIES.lite);
  });

  it('returns full capabilities', () => {
    expect(getCapabilities('full')).toBe(PERSONHOOD_CAPABILITIES.full);
  });
});

describe('canPerform', () => {
  describe('none level', () => {
    const level: PersonhoodLevel = 'none';

    it('cannot illuminate', () => {
      expect(canPerform(level, 'canIlluminate')).toBe(false);
    });

    it('cannot corroborate', () => {
      expect(canPerform(level, 'canCorroborate')).toBe(false);
    });

    it('cannot challenge', () => {
      expect(canPerform(level, 'canChallenge')).toBe(false);
    });

    it('cannot fund bounty', () => {
      expect(canPerform(level, 'canFundBounty')).toBe(false);
    });

    it('cannot claim payout', () => {
      expect(canPerform(level, 'canClaimPayout')).toBe(false);
    });

    it('cannot receive coinage', () => {
      expect(canPerform(level, 'canReceiveCoinage')).toBe(false);
    });
  });

  describe('lite level', () => {
    const level: PersonhoodLevel = 'lite';

    it('can illuminate', () => {
      expect(canPerform(level, 'canIlluminate')).toBe(true);
    });

    it('can corroborate', () => {
      expect(canPerform(level, 'canCorroborate')).toBe(true);
    });

    it('can challenge', () => {
      expect(canPerform(level, 'canChallenge')).toBe(true);
    });
  });

  describe('full level', () => {
    const level: PersonhoodLevel = 'full';

    it('can illuminate', () => {
      expect(canPerform(level, 'canIlluminate')).toBe(true);
    });

    it('can corroborate', () => {
      expect(canPerform(level, 'canCorroborate')).toBe(true);
    });
  });
});

describe('canFundAmount', () => {
  it('none level cannot fund any amount', () => {
    expect(canFundAmount('none', createPUSDAmount(1n))).toBe(false);
  });

  it('lite level can fund within limit', () => {
    // Lite limit is $1,000 = 1_000_000_000 micro-pUSD
    expect(canFundAmount('lite', createPUSDAmount(500_000_000n))).toBe(true);
    expect(canFundAmount('lite', createPUSDAmount(1_000_000_000n))).toBe(true);
  });

  it('lite level cannot fund above limit', () => {
    expect(canFundAmount('lite', createPUSDAmount(1_000_000_001n))).toBe(false);
  });

  it('full level can fund any amount', () => {
    expect(canFundAmount('full', createPUSDAmount(1_000_000_000_000n))).toBe(true);
  });
});

describe('canClaimAmount', () => {
  it('none level cannot claim any amount', () => {
    expect(canClaimAmount('none', createPUSDAmount(1n))).toBe(false);
  });

  it('lite level can claim within limit', () => {
    // Lite limit is $500 = 500_000_000 micro-pUSD
    expect(canClaimAmount('lite', createPUSDAmount(250_000_000n))).toBe(true);
    expect(canClaimAmount('lite', createPUSDAmount(500_000_000n))).toBe(true);
  });

  it('lite level cannot claim above limit', () => {
    expect(canClaimAmount('lite', createPUSDAmount(500_000_001n))).toBe(false);
  });

  it('full level can claim any amount', () => {
    expect(canClaimAmount('full', createPUSDAmount(1_000_000_000_000n))).toBe(true);
  });
});

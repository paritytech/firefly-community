import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODES,
  HIGH_SENSITIVITY_CASES,
  PUBLIC_REQUIRED_CASES,
  selectPaymentMode,
  supportsBothModes,
  describePaymentMode,
  getRecommendation,
} from './payment-mode';

describe('DEFAULT_MODES', () => {
  it('defaults bounty_payout to private', () => {
    expect(DEFAULT_MODES.bounty_payout).toBe('private');
  });

  it('defaults journalist_salary to private', () => {
    expect(DEFAULT_MODES.journalist_salary).toBe('private');
  });

  it('defaults source_payment to private', () => {
    expect(DEFAULT_MODES.source_payment).toBe('private');
  });

  it('defaults membership to public', () => {
    expect(DEFAULT_MODES.membership).toBe('public');
  });

  it('defaults offboard to public', () => {
    expect(DEFAULT_MODES.offboard).toBe('public');
  });

  it('defaults treasury_allocation to public', () => {
    expect(DEFAULT_MODES.treasury_allocation).toBe('public');
  });
});

describe('HIGH_SENSITIVITY_CASES', () => {
  it('includes bounty_payout', () => {
    expect(HIGH_SENSITIVITY_CASES).toContain('bounty_payout');
  });

  it('includes journalist_salary', () => {
    expect(HIGH_SENSITIVITY_CASES).toContain('journalist_salary');
  });

  it('includes source_payment', () => {
    expect(HIGH_SENSITIVITY_CASES).toContain('source_payment');
  });

  it('does not include membership', () => {
    expect(HIGH_SENSITIVITY_CASES).not.toContain('membership');
  });
});

describe('PUBLIC_REQUIRED_CASES', () => {
  it('includes offboard', () => {
    expect(PUBLIC_REQUIRED_CASES).toContain('offboard');
  });

  it('does not include bounty_payout', () => {
    expect(PUBLIC_REQUIRED_CASES).not.toContain('bounty_payout');
  });
});

describe('selectPaymentMode', () => {
  describe('compliance required', () => {
    it('returns public when compliance is required', () => {
      const result = selectPaymentMode({
        useCase: 'bounty_payout',
        complianceRequired: true,
      });
      expect(result.mode).toBe('public');
      expect(result.reason).toContain('Compliance');
    });
  });

  describe('public required cases', () => {
    it('returns public for offboard', () => {
      const result = selectPaymentMode({
        useCase: 'offboard',
      });
      expect(result.mode).toBe('public');
      expect(result.reason).toContain('requires public');
    });
  });

  describe('receiver capability', () => {
    it('returns public when receiver lacks Coinage', () => {
      const result = selectPaymentMode({
        useCase: 'bounty_payout',
        receiverHasCoinage: false,
      });
      expect(result.mode).toBe('public');
      expect(result.reason).toContain('Coinage capability');
    });
  });

  describe('receiver preference', () => {
    it('respects receiver public preference', () => {
      const result = selectPaymentMode({
        useCase: 'membership',
        receiverPreference: 'public',
      });
      expect(result.mode).toBe('public');
      expect(result.reason).toContain('Receiver requested');
    });

    it('warns when receiver requests public for sensitive case', () => {
      const result = selectPaymentMode({
        useCase: 'bounty_payout',
        receiverPreference: 'public',
      });
      expect(result.mode).toBe('public');
      expect(result.warning).toContain('expose sensitive');
    });

    it('does not warn for non-sensitive case', () => {
      const result = selectPaymentMode({
        useCase: 'membership',
        receiverPreference: 'public',
      });
      expect(result.warning).toBeUndefined();
    });
  });

  describe('sender preference', () => {
    it('respects sender preference', () => {
      const result = selectPaymentMode({
        useCase: 'membership',
        senderPreference: 'private',
      });
      expect(result.mode).toBe('private');
      expect(result.reason).toContain('sender preference');
    });

    it('warns when sender requests public for sensitive case', () => {
      const result = selectPaymentMode({
        useCase: 'bounty_payout',
        senderPreference: 'public',
      });
      expect(result.mode).toBe('public');
      expect(result.warning).toContain('expose sensitive');
    });
  });

  describe('defaults', () => {
    it('uses default for bounty_payout', () => {
      const result = selectPaymentMode({
        useCase: 'bounty_payout',
      });
      expect(result.mode).toBe('private');
      expect(result.reason).toContain('Default');
    });

    it('uses default for membership', () => {
      const result = selectPaymentMode({
        useCase: 'membership',
      });
      expect(result.mode).toBe('public');
      expect(result.reason).toContain('Default');
    });
  });
});

describe('supportsBothModes', () => {
  it('returns true for bounty_payout', () => {
    expect(supportsBothModes('bounty_payout')).toBe(true);
  });

  it('returns true for membership', () => {
    expect(supportsBothModes('membership')).toBe(true);
  });

  it('returns false for offboard', () => {
    expect(supportsBothModes('offboard')).toBe(false);
  });
});

describe('describePaymentMode', () => {
  it('describes public mode', () => {
    const desc = describePaymentMode('public');
    expect(desc.name).toContain('Public');
    expect(desc.name).toContain('pUSD');
    expect(desc.features).toContain('Transactions visible on-chain');
  });

  it('describes private mode', () => {
    const desc = describePaymentMode('private');
    expect(desc.name).toContain('Private');
    expect(desc.name).toContain('Coinage');
    expect(desc.features).toContain('Sender and receiver identities hidden');
  });
});

describe('getRecommendation', () => {
  it('strongly recommends private for high sensitivity', () => {
    const rec = getRecommendation('bounty_payout');
    expect(rec).toContain('strongly recommended');
    expect(rec).toContain('protect');
  });

  it('notes requirement for public-only cases', () => {
    const rec = getRecommendation('offboard');
    expect(rec).toContain('required');
  });

  it('recommends private for private-default cases', () => {
    const rec = getRecommendation('contribution');
    expect(rec).toContain('Private mode recommended');
  });

  it('recommends public for public-default cases', () => {
    const rec = getRecommendation('membership');
    expect(rec).toContain('Public mode recommended');
  });
});

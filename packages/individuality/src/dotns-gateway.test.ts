/**
 * Tests for DotNS Gateway Extension support.
 *
 * Test vectors are derived from the Rust implementation in:
 * individuality/support/src/labels.rs
 * individuality/pallets/dotns-gateway/src/tests.rs
 *
 * @license GPL-3.0
 */

import { describe, it, expect } from 'vitest';
import {
  isValidLiteLabel,
  isValidPersonLabel,
  MIN_LITE_USERNAME_DIGITS,
  MAX_LABEL_BYTES,
} from './types';
import {
  validateLiteNameReservation,
  validateBaseNameReservation,
  validateFullNameRegistration,
  isGatewayAvailable,
} from './dotns-gateway';
import type { DotNsGatewayApi } from './dotns-gateway';
import type { PolkadotAddress } from '@cocuyo/types';

// ============================================================================
// Label Validation Tests (parity with Rust labels.rs)
// ============================================================================

describe('isValidPersonLabel', () => {
  describe('accepts valid full-person labels', () => {
    it.each([['a'], ['alice'], ['bob'], ['verylongnamewithmanyletters']])(
      'accepts "%s"',
      (label) => {
        expect(isValidPersonLabel(label)).toBe(true);
      }
    );
  });

  describe('rejects invalid labels', () => {
    it('rejects empty string', () => {
      expect(isValidPersonLabel('')).toBe(false);
    });

    it.each([
      ['alice42', 'digits'],
      ['alice-bob', 'hyphens'],
      ['123', 'all digits'],
      ['-', 'hyphen only'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidPersonLabel(label)).toBe(false);
    });

    it.each([
      ['Alice', 'uppercase'],
      ['alice.bob', 'dot'],
      ['ali_ce', 'underscore'],
      ['ali ce', 'space'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidPersonLabel(label)).toBe(false);
    });

    it('rejects labels exceeding 32 bytes', () => {
      const longLabel = 'a'.repeat(33);
      expect(isValidPersonLabel(longLabel)).toBe(false);
    });

    it('accepts labels exactly 32 bytes', () => {
      const maxLabel = 'a'.repeat(32);
      expect(isValidPersonLabel(maxLabel)).toBe(true);
    });
  });
});

describe('isValidLiteLabel', () => {
  describe('accepts valid lite-person labels', () => {
    // Test vectors from Rust labels.rs lite_person_label_accepts_valid
    it.each([
      ['a.42'],
      ['alice.42'],
      ['alice.123456'],
      ['a-b.99'],
      ['123.99'], // DNS stem can start with digit
    ])('accepts "%s"', (label) => {
      expect(isValidLiteLabel(label)).toBe(true);
    });
  });

  describe('rejects missing or short suffix', () => {
    // Test vectors from Rust lite_person_label_rejects_missing_or_short_suffix
    it.each([
      ['alice', 'no dot'],
      ['alice.', 'empty suffix'],
      ['alice.1', 'single digit'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidLiteLabel(label)).toBe(false);
    });
  });

  describe('rejects bad suffix characters', () => {
    // Test vectors from Rust lite_person_label_rejects_bad_suffix_characters
    it.each([
      ['alice.4a', 'letter in suffix'],
      ['alice.-42', 'hyphen in suffix'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidLiteLabel(label)).toBe(false);
    });
  });

  describe('rejects multi-dot or empty stem', () => {
    // Test vectors from Rust lite_person_label_rejects_multi_dot_or_empty_stem
    it.each([
      ['alice..42', 'double dot'],
      ['a.b.42', 'multiple dots'],
      ['.42', 'empty stem'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidLiteLabel(label)).toBe(false);
    });
  });

  describe('rejects hyphen adjacent to dot', () => {
    // Test vectors from Rust lite_person_label_rejects_hyphen_adjacent_to_dot
    it.each([
      ['-alice.42', 'leading hyphen'],
      ['alice-.42', 'trailing hyphen before dot'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidLiteLabel(label)).toBe(false);
    });
  });

  describe('rejects too short', () => {
    // Test vectors from Rust lite_person_label_rejects_too_short
    it.each([
      ['', 'empty'],
      ['a', 'single char'],
      ['a.', 'char and dot'],
      ['.1', 'dot and single digit'],
    ])('rejects "%s" (%s)', (label) => {
      expect(isValidLiteLabel(label)).toBe(false);
    });
  });

  describe('enforces byte length limits', () => {
    it('rejects labels exceeding 32 bytes', () => {
      // 30 chars for stem + 1 dot + 2 digits = 33 bytes
      const longStem = 'a'.repeat(30);
      expect(isValidLiteLabel(`${longStem}.42`)).toBe(false);
    });

    it('accepts labels exactly 32 bytes', () => {
      // 29 chars for stem + 1 dot + 2 digits = 32 bytes
      const maxStem = 'a'.repeat(29);
      expect(isValidLiteLabel(`${maxStem}.42`)).toBe(true);
    });
  });
});

describe('label constants', () => {
  it('MIN_LITE_USERNAME_DIGITS matches Rust', () => {
    expect(MIN_LITE_USERNAME_DIGITS).toBe(2);
  });

  it('MAX_LABEL_BYTES matches Rust BaseLabel bound', () => {
    expect(MAX_LABEL_BYTES).toBe(32);
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('validateLiteNameReservation', () => {
  const validParams = {
    liteLabel: 'alice.42',
    user: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress,
    chatKey: '0x' + '04'.repeat(65), // 65 bytes = 130 hex chars
  };

  it('accepts valid parameters', () => {
    expect(validateLiteNameReservation(validParams)).toEqual({ valid: true });
  });

  it('rejects invalid lite label', () => {
    const result = validateLiteNameReservation({
      ...validParams,
      liteLabel: 'invalid',
    });
    expect(result).toEqual({ valid: false, error: 'InvalidLiteLabel' });
  });

  it('rejects invalid chat key (wrong length)', () => {
    const result = validateLiteNameReservation({
      ...validParams,
      chatKey: '0x1234', // Too short
    });
    expect(result).toEqual({ valid: false, error: 'InvalidName' });
  });

  it('rejects invalid chat key (non-hex)', () => {
    const result = validateLiteNameReservation({
      ...validParams,
      chatKey: '0x' + 'zz'.repeat(65), // Invalid hex
    });
    expect(result).toEqual({ valid: false, error: 'InvalidName' });
  });

  it('accepts chat key without 0x prefix', () => {
    const result = validateLiteNameReservation({
      ...validParams,
      chatKey: '04'.repeat(65),
    });
    expect(result).toEqual({ valid: true });
  });
});

describe('validateBaseNameReservation', () => {
  const validParams = {
    lite: {
      liteLabel: 'alice.42',
      user: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress,
      chatKey: '0x' + '04'.repeat(65),
    },
    reservedBaseLabel: 'alice',
  };

  it('accepts valid parameters', () => {
    expect(validateBaseNameReservation(validParams)).toEqual({ valid: true });
  });

  it('rejects invalid reserved base label (has digits)', () => {
    const result = validateBaseNameReservation({
      ...validParams,
      reservedBaseLabel: 'alice42',
    });
    expect(result).toEqual({ valid: false, error: 'InvalidBaseLabel' });
  });

  it('rejects invalid reserved base label (too long)', () => {
    const result = validateBaseNameReservation({
      ...validParams,
      reservedBaseLabel: 'a'.repeat(33),
    });
    expect(result).toEqual({ valid: false, error: 'InvalidBaseLabel' });
  });

  it('propagates lite validation errors', () => {
    const result = validateBaseNameReservation({
      ...validParams,
      lite: { ...validParams.lite, liteLabel: 'invalid' },
    });
    expect(result).toEqual({ valid: false, error: 'InvalidLiteLabel' });
  });
});

describe('validateFullNameRegistration', () => {
  const validParamsWithLite = {
    label: 'alice',
    user: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress,
    link: { type: 'LiteUsername' as const, liteLabel: 'alice.42' },
  };

  const validParamsWithChatKey = {
    label: 'bob',
    user: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress,
    link: { type: 'None' as const, chatKey: '0x' + '04'.repeat(65) },
  };

  it('accepts valid parameters with LiteUsername link', () => {
    expect(validateFullNameRegistration(validParamsWithLite)).toEqual({ valid: true });
  });

  it('accepts valid parameters with None link', () => {
    expect(validateFullNameRegistration(validParamsWithChatKey)).toEqual({ valid: true });
  });

  it('rejects invalid full-person label', () => {
    const result = validateFullNameRegistration({
      ...validParamsWithLite,
      label: 'alice42', // Has digits
    });
    expect(result).toEqual({ valid: false, error: 'InvalidName' });
  });

  it('rejects invalid lite label in link', () => {
    const result = validateFullNameRegistration({
      ...validParamsWithLite,
      link: { type: 'LiteUsername', liteLabel: 'invalid' },
    });
    expect(result).toEqual({ valid: false, error: 'InvalidLiteLabel' });
  });

  it('rejects invalid chat key in link', () => {
    const result = validateFullNameRegistration({
      ...validParamsWithChatKey,
      link: { type: 'None', chatKey: 'invalid' },
    });
    expect(result).toEqual({ valid: false, error: 'InvalidName' });
  });
});

// ============================================================================
// Gateway Availability Tests
// ============================================================================

describe('isGatewayAvailable', () => {
  it('returns true when DotnsGateway namespace exists', () => {
    const api: DotNsGatewayApi = {
      query: {
        DotnsGateway: {
          AliasRegistration: {
            getValue: () => Promise.resolve(undefined),
          },
        },
      },
    };
    expect(isGatewayAvailable(api)).toBe(true);
  });

  it('returns false when DotnsGateway namespace is missing', () => {
    const api: DotNsGatewayApi = {
      query: {},
    };
    expect(isGatewayAvailable(api)).toBe(false);
  });
});

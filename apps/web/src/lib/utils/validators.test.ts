/**
 * Tests for route parameter validators.
 */

import { describe, it, expect } from 'vitest';
import {
  validateChainId,
  validateCampaignId,
  validatePostId,
  validateClaimId,
  validateLocale,
} from './validators';

describe('validateChainId', () => {
  it('returns branded ChainId for valid string', () => {
    const result = validateChainId('chain-123');
    expect(result).toBe('chain-123');
  });

  it('returns null for empty string', () => {
    expect(validateChainId('')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(validateChainId(null)).toBeNull();
    expect(validateChainId(undefined)).toBeNull();
    expect(validateChainId(123)).toBeNull();
    expect(validateChainId({})).toBeNull();
    expect(validateChainId([])).toBeNull();
  });
});

describe('validateCampaignId', () => {
  it('returns branded CampaignId for valid string', () => {
    const result = validateCampaignId('campaign-456');
    expect(result).toBe('campaign-456');
  });

  it('returns null for empty string', () => {
    expect(validateCampaignId('')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(validateCampaignId(null)).toBeNull();
    expect(validateCampaignId(undefined)).toBeNull();
    expect(validateCampaignId(123)).toBeNull();
  });
});

describe('validatePostId', () => {
  it('returns branded PostId for valid string', () => {
    const result = validatePostId('post-789');
    expect(result).toBe('post-789');
  });

  it('returns null for empty string', () => {
    expect(validatePostId('')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(validatePostId(null)).toBeNull();
    expect(validatePostId(undefined)).toBeNull();
    expect(validatePostId(123)).toBeNull();
  });
});

describe('validateClaimId', () => {
  it('returns branded ClaimId for valid string', () => {
    const result = validateClaimId('claim-abc');
    expect(result).toBe('claim-abc');
  });

  it('returns null for empty string', () => {
    expect(validateClaimId('')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(validateClaimId(null)).toBeNull();
    expect(validateClaimId(undefined)).toBeNull();
    expect(validateClaimId(123)).toBeNull();
  });
});

describe('validateLocale', () => {
  it('returns "en" for English locale', () => {
    expect(validateLocale('en')).toBe('en');
  });

  it('returns "es" for Spanish locale', () => {
    expect(validateLocale('es')).toBe('es');
  });

  it('returns "en" as default for invalid locale', () => {
    expect(validateLocale('fr')).toBe('en');
    expect(validateLocale('de')).toBe('en');
    expect(validateLocale('')).toBe('en');
  });

  it('returns "en" for non-string values', () => {
    expect(validateLocale(null)).toBe('en');
    expect(validateLocale(undefined)).toBe('en');
    expect(validateLocale(123)).toBe('en');
  });
});

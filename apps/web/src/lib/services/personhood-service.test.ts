/**
 * Tests for PersonhoodService.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PersonhoodServiceImpl,
  personhoodService,
  setPersonhoodLevel,
  clearPersonhoodCache,
  requirePersonhood,
  PersonhoodRequiredError,
} from './personhood-service';
import { createDIMCredential, createPUSDAmount } from '@cocuyo/types';
import type { DIMCredential } from '@cocuyo/types';

describe('PersonhoodServiceImpl', () => {
  let service: PersonhoodServiceImpl;
  let testCredential: DIMCredential;

  beforeEach(() => {
    clearPersonhoodCache();
    service = new PersonhoodServiceImpl();
    testCredential = createDIMCredential('test-credential-123');
  });

  describe('getPersonhood', () => {
    it('returns lite level by default for new credentials', async () => {
      const state = await service.getPersonhood(testCredential);

      expect(state).not.toBeNull();
      expect(state?.level).toBe('lite');
      expect(state?.credential).toBe(testCredential);
      expect(state?.verifiedAt).toBeGreaterThan(0);
    });

    it('returns cached state on subsequent calls', async () => {
      const firstState = await service.getPersonhood(testCredential);
      const secondState = await service.getPersonhood(testCredential);

      expect(firstState).toEqual(secondState);
    });
  });

  describe('getLevel', () => {
    it('returns default lite level', async () => {
      const level = await service.getLevel(testCredential);
      expect(level).toBe('lite');
    });

    it('returns updated level after setPersonhoodLevel', async () => {
      setPersonhoodLevel(testCredential, 'full');
      const level = await service.getLevel(testCredential);
      expect(level).toBe('full');
    });
  });

  describe('getCapabilities', () => {
    it('returns correct capabilities for lite level', async () => {
      const caps = await service.getCapabilities(testCredential);

      expect(caps.canIlluminate).toBe(true);
      expect(caps.canCorroborate).toBe(true);
      expect(caps.canChallenge).toBe(true);
      expect(caps.canFundBounty).toBe(true);
      expect(caps.canClaimPayout).toBe(true);
      expect(caps.canReceiveCoinage).toBe(true);
    });

    it('returns correct capabilities for full level', async () => {
      setPersonhoodLevel(testCredential, 'full');
      const caps = await service.getCapabilities(testCredential);

      expect(caps.canIlluminate).toBe(true);
      expect(caps.canCorroborate).toBe(true);
      expect(caps.canChallenge).toBe(true);
      expect(caps.canFundBounty).toBe(true);
      expect(caps.canClaimPayout).toBe(true);
      expect(caps.canReceiveCoinage).toBe(true);
    });

    it('returns correct capabilities for none level', async () => {
      setPersonhoodLevel(testCredential, 'none');
      const caps = await service.getCapabilities(testCredential);

      expect(caps.canIlluminate).toBe(false);
      expect(caps.canCorroborate).toBe(false);
      expect(caps.canChallenge).toBe(false);
      expect(caps.canFundBounty).toBe(false);
      expect(caps.canClaimPayout).toBe(false);
      expect(caps.canReceiveCoinage).toBe(false);
    });
  });

  describe('canPerform', () => {
    it('returns true for allowed actions at lite level', async () => {
      expect(await service.canPerform(testCredential, 'canIlluminate')).toBe(true);
      expect(await service.canPerform(testCredential, 'canCorroborate')).toBe(true);
    });

    it('returns true for all basic actions at lite level', async () => {
      expect(await service.canPerform(testCredential, 'canClaimPayout')).toBe(true);
      expect(await service.canPerform(testCredential, 'canFundBounty')).toBe(true);
    });

    it('returns false for all actions at none level', async () => {
      setPersonhoodLevel(testCredential, 'none');

      expect(await service.canPerform(testCredential, 'canIlluminate')).toBe(false);
      expect(await service.canPerform(testCredential, 'canCorroborate')).toBe(false);
    });
  });

  describe('canFundAmount / canClaimAmount (limit derivation)', () => {
    // Lite users are capped at $1,000 funding / $500 claim (6-decimal pUSD units).
    const UNDER_FUND = createPUSDAmount(999_000_000n);
    const OVER_FUND = createPUSDAmount(1_000_000_001n);
    const UNDER_CLAIM = createPUSDAmount(499_000_000n);
    const OVER_CLAIM = createPUSDAmount(500_000_001n);

    it('lite level allows amounts at or under the cap but rejects amounts above it', async () => {
      // default is lite
      expect(await service.canFundAmount(testCredential, UNDER_FUND)).toBe(true);
      expect(await service.canFundAmount(testCredential, OVER_FUND)).toBe(false);
      expect(await service.canClaimAmount(testCredential, UNDER_CLAIM)).toBe(true);
      expect(await service.canClaimAmount(testCredential, OVER_CLAIM)).toBe(false);
    });

    it('full level lifts the cap entirely', async () => {
      setPersonhoodLevel(testCredential, 'full');
      expect(await service.canFundAmount(testCredential, OVER_FUND)).toBe(true);
      expect(await service.canClaimAmount(testCredential, OVER_CLAIM)).toBe(true);
    });

    it('none level rejects any amount regardless of size', async () => {
      setPersonhoodLevel(testCredential, 'none');
      expect(await service.canFundAmount(testCredential, UNDER_FUND)).toBe(false);
      expect(await service.canClaimAmount(testCredential, UNDER_CLAIM)).toBe(false);
    });
  });

  describe('startVerification', () => {
    it('encodes the requested target level into the verification URL', async () => {
      const result = await service.startVerification({
        credential: testCredential,
        targetLevel: 'full',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.verificationUrl).toContain('target=full');
      }
    });
  });

  describe('completeVerification', () => {
    it('derives a full-level state with the verification method and persists it', async () => {
      // Start at lite so we observe an actual upgrade, not a no-op.
      expect(await service.getLevel(testCredential)).toBe('lite');

      const result = await service.completeVerification({
        credential: testCredential,
        verificationToken: 'mock-token',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.level).toBe('full');
        expect(result.value.verificationMethod).toBe('mock');
        expect(result.value.verifiedAt).toBeGreaterThan(0);
      }

      // The upgrade is durable: a later read sees full, and capabilities reflect it.
      const state = await service.getPersonhood(testCredential);
      expect(state?.level).toBe('full');
      expect(state?.verificationMethod).toBe('mock');
    });
  });

  describe('requirePersonhood (level-ordering enforcement)', () => {
    it('resolves when the current level meets the required level (lite >= lite)', async () => {
      // Default lite satisfies the default lite requirement.
      await expect(requirePersonhood(testCredential)).resolves.toBeUndefined();
    });

    it('resolves when the current level exceeds the requirement (full >= lite)', async () => {
      setPersonhoodLevel(testCredential, 'full');
      await expect(requirePersonhood(testCredential, 'lite')).resolves.toBeUndefined();
    });

    it('throws PersonhoodRequiredError when the current level is below the requirement (lite < full)', async () => {
      // default lite, require full
      await expect(requirePersonhood(testCredential, 'full')).rejects.toBeInstanceOf(
        PersonhoodRequiredError
      );
    });

    it('reports the required and current levels on the thrown error', async () => {
      setPersonhoodLevel(testCredential, 'none');
      let caught: unknown;
      try {
        await requirePersonhood(testCredential, 'full');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PersonhoodRequiredError);
      const err = caught as PersonhoodRequiredError;
      expect(err.requiredLevel).toBe('full');
      expect(err.currentLevel).toBe('none');
      expect(err.type).toBe('PERSONHOOD_REQUIRED');
    });
  });

  describe('setPersonhoodLevel helper', () => {
    it('sets level in cache', async () => {
      setPersonhoodLevel(testCredential, 'full');
      const level = await personhoodService.getLevel(testCredential);
      expect(level).toBe('full');
    });

    it('allows downgrading level', async () => {
      setPersonhoodLevel(testCredential, 'full');
      setPersonhoodLevel(testCredential, 'none');
      const level = await personhoodService.getLevel(testCredential);
      expect(level).toBe('none');
    });
  });

  describe('clearPersonhoodCache helper', () => {
    it('clears all cached state', async () => {
      // First call creates cached state at 'lite'
      await service.getPersonhood(testCredential);

      // Set to full to verify it's cached
      setPersonhoodLevel(testCredential, 'full');
      expect(await service.getLevel(testCredential)).toBe('full');

      // Clear cache
      clearPersonhoodCache();

      // Next call should create new state at default 'lite'
      expect(await service.getLevel(testCredential)).toBe('lite');
    });
  });
});

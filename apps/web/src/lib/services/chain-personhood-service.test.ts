/**
 * Tests for ChainPersonhoodService.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createDIMCredential } from '@cocuyo/types';

// Mock the chain client before importing the service
vi.mock('../chain/client', () => ({
  getFireflyChainAPI: vi.fn(),
}));

// Host detection defaults to "outside the container" so the existing tests see
// the plain chain results; the host-attested fallback suite flips it to true.
vi.mock('../host/detect', () => ({
  isInContainer: vi.fn(() => false),
}));

import {
  ChainPersonhoodServiceImpl,
  chainPersonhoodService,
  createCredentialForAccount,
  getAccountForCredential,
  clearChainPersonhoodCache,
  queryPersonhoodFromChain,
} from './chain-personhood-service';
import { getFireflyChainAPI } from '../chain/client';
import { isInContainer } from '../host/detect';

const mockGetFireflyChainAPI = vi.mocked(getFireflyChainAPI);
const mockIsInContainer = vi.mocked(isInContainer);

describe('ChainPersonhoodService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearChainPersonhoodCache();
  });

  afterEach(() => {
    clearChainPersonhoodCache();
  });

  describe('createCredentialForAccount', () => {
    it('creates credential from address', () => {
      const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const credential = createCredentialForAccount(address);

      expect(credential).toBe(`dim-${address}`);
    });

    it('registers mapping when creating credential', () => {
      const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const credential = createCredentialForAccount(address);

      expect(getAccountForCredential(credential)).toBe(address);
    });

    it('preserves address case for SS58 compatibility', () => {
      const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const credential = createCredentialForAccount(address);

      // Credential should contain exact address, no lowercasing
      expect(credential).toContain('5GrwvaEF');
      expect(credential).not.toContain('5grwvaef');
    });

    it('creates different credentials for addresses that differ only in case', () => {
      // This tests SS58 case sensitivity - different cases = different addresses
      const address1 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const address2 = '5grwvaef5zxb26fz9rcqpdws57cterhpnehxcpcnohgkutqy';

      const cred1 = createCredentialForAccount(address1);
      const cred2 = createCredentialForAccount(address2);

      expect(cred1).not.toBe(cred2);
    });

    it('handles hex addresses', () => {
      const hexAddress = '0x1234567890123456789012345678901234567890';
      const credential = createCredentialForAccount(hexAddress);

      expect(credential).toBe(`dim-${hexAddress}`);
      expect(getAccountForCredential(credential)).toBe(hexAddress);
    });
  });

  describe('getAccountForCredential', () => {
    it('returns undefined for unknown credential', () => {
      const unknownCredential = createDIMCredential('dim-unknown');
      expect(getAccountForCredential(unknownCredential)).toBeUndefined();
    });

    it('returns mapped address for known credential', () => {
      const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const credential = createCredentialForAccount(address);

      expect(getAccountForCredential(credential)).toBe(address);
    });
  });

  describe('clearChainPersonhoodCache', () => {
    it('clears credential-to-account mapping', () => {
      const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const credential = createCredentialForAccount(address);

      expect(getAccountForCredential(credential)).toBe(address);

      clearChainPersonhoodCache();

      expect(getAccountForCredential(credential)).toBeUndefined();
    });
  });

  describe('queryPersonhoodFromChain', () => {
    it('returns lite level when account is registered', async () => {
      mockGetFireflyChainAPI.mockResolvedValue({
        individuality: {
          query: {
            PeopleLite: {
              LitePeople: {
                getValue: vi.fn().mockResolvedValue({ some: 'data' }),
              },
            },
          },
        },
      } as never);

      const result = await queryPersonhoodFromChain('5GrwvaEF...');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.level).toBe('lite');
      }
    });

    it('returns none level when account is not registered', async () => {
      mockGetFireflyChainAPI.mockResolvedValue({
        individuality: {
          query: {
            PeopleLite: {
              LitePeople: {
                getValue: vi.fn().mockResolvedValue(undefined),
              },
            },
          },
        },
      } as never);

      const result = await queryPersonhoodFromChain('5GrwvaEF...');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.level).toBe('none');
      }
    });

    it('returns error when chain query fails', async () => {
      mockGetFireflyChainAPI.mockRejectedValue(new Error('Connection failed'));

      const result = await queryPersonhoodFromChain('5GrwvaEF...');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('Connection failed');
      }
    });

    it('handles null result as not registered', async () => {
      mockGetFireflyChainAPI.mockResolvedValue({
        individuality: {
          query: {
            PeopleLite: {
              LitePeople: {
                getValue: vi.fn().mockResolvedValue(null),
              },
            },
          },
        },
      } as never);

      const result = await queryPersonhoodFromChain('5GrwvaEF...');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.level).toBe('none');
      }
    });
  });

  describe('ChainPersonhoodServiceImpl', () => {
    let service: ChainPersonhoodServiceImpl;

    beforeEach(() => {
      service = new ChainPersonhoodServiceImpl();
    });

    describe('getPersonhood', () => {
      it('returns null when no mapping exists for credential', async () => {
        const unknownCredential = createDIMCredential('dim-no-mapping');

        const state = await service.getPersonhood(unknownCredential);

        expect(state).toBeNull();
      });

      it('returns state with lite level when account is registered', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue({ registered: true }),
                },
              },
            },
          },
        } as never);

        const state = await service.getPersonhood(credential);

        expect(state).not.toBeNull();
        expect(state?.level).toBe('lite');
        expect(state?.credential).toBe(credential);
        expect(state?.verificationMethod).toBe('peoplelite');
      });

      it('returns state with none level when account is not registered', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue(undefined),
                },
              },
            },
          },
        } as never);

        const state = await service.getPersonhood(credential);

        expect(state).not.toBeNull();
        expect(state?.level).toBe('none');
        expect(state?.verificationMethod).toBeUndefined();
      });

      it('returns null when chain query fails', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockRejectedValue(new Error('Network error'));

        const state = await service.getPersonhood(credential);

        expect(state).toBeNull();
      });

      it('caches successful query results', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);
        const mockGetValue = vi.fn().mockResolvedValue({ registered: true });

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: mockGetValue,
                },
              },
            },
          },
        } as never);

        // First call
        await service.getPersonhood(credential);
        // Second call should use cache
        await service.getPersonhood(credential);

        // Chain should only be queried once
        expect(mockGetFireflyChainAPI).toHaveBeenCalledTimes(1);
      });

      it('caches failure briefly to avoid hammering chain', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockRejectedValue(new Error('Network error'));

        // First call - triggers query
        await service.getPersonhood(credential);
        // Second call - should use cached failure
        await service.getPersonhood(credential);

        // Chain should only be queried once due to failure cache
        expect(mockGetFireflyChainAPI).toHaveBeenCalledTimes(1);
      });
    });

    describe('getPersonhood host-attested fallback (inside container)', () => {
      beforeEach(() => {
        mockIsInContainer.mockReturnValue(true);
      });

      afterEach(() => {
        mockIsInContainer.mockReturnValue(false);
      });

      it('host-attests lite when the account is unregistered on chain', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue(undefined),
                },
              },
            },
          },
        } as never);

        const state = await service.getPersonhood(credential);

        expect(state?.level).toBe('lite');
        expect(state?.verificationMethod).toBe('host-attested');
      });

      it('host-attests lite when the chain query fails', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockRejectedValue(new Error('Network error'));

        const state = await service.getPersonhood(credential);

        expect(state?.level).toBe('lite');
        expect(state?.verificationMethod).toBe('host-attested');
      });

      it('still reports peoplelite when the account is registered on chain', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue({ registered: true }),
                },
              },
            },
          },
        } as never);

        const state = await service.getPersonhood(credential);

        expect(state?.level).toBe('lite');
        expect(state?.verificationMethod).toBe('peoplelite');
      });
    });

    describe('getLevel', () => {
      it('returns level from personhood state', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue({ registered: true }),
                },
              },
            },
          },
        } as never);

        const level = await service.getLevel(credential);

        expect(level).toBe('lite');
      });

      it('returns none when personhood lookup fails', async () => {
        const unknownCredential = createDIMCredential('dim-unknown');

        const level = await service.getLevel(unknownCredential);

        expect(level).toBe('none');
      });
    });

    describe('getCapabilities', () => {
      it('returns lite capabilities for lite level', async () => {
        const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
        const credential = createCredentialForAccount(address);

        mockGetFireflyChainAPI.mockResolvedValue({
          individuality: {
            query: {
              PeopleLite: {
                LitePeople: {
                  getValue: vi.fn().mockResolvedValue({ registered: true }),
                },
              },
            },
          },
        } as never);

        const caps = await service.getCapabilities(credential);

        expect(caps.canIlluminate).toBe(true);
        expect(caps.canCorroborate).toBe(true);
      });

      it('returns none capabilities when lookup fails', async () => {
        const unknownCredential = createDIMCredential('dim-unknown');

        const caps = await service.getCapabilities(unknownCredential);

        expect(caps.canIlluminate).toBe(false);
        expect(caps.canCorroborate).toBe(false);
      });
    });

    describe('startVerification', () => {
      it('returns an honest not-available error citing the verifier service', async () => {
        const credential = createDIMCredential('dim-test');

        const result = await service.startVerification({
          credential,
          targetLevel: 'full',
        });

        expect(result.ok).toBe(false);
        if (!result.ok && result.error.type === 'VERIFICATION_FAILED') {
          // Honest: cannot self-attest; needs the AttestationAllowance-holding verifier.
          expect(result.error.reason).toContain('not available');
          expect(result.error.reason).toContain('AttestationAllowance');
        } else {
          throw new Error('Expected VERIFICATION_FAILED error');
        }
      });
    });

    describe('completeVerification', () => {
      it('returns an honest error: completion is observed from on-chain state', async () => {
        const credential = createDIMCredential('dim-test');

        const result = await service.completeVerification({
          credential,
          verificationToken: 'token',
        });

        expect(result.ok).toBe(false);
        if (!result.ok && result.error.type === 'VERIFICATION_FAILED') {
          expect(result.error.reason).toContain('on-chain');
        } else {
          throw new Error('Expected VERIFICATION_FAILED error');
        }
      });
    });

    describe('supportsVerification', () => {
      it('is false for chain service', () => {
        expect(service.supportsVerification).toBe(false);
      });
    });
  });

  describe('singleton instance', () => {
    it('exports chainPersonhoodService singleton', () => {
      expect(chainPersonhoodService).toBeInstanceOf(ChainPersonhoodServiceImpl);
    });
  });
});

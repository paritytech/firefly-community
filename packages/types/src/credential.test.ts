import { describe, it, expect } from 'vitest';
import { createPolkadotAddress } from './brands';
import {
  deriveCredential,
  deriveCredentialFromString,
  extractAddressFromCredential,
  credentialMatchesAddress,
} from './credential';

describe('credential derivation', () => {
  const testAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  const typedAddress = createPolkadotAddress(testAddress);

  describe('deriveCredential', () => {
    it('derives credential from typed PolkadotAddress', () => {
      const credential = deriveCredential(typedAddress);
      expect(credential).toBe(`dim-${testAddress}`);
    });

    it('is deterministic - same address always produces same credential', () => {
      const cred1 = deriveCredential(typedAddress);
      const cred2 = deriveCredential(typedAddress);
      expect(cred1).toBe(cred2);
    });

    it('preserves case for SS58 addresses', () => {
      const mixedCase = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
      const credential = deriveCredential(mixedCase);
      expect(credential).toContain('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    });
  });

  describe('deriveCredentialFromString', () => {
    it('derives credential from raw string address', () => {
      const credential = deriveCredentialFromString(testAddress);
      expect(credential).toBe(`dim-${testAddress}`);
    });

    it('produces same result as deriveCredential', () => {
      const fromString = deriveCredentialFromString(testAddress);
      const fromTyped = deriveCredential(typedAddress);
      expect(fromString).toBe(fromTyped);
    });

    it('works with hex addresses', () => {
      const hexAddress = '0xd43593c715fdd31c61141abd04a99fd6822c8558';
      const credential = deriveCredentialFromString(hexAddress);
      expect(credential).toBe(`dim-${hexAddress}`);
    });
  });

  describe('extractAddressFromCredential', () => {
    it('extracts address from valid credential', () => {
      const credential = deriveCredentialFromString(testAddress);
      const extracted = extractAddressFromCredential(credential);
      expect(extracted).toBe(testAddress);
    });

    it('returns null for invalid credential format', () => {
      // Cast to bypass type checking for invalid credentials
      const invalid = 'invalid-credential' as ReturnType<typeof deriveCredentialFromString>;
      const extracted = extractAddressFromCredential(invalid);
      expect(extracted).toBeNull();
    });
  });

  describe('credentialMatchesAddress', () => {
    it('returns true when credential matches address', () => {
      const credential = deriveCredentialFromString(testAddress);
      expect(credentialMatchesAddress(credential, testAddress)).toBe(true);
    });

    it('returns false when credential does not match address', () => {
      const credential = deriveCredentialFromString(testAddress);
      const otherAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
      expect(credentialMatchesAddress(credential, otherAddress)).toBe(false);
    });
  });
});

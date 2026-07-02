import { describe, it, expect } from 'vitest';
import {
  calculateCID,
  calculateCIDFromString,
  calculateCIDFromJSON,
  isValidCID,
  parseCID,
} from './cid';

describe('CID Calculation', () => {
  describe('calculateCID', () => {
    it('produces a valid CIDv1 string', () => {
      const bytes = new TextEncoder().encode('hello world');
      const cid = calculateCID(bytes);

      expect(typeof cid).toBe('string');
      expect(cid.startsWith('b')).toBe(true); // CIDv1 base32 starts with 'b'
      expect(isValidCID(cid)).toBe(true);
    });

    it('is deterministic (same input = same output)', () => {
      const bytes = new TextEncoder().encode('test content');
      const cid1 = calculateCID(bytes);
      const cid2 = calculateCID(bytes);

      expect(cid1).toBe(cid2);
    });

    it('produces different CIDs for different content', () => {
      const bytes1 = new TextEncoder().encode('content A');
      const bytes2 = new TextEncoder().encode('content B');

      const cid1 = calculateCID(bytes1);
      const cid2 = calculateCID(bytes2);

      expect(cid1).not.toBe(cid2);
    });

    it('handles empty input', () => {
      const bytes = new Uint8Array(0);
      const cid = calculateCID(bytes);

      expect(isValidCID(cid)).toBe(true);
    });

    it('handles large input', () => {
      const bytes = new Uint8Array(1024 * 1024); // 1MB
      bytes.fill(42);
      const cid = calculateCID(bytes);

      expect(isValidCID(cid)).toBe(true);
    });
  });

  describe('calculateCIDFromString', () => {
    it('calculates CID from string content', () => {
      const cid = calculateCIDFromString('hello world');

      expect(isValidCID(cid)).toBe(true);
    });

    it('produces same result as manual encoding', () => {
      const content = 'test string';
      const cidFromString = calculateCIDFromString(content);
      const cidFromBytes = calculateCID(new TextEncoder().encode(content));

      expect(cidFromString).toBe(cidFromBytes);
    });

    it('handles unicode content', () => {
      const cid = calculateCIDFromString('こんにちは世界 🌍');

      expect(isValidCID(cid)).toBe(true);
    });
  });

  describe('calculateCIDFromJSON', () => {
    it('calculates CID from JSON object', () => {
      const data = { message: 'hello', count: 42 };
      const cid = calculateCIDFromJSON(data);

      expect(isValidCID(cid)).toBe(true);
    });

    it('is deterministic for same object', () => {
      const data = { a: 1, b: 2 };
      const cid1 = calculateCIDFromJSON(data);
      const cid2 = calculateCIDFromJSON(data);

      expect(cid1).toBe(cid2);
    });

    it('handles nested objects', () => {
      const data = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
        array: [1, 2, 3],
      };
      const cid = calculateCIDFromJSON(data);

      expect(isValidCID(cid)).toBe(true);
    });

    it('handles arrays', () => {
      const data = [1, 2, 3, 'four', { five: 5 }];
      const cid = calculateCIDFromJSON(data);

      expect(isValidCID(cid)).toBe(true);
    });
  });

  describe('isValidCID', () => {
    it('returns true for valid CID', () => {
      const cid = calculateCIDFromString('test');
      expect(isValidCID(cid)).toBe(true);
    });

    it('returns false for invalid strings', () => {
      expect(isValidCID('not-a-cid')).toBe(false);
      expect(isValidCID('')).toBe(false);
      expect(isValidCID('12345')).toBe(false);
    });

    it('returns true for known CID formats', () => {
      // CIDv1 base32
      const cid = calculateCIDFromString('example');
      expect(isValidCID(cid)).toBe(true);
    });
  });

  describe('parseCID', () => {
    it('parses valid CID', () => {
      const cidString = calculateCIDFromString('test');
      const parsed = parseCID(cidString);

      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe(1);
    });

    it('returns null for invalid CID', () => {
      expect(parseCID('invalid')).toBeNull();
      expect(parseCID('')).toBeNull();
    });
  });
});

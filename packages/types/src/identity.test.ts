/**
 * Tests for identity helpers (RFC 0014).
 */

import { describe, it, expect } from 'vitest';
import { createDotNsIdentifier } from './identity';

describe('createDotNsIdentifier', () => {
  it('accepts a valid identifier', () => {
    expect(createDotNsIdentifier('alice.dot')).toBe('alice.dot');
  });

  it('rejects an empty string', () => {
    expect(() => createDotNsIdentifier('')).toThrow(/cannot be empty/);
  });

  it('rejects an identifier longer than 256 chars', () => {
    const tooLong = 'a'.repeat(257);
    expect(() => createDotNsIdentifier(tooLong)).toThrow(/too long/);
  });

  it('accepts an identifier exactly at the 256 char boundary', () => {
    const atLimit = 'a'.repeat(256);
    expect(createDotNsIdentifier(atLimit)).toBe(atLimit);
  });
});

/**
 * Tests for DIM client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDIMCredential } from '@cocuyo/types';
import { createDIMClient, generatePseudonym, type DIMCredentialInfo } from './dim-client';

describe('createDIMClient', () => {
  describe('with mock credential', () => {
    it('returns verified status when credential is valid', async () => {
      const mockCredential: DIMCredentialInfo = {
        hash: createDIMCredential('test-credential'),
        isValid: true,
        verifiedAt: Date.now(),
      };

      const client = await createDIMClient({ mockCredential });
      const status = await client.getStatus();

      expect(status).toBe('verified');
    });

    it('returns unverified status when credential is invalid', async () => {
      const mockCredential: DIMCredentialInfo = {
        hash: createDIMCredential('test-credential'),
        isValid: false,
        verifiedAt: Date.now(),
      };

      const client = await createDIMClient({ mockCredential });
      const status = await client.getStatus();

      expect(status).toBe('unverified');
    });

    it('returns expired status when credential has expired', async () => {
      const mockCredential: DIMCredentialInfo = {
        hash: createDIMCredential('test-credential'),
        isValid: true,
        verifiedAt: Date.now() - 1000,
        expiresAt: Date.now() - 1, // Expired 1ms ago
      };

      const client = await createDIMClient({ mockCredential });
      const status = await client.getStatus();

      expect(status).toBe('expired');
    });

    it('returns the credential via getCredential', async () => {
      const mockCredential: DIMCredentialInfo = {
        hash: createDIMCredential('test-credential'),
        isValid: true,
        verifiedAt: Date.now(),
      };

      const client = await createDIMClient({ mockCredential });
      const credential = await client.getCredential();

      expect(credential).toEqual(mockCredential);
    });
  });

  describe('without mock credential', () => {
    it('returns unverified status initially', async () => {
      const client = await createDIMClient();
      const status = await client.getStatus();

      expect(status).toBe('unverified');
    });

    it('returns null credential initially', async () => {
      const client = await createDIMClient();
      const credential = await client.getCredential();

      expect(credential).toBeNull();
    });

    it('verify() creates a new credential', async () => {
      vi.useFakeTimers();
      const client = await createDIMClient();

      const verifyPromise = client.verify();
      await vi.advanceTimersByTimeAsync(1000);
      const credential = await verifyPromise;

      expect(credential.isValid).toBe(true);
      expect(credential.hash).toBeDefined();
      expect(credential.verifiedAt).toBeDefined();

      vi.useRealTimers();
    });

    it('sign() rejects when no credential', async () => {
      const client = await createDIMClient();
      const data = new Uint8Array([1, 2, 3]);

      await expect(client.sign(data)).rejects.toThrow('No credential available');
    });

    it('sign() returns signature when credential exists', async () => {
      const mockCredential: DIMCredentialInfo = {
        hash: createDIMCredential('test-credential'),
        isValid: true,
        verifiedAt: Date.now(),
      };

      const client = await createDIMClient({ mockCredential });
      const data = new Uint8Array([1, 2, 3]);
      const signature = await client.sign(data);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('verifySignature() returns true for mock client', async () => {
      const client = await createDIMClient();
      const data = new Uint8Array([1, 2, 3]);
      const signature = new Uint8Array(64);
      const credential = createDIMCredential('test');

      const result = await client.verifySignature(data, signature, credential);

      expect(result).toBe(true);
    });
  });
});

describe('createDIMClient in production mode', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Mock being inside an iframe (Triangle host)
    globalThis.window = {
      self: { id: 'self' },
      top: { id: 'top' }, // Different from self = we're in an iframe
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.resetModules();
  });

  it('creates production client when in Triangle host', async () => {
    // Mock the host-api-wrapper module
    vi.mock('@novasamatech/host-api-wrapper', () => ({
      createPapiProvider: vi.fn(),
    }));

    const client = await createDIMClient();

    // Production client returns 'unverified' by default
    const status = await client.getStatus();
    expect(status).toBe('unverified');
  });

  it('production client getCredential returns null', async () => {
    vi.mock('@novasamatech/host-api-wrapper', () => ({
      createPapiProvider: vi.fn(),
    }));

    const client = await createDIMClient();
    const credential = await client.getCredential();

    expect(credential).toBeNull();
  });

  it('production client verify() rejects with not implemented', async () => {
    vi.mock('@novasamatech/host-api-wrapper', () => ({
      createPapiProvider: vi.fn(),
    }));

    const client = await createDIMClient();

    await expect(client.verify()).rejects.toThrow('DIM verification not yet implemented');
  });

  it('production client sign() rejects with not implemented', async () => {
    vi.mock('@novasamatech/host-api-wrapper', () => ({
      createPapiProvider: vi.fn(),
    }));

    const client = await createDIMClient();
    const data = new Uint8Array([1, 2, 3]);

    await expect(client.sign(data)).rejects.toThrow('DIM signing not yet implemented');
  });

  it('production client verifySignature() returns false', async () => {
    vi.mock('@novasamatech/host-api-wrapper', () => ({
      createPapiProvider: vi.fn(),
    }));

    const client = await createDIMClient();
    const data = new Uint8Array([1, 2, 3]);
    const signature = new Uint8Array(64);
    const credential = createDIMCredential('test');

    const result = await client.verifySignature(data, signature, credential);

    expect(result).toBe(false);
  });
});

describe('generatePseudonym', () => {
  it('returns a string in format Adjective+Noun-SUFFIX', () => {
    const credential = createDIMCredential('test-credential-hash');
    const pseudonym = generatePseudonym(credential);

    expect(pseudonym).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+-[A-Z0-9]{4}$/);
  });

  it('is deterministic - same credential produces same pseudonym', () => {
    const credential = createDIMCredential('consistent-hash');
    const pseudonym1 = generatePseudonym(credential);
    const pseudonym2 = generatePseudonym(credential);

    expect(pseudonym1).toBe(pseudonym2);
  });

  it('different credentials produce different pseudonyms', () => {
    const cred1 = createDIMCredential('hash-one');
    const cred2 = createDIMCredential('hash-two');

    const pseudonym1 = generatePseudonym(cred1);
    const pseudonym2 = generatePseudonym(cred2);

    expect(pseudonym1).not.toBe(pseudonym2);
  });

  it('uses last 4 characters of hash as suffix', () => {
    const credential = createDIMCredential('test-ABCD');
    const pseudonym = generatePseudonym(credential);

    expect(pseudonym).toContain('-ABCD');
  });
});

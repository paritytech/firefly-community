/**
 * Tests for error classes and type guards.
 */

import { describe, it, expect } from 'vitest';
import {
  FireflyError,
  SignerError,
  SignerNotConnectedError,
  SigningFailedError,
  ChainError,
  UploadError,
  FetchError,
  ConnectionError,
  isSignerError,
  isChainError,
  isSignerNotConnected,
  isUploadError,
} from './errors';

describe('FireflyError', () => {
  it('creates error with message', () => {
    const error = new FireflyError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('FireflyError');
  });

  it('extends Error', () => {
    const error = new FireflyError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('supports error cause via options', () => {
    const cause = new Error('cause');
    const error = new FireflyError('test', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('SignerError', () => {
  it('creates error with message', () => {
    const error = new SignerError('signer failed');
    expect(error.message).toBe('signer failed');
    expect(error.name).toBe('SignerError');
  });

  it('extends FireflyError', () => {
    const error = new SignerError('test');
    expect(error).toBeInstanceOf(FireflyError);
  });
});

describe('SignerNotConnectedError', () => {
  it('creates error with default message', () => {
    const error = new SignerNotConnectedError();
    expect(error.message).toBe('Wallet not connected');
    expect(error.name).toBe('SignerNotConnectedError');
  });

  it('allows custom message', () => {
    const error = new SignerNotConnectedError('Custom message');
    expect(error.message).toBe('Custom message');
  });

  it('extends SignerError', () => {
    const error = new SignerNotConnectedError();
    expect(error).toBeInstanceOf(SignerError);
  });
});

describe('SigningFailedError', () => {
  it('creates error with default message', () => {
    const error = new SigningFailedError();
    expect(error.message).toBe('Signing failed');
    expect(error.name).toBe('SigningFailedError');
  });

  it('allows custom message', () => {
    const error = new SigningFailedError('Transaction rejected');
    expect(error.message).toBe('Transaction rejected');
  });

  it('extends SignerError', () => {
    const error = new SigningFailedError();
    expect(error).toBeInstanceOf(SignerError);
  });
});

describe('ChainError', () => {
  it('creates error with message', () => {
    const error = new ChainError('chain error');
    expect(error.message).toBe('chain error');
    expect(error.name).toBe('ChainError');
  });

  it('extends FireflyError', () => {
    const error = new ChainError('test');
    expect(error).toBeInstanceOf(FireflyError);
  });
});

describe('UploadError', () => {
  it('creates error with default message', () => {
    const error = new UploadError();
    expect(error.message).toBe('Upload failed');
    expect(error.name).toBe('UploadError');
  });

  it('allows custom message', () => {
    const error = new UploadError('CID not returned');
    expect(error.message).toBe('CID not returned');
  });

  it('extends ChainError', () => {
    const error = new UploadError();
    expect(error).toBeInstanceOf(ChainError);
  });
});

describe('FetchError', () => {
  it('creates error with default message', () => {
    const error = new FetchError();
    expect(error.message).toBe('Fetch failed');
    expect(error.name).toBe('FetchError');
  });

  it('allows custom message', () => {
    const error = new FetchError('CID not found');
    expect(error.message).toBe('CID not found');
  });

  it('extends ChainError', () => {
    const error = new FetchError();
    expect(error).toBeInstanceOf(ChainError);
  });
});

describe('ConnectionError', () => {
  it('creates error with default message', () => {
    const error = new ConnectionError();
    expect(error.message).toBe('Chain connection failed');
    expect(error.name).toBe('ConnectionError');
  });

  it('allows custom message', () => {
    const error = new ConnectionError('Timeout');
    expect(error.message).toBe('Timeout');
  });

  it('extends ChainError', () => {
    const error = new ConnectionError();
    expect(error).toBeInstanceOf(ChainError);
  });
});

describe('isSignerError', () => {
  it('returns true for SignerError', () => {
    expect(isSignerError(new SignerError('test'))).toBe(true);
  });

  it('returns true for SignerError subclasses', () => {
    expect(isSignerError(new SignerNotConnectedError())).toBe(true);
    expect(isSignerError(new SigningFailedError())).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isSignerError(new Error('test'))).toBe(false);
    expect(isSignerError(new ChainError('test'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isSignerError(null)).toBe(false);
    expect(isSignerError(undefined)).toBe(false);
    expect(isSignerError('error')).toBe(false);
    expect(isSignerError({ message: 'error' })).toBe(false);
  });
});

describe('isChainError', () => {
  it('returns true for ChainError', () => {
    expect(isChainError(new ChainError('test'))).toBe(true);
  });

  it('returns true for ChainError subclasses', () => {
    expect(isChainError(new UploadError())).toBe(true);
    expect(isChainError(new FetchError())).toBe(true);
    expect(isChainError(new ConnectionError())).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isChainError(new Error('test'))).toBe(false);
    expect(isChainError(new SignerError('test'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isChainError(null)).toBe(false);
    expect(isChainError(undefined)).toBe(false);
  });
});

describe('isSignerNotConnected', () => {
  it('returns true for SignerNotConnectedError', () => {
    expect(isSignerNotConnected(new SignerNotConnectedError())).toBe(true);
  });

  it('returns false for other signer errors', () => {
    expect(isSignerNotConnected(new SignerError('test'))).toBe(false);
    expect(isSignerNotConnected(new SigningFailedError())).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isSignerNotConnected(null)).toBe(false);
    expect(isSignerNotConnected(undefined)).toBe(false);
  });
});

describe('isUploadError', () => {
  it('returns true for UploadError', () => {
    expect(isUploadError(new UploadError())).toBe(true);
  });

  it('returns false for other chain errors', () => {
    expect(isUploadError(new ChainError('test'))).toBe(false);
    expect(isUploadError(new FetchError())).toBe(false);
    expect(isUploadError(new ConnectionError())).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isUploadError(null)).toBe(false);
    expect(isUploadError(undefined)).toBe(false);
  });
});

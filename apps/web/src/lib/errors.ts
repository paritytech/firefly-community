/**
 * Error Hierarchy for Firefly Network
 *
 * Typed error classes following polkadot-apps pattern.
 * Use type guards for compile-time safe error handling.
 */

/** Base error for all Firefly Network errors */
export class FireflyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FireflyError';
  }
}

// --- Signer Errors ---

/** Base error for signer/wallet operations */
export class SignerError extends FireflyError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SignerError';
  }
}

/** No wallet connected or signer unavailable */
export class SignerNotConnectedError extends SignerError {
  constructor(message = 'Wallet not connected') {
    super(message);
    this.name = 'SignerNotConnectedError';
  }
}

/** Signing operation failed */
export class SigningFailedError extends SignerError {
  constructor(message = 'Signing failed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'SigningFailedError';
  }
}

// --- Chain/Storage Errors ---

/** Base error for chain operations */
export class ChainError extends FireflyError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChainError';
  }
}

/** Upload to Bulletin Chain failed */
export class UploadError extends ChainError {
  constructor(message = 'Upload failed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'UploadError';
  }
}

/** Fetch from Bulletin Chain failed */
export class FetchError extends ChainError {
  constructor(message = 'Fetch failed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'FetchError';
  }
}

/** Chain connection failed */
export class ConnectionError extends ChainError {
  constructor(message = 'Chain connection failed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConnectionError';
  }
}

// --- Type Guards ---

export function isSignerError(e: unknown): e is SignerError {
  return e instanceof SignerError;
}

export function isChainError(e: unknown): e is ChainError {
  return e instanceof ChainError;
}

export function isSignerNotConnected(e: unknown): e is SignerNotConnectedError {
  return e instanceof SignerNotConnectedError;
}

export function isUploadError(e: unknown): e is UploadError {
  return e instanceof UploadError;
}

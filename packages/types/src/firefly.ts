/**
 * Firefly types — verified human participants in the network.
 *
 * A firefly is NOT a user profile. There are no usernames, no avatars,
 * no bios, no follower counts. A firefly is a verified human being
 * with earned reputation — nothing more, nothing less.
 */

import type { DIMCredential } from './brands';

/**
 * Topic-specific reputation earned through corroborated contributions.
 */
export interface TopicReputation {
  /** The topic domain (e.g., "environmental", "local-government") */
  readonly topic: string;
  /** Normalized score from 0 to 1 */
  readonly score: number;
  /** Number of signals contributed in this topic */
  readonly signalCount: number;
  /** Number of corroborations given in this topic */
  readonly corroborationCount: number;
  /** Number of corroborations received on signals in this topic */
  readonly corroborationsReceived: number;
  /** Number of successful challenges in this topic */
  readonly successfulChallenges: number;
}

/**
 * The state of the current firefly (the connected wallet/credential holder).
 *
 * This is NOT a public profile — it's the private view of one's own reputation.
 * Other fireflies cannot see this; they only see the DIM credential and
 * per-corroboration reputation weights.
 */
export interface FireflyState {
  /** The DIM credential (anonymous but verified) */
  readonly credential: DIMCredential;
  /** Topic-weighted reputation scores */
  readonly reputation: readonly TopicReputation[];
  /** Total signals illuminated */
  readonly totalSignals: number;
  /** Total corroborations given */
  readonly totalCorroborations: number;
  /** When this credential was created (Unix timestamp) */
  readonly createdAt: number;
}

/**
 * Wallet connection status.
 */
export type WalletStatus =
  | 'disconnected' // No wallet connected
  | 'connecting' // Connection in progress
  | 'verifying' // DIM verification in progress
  | 'connected' // Connected with valid DIM credential
  | 'error'; // Connection or verification failed

/**
 * The wallet state for the current session.
 */
export interface WalletState {
  readonly status: WalletStatus;
  readonly firefly: FireflyState | null;
  readonly error?: string;
}

/**
 * Actions available on the wallet.
 */
export interface WalletActions {
  /** Initiate wallet connection */
  connect: () => Promise<void>;
  /** Disconnect the wallet */
  disconnect: () => void;
  /** Start DIM verification process */
  startVerification: () => Promise<void>;
}

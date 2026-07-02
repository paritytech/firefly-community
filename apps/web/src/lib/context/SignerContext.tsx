'use client';

/**
 * Signer Context
 *
 * Host-only wallet connection via the Triangle host's injected Spektr extension — the connection
 * pattern proven in Polkadot Desktop (and used by sibling host products). `injectSpektrExtension()`
 * asks the host to inject the Spektr extension into `window.injectedWeb3`; `connectInjectedExtension`
 * then reads the host-provided account and its `PolkadotSigner`. This is NOT a browser extension —
 * the host owns it, and outside a host there is simply nothing to inject (we stay disconnected).
 *
 * Two paths, tried in order: (1) Spektr injection — reliable in the Desktop host; (2) the
 * product-account path over `sandboxTransport` (`getProductAccount(PRODUCT_DOTNS, 0)`) — the path
 * that works in the dot.li web host, where Spektr injects but `connectInjectedExtension` hangs.
 * A Spektr timeout is non-fatal so it always falls through to the product-account path.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createAccountsProvider,
  injectSpektrExtension,
  metaProvider,
  sandboxTransport,
  SpektrExtensionName,
} from '@novasamatech/host-api-wrapper';
import { connectInjectedExtension } from 'polkadot-api/pjs-signer';
import type { PolkadotSigner } from 'polkadot-api/signer';
import type { Result } from '@cocuyo/types';
import { isInContainer } from '../host/detect';
import { requestExternalPermissions } from '../host/permissions';
import { ss58Encode } from '../utils/address';
import { setConnectedSigner, setConnectedWallet } from '../services/service-utils';
import { clearChainPersonhoodCache } from '../services/chain-personhood-service';
import { SignerNotConnectedError, SigningFailedError } from '../errors';
import { createLogger } from '../logging';

const log = createLogger('SignerProvider');

/** A connected wallet account, provided by the host's injected Spektr extension. */
interface SignerAccount {
  readonly address: string;
  readonly name: string | null;
  readonly publicKey: Uint8Array;
  readonly polkadotSigner: PolkadotSigner;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// The host registers its `window.injectedWeb3` handlers inside its own React effect, so the
// sandboxed iframe can run first; retrying the injection absorbs that startup race.
const SPEKTR_INJECT_RETRIES = 10;
const SPEKTR_INJECT_DELAY_MS = 500;
// Spektr injection succeeds but `connectInjectedExtension` hangs in the dot.li web host (Spektr is
// the Desktop mechanism), so keep the timeout short — on timeout we fall through to the
// product-account path rather than stalling the whole connect.
const SPEKTR_CONNECT_TIMEOUT_MS = 5_000;

// Our registered DotNS domain — the RFC-0014 product-account identifier. `getProductAccount`
// requires a registered `.dot` domain (per the product-sdk host API); it derives a per-product
// account (privacy-preserving, no cross-product correlation), NOT the user's root identity.
const PRODUCT_DOTNS = 'firefly.dot';

// Dapp origin string passed as `connectInjectedExtension`'s 2nd argument — a dapp identifier for
// the host's connection handshake, conceptually distinct from PRODUCT_DOTNS (they happen to share
// the value). Without an origin the host's injected extension does not auto-approve the connect.
const SPEKTR_CONNECT_ORIGIN = 'firefly.dot';

// Display name for the derived product account — deliberately generic. The product account is
// privacy-preserving by design, so we do NOT surface the user's DotNS username here.
const PRODUCT_ACCOUNT_NAME = 'Firefly account';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Reject if `promise` doesn't settle within `ms`, without leaving a dangling timer. */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SigningFailedError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new SigningFailedError(String(error)));
      }
    );
  });
}

/**
 * Resolve the host account via the injected Spektr (legacy) extension, or null when none is exposed.
 */
async function connectViaSpektr(): Promise<SignerAccount | null> {
  // Ask the host to inject Spektr; retry to cover the host-handlers-not-ready-yet race.
  for (let attempt = 0; attempt < SPEKTR_INJECT_RETRIES; attempt++) {
    try {
      if (await injectSpektrExtension()) break;
    } catch {
      // Not in a host, or the host isn't ready yet — retry, then give up quietly below.
    }
    await delay(SPEKTR_INJECT_DELAY_MS);
  }

  const injectedWeb3 = (globalThis as { injectedWeb3?: Record<string, unknown> }).injectedWeb3;
  if (injectedWeb3?.[SpektrExtensionName] === undefined) {
    return null;
  }

  let extension;
  try {
    // Pass the dapp origin (2nd arg) — the canonical host-api pattern. Without it the host's
    // injected extension never auto-approves the connection and connectInjectedExtension hangs.
    extension = await withTimeout(
      connectInjectedExtension(SpektrExtensionName, SPEKTR_CONNECT_ORIGIN),
      SPEKTR_CONNECT_TIMEOUT_MS,
      'Host wallet connection timed out'
    );
  } catch (error) {
    // A Spektr connect failure/timeout must NOT abort the whole connect — return null so the
    // caller falls through to the product-account path.
    log.warn('Spektr connect failed; falling through to product account', 'connectViaSpektr', {
      error,
    });
    return null;
  }

  // The legacy injection is commonly empty in hosts that issue product accounts (RFC-0014); the
  // caller falls back to the product-account path in that case.
  const [hostAccount] = extension.getAccounts();
  if (hostAccount === undefined) return null;

  return {
    address: hostAccount.address,
    name: hostAccount.name ?? null,
    publicKey: hostAccount.polkadotSigner.publicKey,
    polkadotSigner: hostAccount.polkadotSigner,
  };
}

/**
 * Resolve the host's product account directly via the Host API — the fallback when Spektr injection
 * exposes no account. Derives the per-product account (RFC-0014) for our registered domain and
 * builds a host-delegated signer.
 *
 * We call `getProductAccount` directly and do NOT gate on `getUserId()`: the product-account
 * derivation needs only our registered domain, not the user's identity/username, so gating on a
 * separate identity-read permission would wrongly block connection (and leak the username). The
 * call self-gates — it errors (NotConnected / DomainNotValid) when no account is available.
 */
async function connectViaProductAccount(): Promise<SignerAccount | null> {
  try {
    const provider = createAccountsProvider(sandboxTransport);

    // Pass OUR registered product domain (RFC-0014), NOT the user's username. Derivation index 0.
    const accountResult = await provider.getProductAccount(PRODUCT_DOTNS, 0);
    if (!accountResult.isOk()) {
      // Surface the reason rather than swallowing it (e.g. NotConnected / DomainNotValid / Rejected).
      log.warn('Product-account: getProductAccount failed', 'connectViaProductAccount', {
        error: accountResult.error,
      });
      return null;
    }
    const productAccount = accountResult.value;

    const polkadotSigner = provider.getProductAccountSigner(productAccount);
    return {
      address: ss58Encode(productAccount.publicKey),
      name: PRODUCT_ACCOUNT_NAME,
      publicKey: productAccount.publicKey,
      polkadotSigner,
    };
  } catch (error) {
    // No host transport, or the product-account path is unavailable here — stay disconnected.
    log.warn('Product-account connection failed', 'connectViaProductAccount', { error });
    return null;
  }
}

/**
 * Connect to the host wallet and build its signer, or null when no host/account is available (so
 * standalone / logged-out simply stays disconnected).
 *
 * Matches the canonical host-api pattern (product-skills `polkadot-triangle`) and the p2p-market
 * reference: connect straight through the injected Spektr extension — the host owns login, so the
 * app does NOT call `requestLogin` first (that extra sandboxTransport call was cocuyo-specific and
 * made the subsequent Spektr connect hang). Fall back to the product-account path only if Spektr
 * exposes no account.
 */
async function connectHostWallet(): Promise<SignerAccount | null> {
  return (await connectViaSpektr()) ?? (await connectViaProductAccount());
}

interface SignerContextValue {
  account: SignerAccount | null;
  status: ConnectionStatus;
  connect: () => Promise<SignerAccount | null>;
  disconnect: () => void;
}

const SignerContext = createContext<SignerContextValue | null>(null);

/**
 * Provider component that connects to the host wallet on mount and exposes connection state.
 */
export function SignerProvider({ children }: { children: ReactNode }): ReactNode {
  const [account, setAccount] = useState<SignerAccount | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  // The current in-flight attempt, shared by mount auto-connect and manual connect() so concurrent
  // callers join the same attempt instead of starting parallel connections.
  const inFlightRef = useRef<Promise<SignerAccount | null> | null>(null);
  // Bumped by disconnect() and by a host 'disconnected' event. A connect attempt only applies its
  // result — and is only joined or cleared — while its captured generation is still current, so a
  // disconnect arriving mid-connect can neither be overwritten by that attempt resolving later nor
  // strand a later reconnect on the now-invalidated attempt.
  const generationRef = useRef(0);
  // Generation the in-flight attempt belongs to, so a reconnect after a disconnect starts fresh
  // rather than joining the superseded attempt.
  const inFlightGenRef = useRef(-1);

  const connect = useCallback((): Promise<SignerAccount | null> => {
    // Only join an in-flight attempt from the current generation; a reconnect after a disconnect
    // must start a fresh attempt rather than ride the invalidated one.
    if (inFlightRef.current !== null && inFlightGenRef.current === generationRef.current) {
      return inFlightRef.current;
    }
    const generation = generationRef.current;
    setStatus('connecting');
    const attempt = connectHostWallet()
      .then((connected) => {
        if (generation !== generationRef.current) return null; // superseded by a disconnect
        setAccount(connected);
        setStatus(connected ? 'connected' : 'disconnected');
        return connected;
      })
      .catch((error: unknown) => {
        log.warn('Host wallet connection failed; continuing disconnected', 'connectHostWallet', {
          error,
        });
        if (generation === generationRef.current) {
          setAccount(null);
          setStatus('disconnected');
        }
        return null;
      })
      .finally(() => {
        // A stale attempt's finally must not clear a fresher attempt's ref.
        if (inFlightGenRef.current === generation) inFlightRef.current = null;
      });
    inFlightRef.current = attempt;
    inFlightGenRef.current = generation;
    return attempt;
  }, []);

  const disconnect = useCallback((): void => {
    generationRef.current += 1;
    clearChainPersonhoodCache();
    setAccount(null);
    setStatus('disconnected');
  }, []);

  // Mirror `status` into a ref so the connection-status subscription can read the latest value
  // without re-subscribing on every status change.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Bridge the connected product account into the service layer for governance/treasury on-chain
  // writes, which read the wallet, credential (derived from the address), and signer from module
  // state. (Bulletin uploads do NOT use this — they go through the host preimage strategy.)
  useEffect(() => {
    setConnectedWallet(account?.address ?? null);
    setConnectedSigner(account?.polkadotSigner ?? null);
  }, [account]);

  // Request the host's external network/device grants on mount. The sandbox blocks external HTTP(S)
  // by default, so map tiles and geocoding need this up front. Independent of the wallet connection.
  useEffect(() => {
    if (isInContainer()) void requestExternalPermissions();
  }, []);

  // Auto-connect on mount. We ALWAYS attempt the host injection — `connectHostWallet` self-detects
  // and resolves to null outside a host, so standalone simply stays disconnected. We deliberately
  // do NOT gate this on `isInContainer()`/`isCorrectEnvironment()`: the proven host reference
  // (p2p-market) connects unconditionally, and gating on synchronous container detection skipped
  // the connection entirely whenever that check reported false inside a real host — the cause of
  // the persistent `isConnected:false` ("Sign in") failures in Desktop and dot.li.
  useEffect(() => {
    void connect();
  }, [connect]);

  // Establish the host transport's connection-status channel and re-attempt the connection whenever
  // the host reports a change. This both matches the reference (which subscribes after a successful
  // inject) and makes connecting robust to the host-handlers-not-ready-yet race: when the host
  // channel comes up after our first attempt, this reconnects instead of leaving us disconnected.
  useEffect(() => {
    try {
      return metaProvider.subscribeConnectionStatus(() => {
        // Only (re)connect when we're not already connected. The host emits status routinely, and
        // running a full connect (10× inject retries + fallback + setAccount) on every emit while
        // connected causes redundant inject storms and account churn.
        if (statusRef.current === 'connected') return;
        void connect();
      });
    } catch {
      // No host transport (standalone) — nothing to subscribe to.
      return undefined;
    }
  }, [connect]);

  const value = useMemo<SignerContextValue>(
    () => ({ account, status, connect, disconnect }),
    [account, status, connect, disconnect]
  );

  return <SignerContext.Provider value={value}>{children}</SignerContext.Provider>;
}

/** Signing error types. */
type SignError = SignerNotConnectedError | SigningFailedError;

/** Return type for the {@link useSigner} hook. */
export interface UseSignerResult {
  /** Currently connected account (the host provides a single product account). */
  selectedAccount: SignerAccount | null;
  /** Connection status. */
  status: ConnectionStatus;
  /** Whether connected with an account. */
  isConnected: boolean;
  /** Whether running inside the Triangle host container. */
  isInHost: boolean;
  /** Connect to the host wallet. */
  connect: () => Promise<Result<SignerAccount, SignError>>;
  /** Disconnect and clear connection state. */
  disconnect: () => void;
  /** Get the PolkadotSigner for the connected account. */
  getSigner: () => PolkadotSigner | null;
  /** Sign arbitrary bytes — returns a Result with a typed error. */
  signRaw: (data: Uint8Array) => Promise<Result<Uint8Array, SignError>>;
}

/** State returned when the hook is used outside a {@link SignerProvider}. */
const DISCONNECTED_STATE: UseSignerResult = {
  selectedAccount: null,
  status: 'disconnected',
  isConnected: false,
  isInHost: false,
  connect: () => Promise.resolve({ ok: false, error: new SignerNotConnectedError() }),
  disconnect: () => {
    /* no-op when disconnected */
  },
  getSigner: () => null,
  signRaw: () => Promise.resolve({ ok: false, error: new SignerNotConnectedError() }),
};

/**
 * Primary hook for wallet connection. Provides a simplified API over the host connection.
 */
export function useSigner(): UseSignerResult {
  const ctx = useContext(SignerContext);

  return useMemo((): UseSignerResult => {
    if (!ctx) return DISCONNECTED_STATE;

    const { account, status, connect, disconnect } = ctx;

    return {
      selectedAccount: account,
      status,
      isConnected: status === 'connected' && account !== null,
      isInHost: isInContainer(),
      connect: async (): Promise<Result<SignerAccount, SignError>> => {
        const connected = await connect();
        return connected
          ? { ok: true, value: connected }
          : { ok: false, error: new SignerNotConnectedError() };
      },
      disconnect,
      getSigner: () => account?.polkadotSigner ?? null,
      signRaw: async (data: Uint8Array): Promise<Result<Uint8Array, SignError>> => {
        if (!account) return { ok: false, error: new SignerNotConnectedError() };
        try {
          const signature = await account.polkadotSigner.signBytes(data);
          return { ok: true, value: signature };
        } catch (error: unknown) {
          return {
            ok: false,
            error: new SigningFailedError(error instanceof Error ? error.message : 'sign failed'),
          };
        }
      },
    };
  }, [ctx]);
}

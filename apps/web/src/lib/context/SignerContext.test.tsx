/**
 * Tests for SignerContext.
 *
 * Host-only app: connects via the host's injected Spektr extension
 * (injectSpektrExtension + connectInjectedExtension). These pin the connect flow (incl. the
 * injection retry), the in-flight coalescing, the disconnect generation guard, and signing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { SignerProvider, useSigner } from './SignerContext';

const {
  injectSpektrMock,
  connectExtensionMock,
  getAccountsMock,
  isInContainerMock,
  requestPermsMock,
  subscribeConnectionStatusMock,
  getProductAccountMock,
  getProductAccountSignerMock,
  signBytesMock,
  pubkey,
} = vi.hoisted(() => {
  const PUBKEY = new Uint8Array(32);
  const signBytes = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));
  const getAccounts = vi.fn();
  return {
    pubkey: PUBKEY,
    signBytesMock: signBytes,
    getAccountsMock: getAccounts,
    injectSpektrMock: vi.fn(() => Promise.resolve(true)),
    connectExtensionMock: vi.fn(() => Promise.resolve({ getAccounts })),
    isInContainerMock: vi.fn(() => true),
    requestPermsMock: vi.fn(() => Promise.resolve()),
    subscribeConnectionStatusMock: vi.fn((_cb: () => void) => vi.fn()),
    getProductAccountMock: vi.fn(
      (): Promise<{
        isOk: () => boolean;
        value:
          | { publicKey: Uint8Array; dotNsIdentifier: string; derivationIndex: number }
          | undefined;
      }> => Promise.resolve({ isOk: () => false, value: undefined })
    ),
    getProductAccountSignerMock: vi.fn(() => ({ publicKey: PUBKEY, signBytes })),
  };
});

vi.mock('@novasamatech/host-api-wrapper', () => ({
  injectSpektrExtension: injectSpektrMock,
  SpektrExtensionName: 'spektr',
  metaProvider: { subscribeConnectionStatus: subscribeConnectionStatusMock },
  createAccountsProvider: () => ({
    getProductAccount: getProductAccountMock,
    getProductAccountSigner: getProductAccountSignerMock,
  }),
  sandboxTransport: {},
}));
vi.mock('polkadot-api/pjs-signer', () => ({ connectInjectedExtension: connectExtensionMock }));
vi.mock('../host/detect', () => ({ isInContainer: isInContainerMock }));
vi.mock('../host/permissions', () => ({ requestExternalPermissions: requestPermsMock }));
vi.mock('../services/chain-personhood-service', () => ({ clearChainPersonhoodCache: vi.fn() }));

const HOST_ACCOUNT = {
  address: '5GrwvaEFAlice',
  name: 'Alice',
  polkadotSigner: { publicKey: pubkey, signBytes: signBytesMock },
};

interface InjectedWeb3 {
  injectedWeb3?: Record<string, unknown>;
}
const setSpektrInjected = (present: boolean): void => {
  if (present) {
    (globalThis as InjectedWeb3).injectedWeb3 = { spektr: {} };
  } else {
    delete (globalThis as InjectedWeb3).injectedWeb3;
  }
};

function makeDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  isInContainerMock.mockReturnValue(true);
  requestPermsMock.mockResolvedValue(undefined);
  injectSpektrMock.mockResolvedValue(true);
  connectExtensionMock.mockResolvedValue({ getAccounts: getAccountsMock });
  getAccountsMock.mockReturnValue([HOST_ACCOUNT]);
  signBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
  subscribeConnectionStatusMock.mockReturnValue(vi.fn());
  getProductAccountMock.mockResolvedValue({ isOk: () => false, value: undefined });
  getProductAccountSignerMock.mockReturnValue({ publicKey: pubkey, signBytes: signBytesMock });
  setSpektrInjected(true);
});

afterEach(() => {
  setSpektrInjected(false);
});

describe('SignerProvider', () => {
  it('renders children', async () => {
    render(
      <SignerProvider>
        <div>child-content</div>
      </SignerProvider>
    );
    expect(screen.getByText('child-content')).toBeTruthy();
    await waitFor(() => expect(connectExtensionMock).toHaveBeenCalled());
  });

  it('requests external host permissions on mount inside the container', async () => {
    render(
      <SignerProvider>
        <div />
      </SignerProvider>
    );
    await waitFor(() => expect(requestPermsMock).toHaveBeenCalledTimes(1));
  });

  it('attempts the host injection even when sync container detection reports false', async () => {
    // The bug we fixed: a false `isInContainer()` must NOT skip the connection. The host can be
    // present (and inject Spektr) even when the synchronous environment check reports false.
    isInContainerMock.mockReturnValue(false);
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(injectSpektrMock).toHaveBeenCalled();
    expect(connectExtensionMock).toHaveBeenCalledWith('spektr', 'firefly.dot');
  });

  it('does not request external host permissions outside the container', async () => {
    // Permissions stay gated on the container check (external grants are meaningless standalone),
    // even though the wallet connection itself is attempted unconditionally.
    isInContainerMock.mockReturnValue(false);
    render(
      <SignerProvider>
        <div />
      </SignerProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(requestPermsMock).not.toHaveBeenCalled();
  });

  it('reconnects when the host transport reports a connection-status change', async () => {
    // The host channel can come up after our first attempt; the status subscription must drive a
    // reconnect rather than leaving us disconnected.
    let statusCallback: (() => void) | undefined;
    subscribeConnectionStatusMock.mockImplementation((cb: () => void) => {
      statusCallback = cb;
      return vi.fn();
    });
    // First attempt finds no host; a later status change should retry and succeed.
    setSpektrInjected(false);
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(injectSpektrMock).toHaveBeenCalled());
    expect(result.current.isConnected).toBe(false);

    setSpektrInjected(true);
    await act(async () => {
      statusCallback?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
  });

  it('does not re-connect on a status emit while already connected (no churn)', async () => {
    // Hosts emit connection-status routinely; a full reconnect on every emit while connected would
    // cause inject storms + account churn. Once connected, a status emit must be a no-op.
    let statusCallback: (() => void) | undefined;
    subscribeConnectionStatusMock.mockImplementation((cb: () => void) => {
      statusCallback = cb;
      return vi.fn();
    });
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const injectCallsWhenConnected = injectSpektrMock.mock.calls.length;
    const connectCallsWhenConnected = connectExtensionMock.mock.calls.length;
    await act(async () => {
      statusCallback?.(); // emit while connected
      await Promise.resolve();
    });
    expect(injectSpektrMock.mock.calls.length).toBe(injectCallsWhenConnected);
    expect(connectExtensionMock.mock.calls.length).toBe(connectCallsWhenConnected);
    expect(result.current.isConnected).toBe(true);
  });

  it('auto-connects to the host Spektr account on mount', async () => {
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(injectSpektrMock).toHaveBeenCalled();
    expect(connectExtensionMock).toHaveBeenCalledWith('spektr', 'firefly.dot');
    expect(result.current.selectedAccount?.address).toBe(HOST_ACCOUNT.address);
  });

  it('retries the injection until the host is ready', async () => {
    // The host registers its handlers after the iframe mounts; the first injection attempt fails.
    injectSpektrMock.mockResolvedValueOnce(false).mockResolvedValue(true);
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true), { timeout: 3000 });
    expect(injectSpektrMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('falls back to the product account when Spektr exposes none', async () => {
    setSpektrInjected(false); // Spektr injection yields no account
    getProductAccountMock.mockResolvedValue({
      isOk: () => true,
      value: { publicKey: pubkey, dotNsIdentifier: 'firefly.dot', derivationIndex: 0 },
    });
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(getProductAccountSignerMock).toHaveBeenCalled();
    // The product account is derived from OUR registered domain (RFC-0014), not the user's
    // username — passing the username was the bug that failed with DomainNotValid.
    expect(getProductAccountMock).toHaveBeenCalledWith('firefly.dot', 0);
    // Generic display name — the product account deliberately does NOT surface the DotNS username.
    expect(result.current.selectedAccount?.name).toBe('Firefly account');
  });

  it('falls through to the product account when the Spektr connection times out (dot.li web)', async () => {
    // Spektr injects, but connecting hangs/times out in the web host — this must not abort the
    // connect; it falls through to the product-account path.
    connectExtensionMock.mockRejectedValue(new Error('Host wallet connection timed out'));
    getProductAccountMock.mockResolvedValue({
      isOk: () => true,
      value: { publicKey: pubkey, dotNsIdentifier: 'firefly.dot', derivationIndex: 0 },
    });
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(getProductAccountMock).toHaveBeenCalledWith('firefly.dot', 0);
  });

  it('stays disconnected when the host never injects Spektr', async () => {
    setSpektrInjected(false);
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(injectSpektrMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isConnected).toBe(false);
    expect(connectExtensionMock).not.toHaveBeenCalled();
  });

  it('stays disconnected when the host exposes no accounts', async () => {
    getAccountsMock.mockReturnValue([]);
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(connectExtensionMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('shares the in-flight attempt: a concurrent connect() awaits it and resolves to the account', async () => {
    const pending = makeDeferred<{ getAccounts: typeof getAccountsMock }>();
    connectExtensionMock.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });

    let manual: Awaited<ReturnType<typeof result.current.connect>> | undefined;
    await act(async () => {
      const inFlight = result.current.connect(); // joins the running auto-connect, not a stale null
      pending.resolve({ getAccounts: getAccountsMock });
      manual = await inFlight;
    });

    expect(manual?.ok).toBe(true);
    // A single shared attempt — the concurrent connect() did not start a second connection.
    expect(connectExtensionMock).toHaveBeenCalledTimes(1);
  });

  it('does not publish a connection if disconnect() arrives mid-connect', async () => {
    // Hold the connect in flight so the disconnect lands before it resolves.
    const pending = makeDeferred<{ getAccounts: typeof getAccountsMock }>();
    connectExtensionMock.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(connectExtensionMock).toHaveBeenCalled());

    await act(async () => {
      result.current.disconnect(); // bumps the generation
      pending.resolve({ getAccounts: getAccountsMock }); // stale attempt then resolves "connected"
      await pending.promise;
    });

    // The stale success must NOT clobber the disconnect.
    expect(result.current.isConnected).toBe(false);
    expect(result.current.selectedAccount).toBeNull();
  });
});

describe('useSigner signing', () => {
  it('signs bytes via the connected account and surfaces signing failures', async () => {
    const { result } = renderHook(() => useSigner(), { wrapper: SignerProvider });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    expect(result.current.getSigner()).not.toBeNull();

    const okSign = await result.current.signRaw(new Uint8Array([9]));
    expect(okSign.ok).toBe(true);
    expect(signBytesMock).toHaveBeenCalled();

    signBytesMock.mockRejectedValueOnce(new Error('user rejected'));
    const errSign = await result.current.signRaw(new Uint8Array([9]));
    expect(errSign.ok).toBe(false);
  });
});

describe('useSigner outside a provider', () => {
  it('returns a disconnected state and never connects', async () => {
    const { result } = renderHook(() => useSigner());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.selectedAccount).toBeNull();
    expect(connectExtensionMock).not.toHaveBeenCalled();
  });
});

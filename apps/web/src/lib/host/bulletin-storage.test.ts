/**
 * Tests for the Bulletin (content) host-storage layer.
 *
 * Mirrors the p2p-market storage.test.ts coverage: fail-closed writes via the
 * host preimage API, and reads via the cloud-storage lookup with a
 * development-only IPFS gateway fallback.
 *
 * Each test loads a fresh copy of the module (`vi.resetModules` + `vi.doMock`)
 * so the once-per-session allowance flag starts clean and the (non-hoisted)
 * mocks reliably apply to the freshly imported module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stand-in for the SDK's host-unavailable error — the read path branches on
// `instanceof CloudStorageHostUnavailableError`, so the mock must export a class.
class CloudStorageHostUnavailableError extends Error {
  constructor(operation = 'query') {
    super(`Cloud storage host unavailable for ${operation}`);
    this.name = 'CloudStorageHostUnavailableError';
  }
}

const submit = vi.fn<(data: Uint8Array) => Promise<void>>();
const queryBytes = vi.fn<(cid: string) => Promise<Uint8Array>>();
const queryJson = vi.fn<(cid: string) => Promise<unknown>>();
const isInContainer = vi.fn<() => boolean>();
const requestBulletInAllowance = vi.fn<() => Promise<boolean>>();
const requestTransactionSubmit = vi.fn<() => Promise<void>>();

// `@cocuyo/bulletin` (real Blake2b CID) and `@cocuyo/network-config` (real gateway URL) are left
// un-mocked — both are pure, so the tests exercise the real CID and the real paseo gateway.

const MOCK_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
const MOCK_BYTES = new Uint8Array([1, 2, 3, 4]);
const MOCK_JSON = { name: 'test', value: 42 };

async function load(): Promise<typeof import('./bulletin-storage')> {
  vi.resetModules();
  vi.doMock('@novasamatech/host-api-wrapper', () => ({ preimageManager: { submit } }));
  vi.doMock('@parity/product-sdk-cloud-storage', () => ({
    queryBytes,
    queryJson,
    CloudStorageHostUnavailableError,
  }));
  vi.doMock('./detect', () => ({ isInContainer }));
  vi.doMock('./permissions', () => ({ requestBulletInAllowance, requestTransactionSubmit }));
  return import('./bulletin-storage');
}

beforeEach(() => {
  submit.mockReset().mockResolvedValue(undefined);
  queryBytes.mockReset();
  queryJson.mockReset();
  isInContainer.mockReset().mockReturnValue(false);
  requestBulletInAllowance.mockReset().mockResolvedValue(true);
  requestTransactionSubmit.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock('@novasamatech/host-api-wrapper');
  vi.doUnmock('@parity/product-sdk-cloud-storage');
  vi.doUnmock('./detect');
  vi.doUnmock('./permissions');
});

describe('uploadBytesToHostStorage (write)', () => {
  it('is fail-closed: throws outside the host container, never submits or requests allowance', async () => {
    const { uploadBytesToHostStorage } = await load();
    isInContainer.mockReturnValue(false);

    await expect(uploadBytesToHostStorage(MOCK_BYTES)).rejects.toThrow(/require the Polkadot host/);
    expect(submit).not.toHaveBeenCalled();
    expect(requestBulletInAllowance).not.toHaveBeenCalled();
  });

  it('submits via the host preimage API and returns the locally-computed CID', async () => {
    const { uploadBytesToHostStorage } = await load();
    const { calculateCID } = await import('@cocuyo/bulletin');
    isInContainer.mockReturnValue(true);

    const result = await uploadBytesToHostStorage(MOCK_BYTES);

    expect(submit).toHaveBeenCalledWith(MOCK_BYTES);
    expect(result.cid).toBe(calculateCID(MOCK_BYTES));
  });

  it('requests the allowance only once across multiple writes in a session', async () => {
    const { uploadBytesToHostStorage } = await load();
    isInContainer.mockReturnValue(true);

    await uploadBytesToHostStorage(MOCK_BYTES);
    await uploadBytesToHostStorage(MOCK_BYTES);

    expect(requestBulletInAllowance).toHaveBeenCalledTimes(1);
    expect(requestTransactionSubmit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('fails early when the host denies the BulletIn allowance (no submit)', async () => {
    const { uploadBytesToHostStorage } = await load();
    isInContainer.mockReturnValue(true);
    requestBulletInAllowance.mockResolvedValue(false);

    await expect(uploadBytesToHostStorage(MOCK_BYTES)).rejects.toThrow(
      /denied the BulletIn storage allowance/
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('propagates a preimage submit failure', async () => {
    const { uploadBytesToHostStorage } = await load();
    isInContainer.mockReturnValue(true);
    submit.mockRejectedValue(new Error('submit boom'));

    await expect(uploadBytesToHostStorage(MOCK_BYTES)).rejects.toThrow('submit boom');
  });
});

describe('fetchBytesFromHostStorage (read)', () => {
  it('returns bytes via the host lookup and does not hit the gateway', async () => {
    const { fetchBytesFromHostStorage } = await load();
    queryBytes.mockResolvedValue(MOCK_BYTES);

    const result = await fetchBytesFromHostStorage(MOCK_CID);

    expect(queryBytes).toHaveBeenCalledWith(MOCK_CID);
    expect(result).toEqual(MOCK_BYTES);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on an empty CID', async () => {
    const { fetchBytesFromHostStorage } = await load();
    await expect(fetchBytesFromHostStorage('')).rejects.toThrow(/CID is required/);
  });

  it('throws on a whitespace-only CID', async () => {
    const { fetchBytesFromHostStorage } = await load();
    await expect(fetchBytesFromHostStorage('   ')).rejects.toThrow(/CID is required/);
  });

  it('re-throws a non-host-unavailable error without falling back to the gateway', async () => {
    const { fetchBytesFromHostStorage } = await load();
    queryBytes.mockRejectedValue(new Error('unexpected'));

    await expect(fetchBytesFromHostStorage(MOCK_CID)).rejects.toThrow('unexpected');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to the IPFS gateway in development when the host is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { fetchBytesFromHostStorage } = await load();
    queryBytes.mockRejectedValue(new CloudStorageHostUnavailableError());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(MOCK_BYTES.buffer),
    } as Response);

    const result = await fetchBytesFromHostStorage(MOCK_CID);

    expect(result).toEqual(MOCK_BYTES);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(MOCK_CID), expect.anything());
  });

  it('throws when the development gateway returns a non-ok response', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { fetchBytesFromHostStorage } = await load();
    queryBytes.mockRejectedValue(new CloudStorageHostUnavailableError());
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(fetchBytesFromHostStorage(MOCK_CID)).rejects.toThrow(/Gateway fetch failed/);
  });

  it('throws in production when the host is unavailable (no gateway fallback)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { fetchBytesFromHostStorage } = await load();
    queryBytes.mockRejectedValue(new CloudStorageHostUnavailableError());

    await expect(fetchBytesFromHostStorage(MOCK_CID)).rejects.toThrow(/disabled in production/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fetchJsonFromHostStorage (read)', () => {
  it('returns parsed JSON via the host lookup', async () => {
    const { fetchJsonFromHostStorage } = await load();
    queryJson.mockResolvedValue(MOCK_JSON);

    const result = await fetchJsonFromHostStorage<typeof MOCK_JSON>(MOCK_CID);

    expect(queryJson).toHaveBeenCalledWith(MOCK_CID);
    expect(result).toEqual(MOCK_JSON);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on an empty CID', async () => {
    const { fetchJsonFromHostStorage } = await load();
    await expect(fetchJsonFromHostStorage('')).rejects.toThrow(/CID is required/);
  });

  it('falls back to the IPFS gateway in development when the host is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { fetchJsonFromHostStorage } = await load();
    queryJson.mockRejectedValue(new CloudStorageHostUnavailableError());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_JSON),
    } as Response);

    const result = await fetchJsonFromHostStorage<typeof MOCK_JSON>(MOCK_CID);

    expect(result).toEqual(MOCK_JSON);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(MOCK_CID), expect.anything());
  });

  it('throws in production when the host is unavailable (no gateway fallback)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { fetchJsonFromHostStorage } = await load();
    queryJson.mockRejectedValue(new CloudStorageHostUnavailableError());

    await expect(fetchJsonFromHostStorage(MOCK_CID)).rejects.toThrow(/disabled in production/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

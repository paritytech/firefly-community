import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractBestClaim, isClaimExtractionConfigured } from './extract-claims';

/** A fetch stub that resolves once with the given JSON body. */
function fetchResolving(body: unknown, ok = true, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('isClaimExtractionConfigured', () => {
  it('is true under test env (dev proxy endpoint is configured)', () => {
    expect(isClaimExtractionConfigured()).toBe(true);
  });
});

describe('extractBestClaim', () => {
  it('returns the first checkable claim', async () => {
    vi.stubGlobal(
      'fetch',
      fetchResolving({
        claims: [
          { claim: 'opinion', checkable: false },
          { claim: 'Gas prices tripled since 2020', checkable: true },
        ],
      })
    );
    const result = await extractBestClaim('some text');
    expect(result).toEqual({ ok: true, claim: 'Gas prices tripled since 2020' });
  });

  it('falls back to the first claim when none are checkable', async () => {
    vi.stubGlobal('fetch', fetchResolving({ claims: [{ claim: 'soft claim', checkable: false }] }));
    const result = await extractBestClaim('text');
    expect(result).toEqual({ ok: true, claim: 'soft claim' });
  });

  it('reports no_claims for an empty result', async () => {
    vi.stubGlobal('fetch', fetchResolving({ claims: [] }));
    const result = await extractBestClaim('text');
    expect(result).toEqual({ ok: true, claim: null, reason: 'no_claims' });
  });

  it('reports ai_error when the endpoint returns a non-OK response', async () => {
    vi.stubGlobal('fetch', fetchResolving({ error: 'upstream boom' }, false, 500));
    const result = await extractBestClaim('text');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ai_error');
  });

  it('reports ai_error when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await extractBestClaim('text');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ai_error');
  });
});

describe('extractBestClaim with no endpoint configured', () => {
  it('returns not_configured without calling the network', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production'); // no dev-proxy fallback
    vi.stubEnv('NEXT_PUBLIC_CLAIM_EXTRACTOR_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await import('./extract-claims');
    expect(mod.isClaimExtractionConfigured()).toBe(false);
    const result = await mod.extractBestClaim('text');
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

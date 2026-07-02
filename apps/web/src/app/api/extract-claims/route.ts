/**
 * API Route: Proxy for claim extraction.
 *
 * Proxies requests to the Cloudflare Worker to avoid CORS issues in development.
 * Server-to-server requests don't have CORS restrictions.
 */

import { NextRequest, NextResponse } from 'next/server';

// Claim extraction is BYO-AI: integrators point this at their own endpoint
// (e.g. a Cloudflare Worker holding their own OpenAI key). There is no default
// — the network ships no shared/credentialed AI backend.
const CLAIM_EXTRACTOR_URL =
  process.env.CLAIM_EXTRACTOR_URL ?? process.env.NEXT_PUBLIC_CLAIM_EXTRACTOR_URL;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (CLAIM_EXTRACTOR_URL === undefined || CLAIM_EXTRACTOR_URL === '') {
    return NextResponse.json(
      {
        error:
          'Claim extraction is not configured. Set CLAIM_EXTRACTOR_URL (or NEXT_PUBLIC_CLAIM_EXTRACTOR_URL) to your own AI extraction endpoint.',
      },
      { status: 501 }
    );
  }

  try {
    const body: unknown = await request.json();

    const response = await fetch(`${CLAIM_EXTRACTOR_URL}/extract-claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

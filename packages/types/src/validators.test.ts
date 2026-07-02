/**
 * Tests for Zod validators.
 *
 * Verifies that validators correctly accept valid data,
 * reject invalid data, and handle edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  StoryChainSchema,
  PostSchema,
  ChainPreviewSchema,
  PostPreviewSchema,
  safeParseStoryChain,
  safeParsePost,
  safeParseChainPreview,
  safeParsePostPreview,
  parseStoryChain,
  parsePost,
} from './validators';

// ============================================================
// Test fixtures
// ============================================================

const validStoryChain = {
  id: 'chain-123',
  title: 'Test Chain',
  description: 'A test story chain',
  topics: ['politics', 'local'],
  location: 'Test City',
  status: 'active',
  postIds: ['post-1', 'post-2'],
  stats: {
    postCount: 2,
    corroborationCount: 5,
    challengeCount: 1,
    contributorCount: 3,
  },
  createdAt: 1700000000,
  updatedAt: 1700001000,
};

const validPost = {
  id: 'post-123',
  cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  author: {
    id: 'author-1',
    credentialHash: 'dim-credential-hash',
    pseudonym: 'Swift Firefly',
    disclosureLevel: 'anonymous',
  },
  content: {
    title: 'Test Post',
    text: 'This is the post content.',
    links: ['https://example.com'],
  },
  context: {
    topics: ['politics'],
    locationName: 'Test City',
  },
  dimSignature: 'dim-signature-123',
  status: 'published',
  chainLinks: ['chain-1'],
  corroborations: {
    witnessCount: 2,
    evidenceCount: 1,
    expertiseCount: 0,
    challengeCount: 0,
  },
  verification: {
    status: 'unverified',
  },
  createdAt: 1700000000,
};

const validChainPreview = {
  id: 'chain-123',
  title: 'Test Chain',
  topics: ['politics'],
  status: 'emerging',
  postCount: 5,
  corroborationCount: 10,
  updatedAt: 1700000000,
};

const validPostPreview = {
  id: 'post-123',
  title: 'Test Post',
  excerpt: 'This is a test excerpt...',
  topics: ['politics'],
  status: 'published',
  corroborationCount: 5,
  challengeCount: 1,
  createdAt: 1700000000,
};

// ============================================================
// StoryChain tests
// ============================================================

describe('StoryChainSchema', () => {
  it('accepts valid story chain', () => {
    const result = StoryChainSchema.safeParse(validStoryChain);
    expect(result.success).toBe(true);
  });

  it('accepts story chain without optional location', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location: _location, ...chainWithoutLocation } = validStoryChain;
    const result = StoryChainSchema.safeParse(chainWithoutLocation);
    expect(result.success).toBe(true);
  });

  it('rejects story chain with missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title: _title, ...chainWithoutTitle } = validStoryChain;
    const result = StoryChainSchema.safeParse(chainWithoutTitle);
    expect(result.success).toBe(false);
  });

  it('rejects story chain with invalid status', () => {
    const result = StoryChainSchema.safeParse({
      ...validStoryChain,
      status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });

  it('rejects story chain with wrong type for stats', () => {
    const result = StoryChainSchema.safeParse({
      ...validStoryChain,
      stats: 'not an object',
    });
    expect(result.success).toBe(false);
  });

  it('transforms id to ChainId branded type', () => {
    const result = StoryChainSchema.parse(validStoryChain);
    expect(typeof result.id).toBe('string');
    expect(result.id).toBe('chain-123');
  });

  it('transforms postIds to PostId branded types', () => {
    const result = StoryChainSchema.parse(validStoryChain);
    expect(result.postIds).toEqual(['post-1', 'post-2']);
  });
});

describe('safeParseStoryChain', () => {
  it('returns parsed data for valid input', () => {
    const result = safeParseStoryChain(validStoryChain);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('chain-123');
  });

  it('returns null for invalid input', () => {
    const result = safeParseStoryChain({ invalid: 'data' });
    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    const result = safeParseStoryChain(null);
    expect(result).toBeNull();
  });
});

describe('parseStoryChain', () => {
  it('returns parsed data for valid input', () => {
    const result = parseStoryChain(validStoryChain);
    expect(result.id).toBe('chain-123');
  });

  it('throws for invalid input', () => {
    expect(() => parseStoryChain({ invalid: 'data' })).toThrow();
  });
});

// ============================================================
// Post tests
// ============================================================

describe('PostSchema', () => {
  it('accepts valid post', () => {
    const result = PostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it('accepts post without optional cid', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cid: _cid, ...postWithoutCid } = validPost;
    const result = PostSchema.safeParse(postWithoutCid);
    expect(result.success).toBe(true);
  });

  it('accepts post without optional content title', () => {
    const postWithoutTitle = {
      ...validPost,
      content: { text: 'Just text, no title' },
    };
    const result = PostSchema.safeParse(postWithoutTitle);
    expect(result.success).toBe(true);
  });

  it('rejects post with invalid status', () => {
    const result = PostSchema.safeParse({
      ...validPost,
      status: 'deleted', // not a valid PostStatus
    });
    expect(result.success).toBe(false);
  });

  it('rejects post with invalid verification status', () => {
    const result = PostSchema.safeParse({
      ...validPost,
      verification: { status: 'approved' }, // not a valid VerificationStatus
    });
    expect(result.success).toBe(false);
  });

  it('rejects post with missing author', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { author: _author, ...postWithoutAuthor } = validPost;
    const result = PostSchema.safeParse(postWithoutAuthor);
    expect(result.success).toBe(false);
  });

  it('accepts post with media attachments', () => {
    const postWithMedia = {
      ...validPost,
      content: {
        ...validPost.content,
        media: [
          {
            hash: 'content-hash-123',
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
      },
    };
    const result = PostSchema.safeParse(postWithMedia);
    expect(result.success).toBe(true);
  });

  it('accepts post with location coordinates', () => {
    const postWithLocation = {
      ...validPost,
      context: {
        ...validPost.context,
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
        },
      },
    };
    const result = PostSchema.safeParse(postWithLocation);
    expect(result.success).toBe(true);
  });
});

describe('safeParsePost', () => {
  it('returns parsed data for valid input', () => {
    const result = safeParsePost(validPost);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('post-123');
  });

  it('returns null for invalid input', () => {
    const result = safeParsePost({ random: 'garbage' });
    expect(result).toBeNull();
  });
});

describe('parsePost', () => {
  it('returns parsed data for valid input', () => {
    const result = parsePost(validPost);
    expect(result.id).toBe('post-123');
  });

  it('throws for invalid input', () => {
    expect(() => parsePost({})).toThrow();
  });
});

// ============================================================
// ChainPreview tests
// ============================================================

describe('ChainPreviewSchema', () => {
  it('accepts valid chain preview', () => {
    const result = ChainPreviewSchema.safeParse(validChainPreview);
    expect(result.success).toBe(true);
  });

  it('accepts chain preview without optional location', () => {
    const result = ChainPreviewSchema.safeParse(validChainPreview);
    expect(result.success).toBe(true);
  });

  it('rejects chain preview with missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { postCount: _postCount, ...previewWithoutCount } = validChainPreview;
    const result = ChainPreviewSchema.safeParse(previewWithoutCount);
    expect(result.success).toBe(false);
  });
});

describe('safeParseChainPreview', () => {
  it('returns parsed data for valid input', () => {
    const result = safeParseChainPreview(validChainPreview);
    expect(result).not.toBeNull();
  });

  it('returns null for invalid input', () => {
    const result = safeParseChainPreview(null);
    expect(result).toBeNull();
  });
});

// ============================================================
// PostPreview tests
// ============================================================

describe('PostPreviewSchema', () => {
  it('accepts valid post preview', () => {
    const result = PostPreviewSchema.safeParse(validPostPreview);
    expect(result.success).toBe(true);
  });

  it('accepts post preview without optional title', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title: _title, ...previewWithoutTitle } = validPostPreview;
    const result = PostPreviewSchema.safeParse(previewWithoutTitle);
    expect(result.success).toBe(true);
  });

  it('rejects post preview with wrong excerpt type', () => {
    const result = PostPreviewSchema.safeParse({
      ...validPostPreview,
      excerpt: 12345, // should be string
    });
    expect(result.success).toBe(false);
  });
});

describe('safeParsePostPreview', () => {
  it('returns parsed data for valid input', () => {
    const result = safeParsePostPreview(validPostPreview);
    expect(result).not.toBeNull();
  });

  it('returns null for invalid input', () => {
    const result = safeParsePostPreview({ foo: 'bar' });
    expect(result).toBeNull();
  });
});

// ============================================================
// Edge cases and schema behavior
// ============================================================

describe('Schema edge cases', () => {
  it('strips extra fields from input (passthrough disabled by default)', () => {
    const withExtra = {
      ...validStoryChain,
      extraField: 'should be stripped',
      anotherExtra: 123,
    };
    const result = StoryChainSchema.parse(withExtra);
    expect('extraField' in result).toBe(false);
    expect('anotherExtra' in result).toBe(false);
  });

  it('handles empty arrays correctly', () => {
    const chainWithEmptyArrays = {
      ...validStoryChain,
      topics: [],
      postIds: [],
    };
    const result = StoryChainSchema.safeParse(chainWithEmptyArrays);
    expect(result.success).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(StoryChainSchema.safeParse('string').success).toBe(false);
    expect(StoryChainSchema.safeParse(123).success).toBe(false);
    expect(StoryChainSchema.safeParse([]).success).toBe(false);
    expect(StoryChainSchema.safeParse(undefined).success).toBe(false);
  });
});

/**
 * Tests for post constants.
 */

import { describe, it, expect } from 'vitest';
import { MAX_POST_PHOTOS } from './post';

describe('MAX_POST_PHOTOS', () => {
  it('caps post photos at 3', () => {
    expect(MAX_POST_PHOTOS).toBe(3);
  });
});

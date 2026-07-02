import { describe, it, expect } from 'vitest';
import {
  isSafeUrl,
  isSafeUrlWithHttp,
  sanitizeUrl,
  extractDomain,
  isFromAllowedDomain,
} from './url-utils';

describe('URL utilities', () => {
  describe('isSafeUrl', () => {
    it('accepts https URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://example.com/path?query=1')).toBe(true);
      expect(isSafeUrl('https://sub.domain.example.com')).toBe(true);
    });

    it('rejects http URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(false);
    });

    it('rejects dangerous protocols', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl('://missing-protocol.com')).toBe(false);
    });
  });

  describe('isSafeUrlWithHttp', () => {
    it('accepts https URLs', () => {
      expect(isSafeUrlWithHttp('https://example.com')).toBe(true);
    });

    it('accepts http URLs', () => {
      expect(isSafeUrlWithHttp('http://localhost:3000')).toBe(true);
      expect(isSafeUrlWithHttp('http://example.com')).toBe(true);
    });

    it('rejects dangerous protocols', () => {
      expect(isSafeUrlWithHttp('javascript:alert(1)')).toBe(false);
      expect(isSafeUrlWithHttp('data:text/html,test')).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('returns safe URLs unchanged', () => {
      const url = 'https://example.com/path';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('returns null for unsafe URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('http://example.com')).toBeNull();
      expect(sanitizeUrl('not-a-url')).toBeNull();
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from valid URLs', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
      expect(extractDomain('https://sub.domain.example.com/path')).toBe('sub.domain.example.com');
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });

    it('returns null for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBeNull();
      expect(extractDomain('')).toBeNull();
    });
  });

  describe('isFromAllowedDomain', () => {
    it('matches exact domains', () => {
      expect(isFromAllowedDomain('https://example.com', ['example.com'])).toBe(true);
      expect(isFromAllowedDomain('https://other.com', ['example.com'])).toBe(false);
    });

    it('matches subdomains of allowed domains', () => {
      expect(isFromAllowedDomain('https://docs.example.com', ['example.com'])).toBe(true);
      expect(isFromAllowedDomain('https://a.b.example.com', ['example.com'])).toBe(true);
    });

    it('supports suffix matching with leading dot', () => {
      expect(isFromAllowedDomain('https://docs.example.com', ['.example.com'])).toBe(true);
      expect(isFromAllowedDomain('https://example.com', ['.example.com'])).toBe(true);
    });

    it('rejects domains that only partially match', () => {
      // "notexample.com" should not match "example.com"
      expect(isFromAllowedDomain('https://notexample.com', ['example.com'])).toBe(false);
      expect(isFromAllowedDomain('https://example.com.evil.com', ['example.com'])).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isFromAllowedDomain('not-a-url', ['example.com'])).toBe(false);
    });
  });
});

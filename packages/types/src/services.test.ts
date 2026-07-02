import { describe, it, expect } from 'vitest';
import { ok, err, type Result } from './services';

describe('Result Type Helpers', () => {
  describe('ok', () => {
    it('creates a success result with a value', () => {
      const result = ok('test-value');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('test-value');
      }
    });

    it('creates a success result with a complex object', () => {
      const data = { id: 1, name: 'test', nested: { value: true } };
      const result = ok(data);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(data);
      }
    });

    it('creates a success result with null', () => {
      const result = ok(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('creates a success result with undefined', () => {
      const result = ok(undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeUndefined();
      }
    });

    it('creates a success result with an array', () => {
      const items = [1, 2, 3];
      const result = ok(items);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });
  });

  describe('err', () => {
    it('creates an error result with a string message', () => {
      const result = err('Something went wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Something went wrong');
      }
    });

    it('creates an error result with an Error object', () => {
      const error = new Error('Test error');
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('Test error');
      }
    });

    it('creates an error result with a custom error type', () => {
      interface CustomError {
        code: string;
        details: string;
      }
      const customError: CustomError = { code: 'INVALID', details: 'Invalid input' };
      const result = err(customError);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ code: 'INVALID', details: 'Invalid input' });
      }
    });
  });

  describe('Result type usage patterns', () => {
    it('allows type narrowing with ok check', () => {
      const result: Result<string> = ok('success');

      if (result.ok) {
        // TypeScript should know result.value exists here
        const value: string = result.value;
        expect(value).toBe('success');
      } else {
        // This branch shouldn't execute
        expect(true).toBe(false);
      }
    });

    it('allows type narrowing with error check', () => {
      const result: Result<string, string> = err('failed');

      if (!result.ok) {
        // TypeScript should know result.error exists here
        const error: string = result.error;
        expect(error).toBe('failed');
      } else {
        // This branch shouldn't execute
        expect(true).toBe(false);
      }
    });

    it('works with async functions returning Result', async () => {
      function fetchData(shouldSucceed: boolean): Promise<Result<number, string>> {
        if (shouldSucceed) {
          return Promise.resolve(ok(42));
        }
        return Promise.resolve(err('fetch failed'));
      }

      const successResult = await fetchData(true);
      expect(successResult.ok).toBe(true);
      if (successResult.ok) {
        expect(successResult.value).toBe(42);
      }

      const errorResult = await fetchData(false);
      expect(errorResult.ok).toBe(false);
      if (!errorResult.ok) {
        expect(errorResult.error).toBe('fetch failed');
      }
    });
  });
});

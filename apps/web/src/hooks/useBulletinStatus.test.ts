/**
 * Tests for useBulletinStatus. After the host-storage refactor, Bulletin availability is derived
 * from whether we're inside the Polkadot host container (reads/writes go through the host preimage
 * API), not from probing a chain client. These pin that logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

const { isInContainerMock } = vi.hoisted(() => ({ isInContainerMock: vi.fn() }));
vi.mock('../lib/host/detect', () => ({ isInContainer: isInContainerMock }));

import { useBulletinStatus } from './useBulletinStatus';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useBulletinStatus', () => {
  it('reports connected inside the host container', () => {
    isInContainerMock.mockReturnValue(true);
    const { result } = renderHook(() => useBulletinStatus());
    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports an error with a message outside the host container', () => {
    isInContainerMock.mockReturnValue(false);
    const { result } = renderHook(() => useBulletinStatus());
    expect(result.current.status).toBe('error');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Bulletin Chain is only available inside the Polkadot host.');
  });

  it('re-evaluates on retry (error → connected once in the host)', () => {
    isInContainerMock.mockReturnValue(false);
    const { result } = renderHook(() => useBulletinStatus());
    expect(result.current.isConnected).toBe(false);

    isInContainerMock.mockReturnValue(true);
    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });
});

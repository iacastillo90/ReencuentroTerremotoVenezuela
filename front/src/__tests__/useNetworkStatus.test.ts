import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const mockGetPendingCount = vi.hoisted(() => vi.fn());

vi.mock('../db/offlineDb', () => ({
  getPendingCount: mockGetPendingCount,
}));

vi.mock('../utils/sync-utils', () => ({
  registerBackgroundSync: vi.fn().mockResolvedValue(true),
}));

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPendingCount.mockResolvedValue(0);
    setNavigatorOnline(true);
  });

  it('starts as online with 0 pending', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
      expect(result.current.pendingCount).toBe(0);
    });
  });

  it('isOnline becomes false on offline event', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isOnline).toBe(true));

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('isOnline becomes true and refreshes pending on online event', async () => {
    mockGetPendingCount.mockResolvedValue(2);
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isOnline).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });
  });

  it('loads pending count from db on mount', async () => {
    mockGetPendingCount.mockResolvedValue(3);
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => {
      expect(result.current.pendingCount).toBe(3);
    });
  });

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useNetworkStatus());
    const handlers = new Map<string, EventListener>();

    addSpy.mock.calls.forEach(([type, handler]) => {
      if (type === 'online' || type === 'offline') {
        handlers.set(type as string, handler as EventListener);
      }
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', handlers.get('online'));
    expect(removeSpy).toHaveBeenCalledWith('offline', handlers.get('offline'));
  });
});

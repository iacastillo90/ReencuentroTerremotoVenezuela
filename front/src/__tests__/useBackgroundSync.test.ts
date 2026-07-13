import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

const mockDb = vi.hoisted(() => {
  const store: Record<number, Record<string, unknown>> = {};
  let nextId = 1;

  return {
    offlineReports: {
      add: vi.fn(async (item: Record<string, unknown>) => { const id = nextId++; store[id] = { id, ...item }; return id; }),
      update: vi.fn(async (id: number, changes: Record<string, unknown>) => { Object.assign(store[id], changes); }),
      delete: vi.fn(async (id: number) => { delete store[id]; }),
      where: vi.fn(() => ({
        equals: (val: string) => ({
          toArray: vi.fn(async () => Object.values(store).filter((r) => (r as Record<string, unknown>).status === val)),
          count: vi.fn(async () => Object.values(store).filter((r) => (r as Record<string, unknown>).status === val).length),
        }),
      })),
    },
  };
});

const mockGetPendingCount = vi.hoisted(() => vi.fn());
const mockRegisterBgSync = vi.hoisted(() => vi.fn());
const mockSendMsgSW = vi.hoisted(() => vi.fn());
const mockRefreshCsrf = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock('../db/offlineDb', () => ({
  db: mockDb,
  getPendingCount: mockGetPendingCount,
}));

vi.mock('../services/api', () => ({
  api: { post: mockApiPost },
  refreshCsrfToken: mockRefreshCsrf,
}));

vi.mock('../utils/sync-utils', () => ({
  registerBackgroundSync: mockRegisterBgSync,
  sendMessageToSW: mockSendMsgSW,
}));

function setupNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

function mockServiceWorker(hasSW = true) {
  const listeners = new Map<string, EventListener>();

  Object.defineProperty(navigator, 'serviceWorker', {
    value: hasSW
      ? {
          ready: Promise.resolve({}),
          addEventListener: (type: string, handler: EventListener) => listeners.set(type, handler),
          removeEventListener: (type: string, handler: EventListener) => listeners.delete(type),
          getListeners: () => listeners,
        }
      : undefined,
    configurable: true,
  });

  return listeners;
}

describe('useBackgroundSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigatorOnline(false);
    mockServiceWorker(true);
    mockGetPendingCount.mockResolvedValue(0);
    mockRegisterBgSync.mockResolvedValue(true);
    mockRefreshCsrf.mockResolvedValue(null);
  });

  it('does not sync on mount when no pending reports', async () => {
    renderHook(() => useBackgroundSync());
    await vi.waitFor(() => {
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  it('syncs pending reports on mount when online and reports exist', async () => {
    setupNavigatorOnline(true);
    const id = await mockDb.offlineReports.add({ reportData: { name: 'Test' }, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);
    mockApiPost.mockResolvedValue({ data: {} });

    renderHook(() => useBackgroundSync());

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/persons', { name: 'Test' });
    });

    expect(mockRefreshCsrf).toHaveBeenCalled();
    const stored = await mockDb.offlineReports.where('status').equals('syncing').toArray();
    expect(mockSendMsgSW).toHaveBeenCalledWith({ type: 'pending-count', count: expect.any(Number) });
  });

  it('uploads media before posting when report has photoFile', async () => {
    setupNavigatorOnline(true);
    const photoFile = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
    const id = await mockDb.offlineReports.add({ reportData: {}, photoFile, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);
    mockApiPost.mockResolvedValueOnce({ data: { url: '/media/test.jpg' } }).mockResolvedValueOnce({ data: {} });

    renderHook(() => useBackgroundSync());

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(2);
    });

    expect(mockApiPost).toHaveBeenNthCalledWith(1, '/media', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(mockApiPost).toHaveBeenNthCalledWith(2, '/persons', { photoUrl: '/media/test.jpg' });
  });

  it('marks report as failed after MAX_RETRIES', async () => {
    setupNavigatorOnline(true);
    const id = await mockDb.offlineReports.add({ reportData: { name: 'Fail' }, status: 'pending', retryCount: 2, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);
    mockApiPost.mockRejectedValue(new Error('network error'));

    renderHook(() => useBackgroundSync());

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(mockDb.offlineReports.update).toHaveBeenCalledWith(id, expect.objectContaining({ status: 'failed', retryCount: 3 }));
    });
  });

  it('increments retryCount and keeps pending when below MAX_RETRIES', async () => {
    setupNavigatorOnline(true);
    const id = await mockDb.offlineReports.add({ reportData: { name: 'Retry' }, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);
    mockApiPost.mockRejectedValue(new Error('network error'));

    renderHook(() => useBackgroundSync());

    await vi.waitFor(() => {
      expect(mockDb.offlineReports.update).toHaveBeenCalledWith(id, expect.objectContaining({ status: 'pending', retryCount: 1 }));
    });
  });

  it('triggers sync on online event when BackgroundSync unavailable', async () => {
    mockRegisterBgSync.mockResolvedValue(false);
    mockApiPost.mockResolvedValue({ data: {} });
    setupNavigatorOnline(true);

    const id = await mockDb.offlineReports.add({ reportData: { name: 'Online' }, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);

    renderHook(() => useBackgroundSync());

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/persons', { name: 'Online' });
    });
  });

  it('triggers sync on SW trigger-sync message', async () => {
    mockApiPost.mockResolvedValue({ data: {} });
    const listeners = mockServiceWorker(true);
    const id = await mockDb.offlineReports.add({ reportData: { name: 'SW' }, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);

    renderHook(() => useBackgroundSync());

    const swListener = listeners.get('message');
    expect(swListener).toBeDefined();

    act(() => {
      (swListener as EventListener)(new MessageEvent('message', { data: { type: 'trigger-sync' } }));
    });

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/persons', { name: 'SW' });
    });
  });

  it('returns syncNow function that triggers sync', async () => {
    mockApiPost.mockResolvedValue({ data: {} });
    const id = await mockDb.offlineReports.add({ reportData: { name: 'Manual' }, status: 'pending', retryCount: 0, createdAt: Date.now() });
    mockGetPendingCount.mockResolvedValue(1);

    const { result } = renderHook(() => useBackgroundSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockApiPost).toHaveBeenCalledWith('/persons', { name: 'Manual' });
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBackgroundSync());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
  });
});

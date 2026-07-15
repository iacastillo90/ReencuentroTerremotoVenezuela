import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerBackgroundSync, sendMessageToSW } from '../utils/sync-utils';

function mockSW(overrides?: Partial<ServiceWorkerRegistration>) {
  const mockReg: ServiceWorkerRegistration = {
    active: { postMessage: vi.fn() } as unknown as ServiceWorker,
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
  return mockReg;
}

describe('registerBackgroundSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when SyncManager is unavailable', async () => {
    vi.stubGlobal('SyncManager', undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockSW()) },
      configurable: true,
    });
    const result = await registerBackgroundSync();
    expect(result).toBe(false);
  });

  it('returns false when serviceWorker is unavailable', async () => {
    vi.stubGlobal('SyncManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });
    const result = await registerBackgroundSync();
    expect(result).toBe(false);
  });

  it('registers sync and returns true on success', async () => {
    const sync = { register: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('SyncManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(mockSW({ sync } as unknown as Partial<ServiceWorkerRegistration>)),
      },
      configurable: true,
    });

    const result = await registerBackgroundSync();
    expect(result).toBe(true);
    expect(sync.register).toHaveBeenCalledWith('sync-reports');
  });

  it('returns false when sync.register throws', async () => {
    const sync = { register: vi.fn().mockRejectedValue(new Error('no sync')) };
    vi.stubGlobal('SyncManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(mockSW({ sync } as unknown as Partial<ServiceWorkerRegistration>)),
      },
      configurable: true,
    });

    const result = await registerBackgroundSync();
    expect(result).toBe(false);
  });
});

describe('sendMessageToSW', () => {
  it('posts message to active worker', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(mockSW({ active: { postMessage } as unknown as ServiceWorker })),
      },
      configurable: true,
    });

    const result = await sendMessageToSW({ type: 'pending-count', count: 3 });
    expect(result).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: 'pending-count', count: 3 });
  });

  it('returns null when serviceWorker api fails', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.reject(new Error('no sw')),
      },
      configurable: true,
    });

    const result = await sendMessageToSW({ type: 'test' });
    expect(result).toBeNull();
  });

  it('returns null when serviceWorker is unavailable', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });
    const result = await sendMessageToSW({ type: 'test' });
    expect(result).toBeNull();
  });
});

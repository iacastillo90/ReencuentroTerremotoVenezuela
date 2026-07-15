import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore: { data: Record<number, Record<string, unknown>>; nextId: number } = { data: {}, nextId: 1 };

vi.mock('dexie', () => {
  const createTable = () => {
    const table = {
      add: vi.fn(async (item: Record<string, unknown>) => {
        const id = mockStore.nextId++;
        mockStore.data[id] = { id, ...item };
        return id;
      }),
      update: vi.fn(async (id: number, changes: Record<string, unknown>) => {
        if (mockStore.data[id]) Object.assign(mockStore.data[id], changes);
      }),
      delete: vi.fn(async (id: number) => { delete mockStore.data[id]; }),
      where: vi.fn(() => ({
        equals: (val: string) => ({
          toArray: vi.fn(async () =>
            Object.values(mockStore.data).filter((r) => (r as Record<string, unknown>).status === val),
          ),
          count: vi.fn(async () =>
            Object.values(mockStore.data).filter((r) => (r as Record<string, unknown>).status === val).length,
          ),
        }),
      })),
      get: vi.fn(async (id: number) => mockStore.data[id]),
    };
    return table;
  };

  const DexieMock = class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    version() {
      const self = this;
      return {
        stores: (schema: Record<string, string>) => {
          Object.keys(schema).forEach((key) => { self[key] = createTable(); });
          return { upgrade: () => {} };
        },
      };
    }
  };

  return { default: DexieMock, Dexie: DexieMock };
});

import { db, getPendingCount, addPendingReport } from '../db/offlineDb';

describe('offlineDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.data = {};
    mockStore.nextId = 1;
  });

  it('addPendingReport returns an id', async () => {
    const id = await addPendingReport({ name: 'Test' }, undefined, 'csrf123');
    expect(id).toBeGreaterThan(0);
  });

  it('getPendingCount returns 0 when no pending reports', async () => {
    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it('getPendingCount returns count of pending reports', async () => {
    await addPendingReport({ name: 'Report 1' });
    await addPendingReport({ name: 'Report 2' });
    const count = await getPendingCount();
    expect(count).toBe(2);
  });

  it('getPendingCount returns 0 when dexie throws', async () => {
    db.offlineReports.where = vi.fn(() => { throw new Error('dexie error'); }) as never;
    const count = await getPendingCount();
    expect(count).toBe(0);
  });
});

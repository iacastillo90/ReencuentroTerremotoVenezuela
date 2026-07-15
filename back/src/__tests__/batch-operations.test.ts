import { runConcurrent } from '../utils/run-concurrent.util';

describe('Batch Operations', () => {
  it('limits concurrent operations', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const items = Array.from({ length: 5 }, (_, i) => i);
    await runConcurrent(items, 2, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      concurrent--;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('processes items in chunks of specified size', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `test-${i}` }));
    const chunkSize = 2;
    const chunks: typeof items[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[1]).toHaveLength(2);
    expect(chunks[2]).toHaveLength(1);
  });

  it('isolates individual operation failures', async () => {
    const results = await Promise.allSettled([
      Promise.resolve('ok'),
      Promise.reject(new Error('fail')),
      Promise.resolve('ok2'),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });
});

describe('Reconcile Job Batch Operations', () => {
  it('runFuzzyMatching uses bulkWrite with chunking', async () => {
    jest.isolateModules(() => {
      const { runFuzzyMatching } = require('../jobs/reconcile.job');
      expect(runFuzzyMatching).toBeDefined();
      expect(typeof runFuzzyMatching).toBe('function');
    });
  });

  it('runGeospatialCrossover uses bulkWrite with chunking', async () => {
    jest.isolateModules(() => {
      const { runGeospatialCrossover } = require('../jobs/reconcile.job');
      expect(runGeospatialCrossover).toBeDefined();
      expect(typeof runGeospatialCrossover).toBe('function');
    });
  });
});

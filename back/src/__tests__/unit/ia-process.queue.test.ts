jest.mock('../../config/redis.config', () => ({
  connection: {}
}));

import { iaProcessQueue } from '../../queues/ia-process.queue';

describe('IA Process Queue Configuration', () => {
  it('should have removeOnFail with age and count properties', () => {
    const opts = (iaProcessQueue as any).opts;
    expect(opts).toBeDefined();
    expect(opts.defaultJobOptions).toBeDefined();
    expect(opts.defaultJobOptions.removeOnFail).toBeDefined();
    expect(opts.defaultJobOptions.removeOnFail).not.toBe(false);
    expect(typeof opts.defaultJobOptions.removeOnFail).toBe('object');
    expect(opts.defaultJobOptions.removeOnFail.age).toBe(24 * 3600);
    expect(opts.defaultJobOptions.removeOnFail.count).toBe(100);
  });
});

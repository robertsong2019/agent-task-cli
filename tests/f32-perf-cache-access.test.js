const PerformanceManager = require('../src/utils/performance');

describe('F32: PerformanceManager direct cache access', () => {
  let pm;

  beforeEach(() => {
    pm = new PerformanceManager({ cacheTTL: 1000 });
  });

  test('getCached returns undefined for non-existent key', () => {
    expect(pm.getCached('nope')).toBeUndefined();
  });

  test('getCached returns cached value', () => {
    pm.cache.set('test:abc', { data: 42, timestamp: Date.now() });
    expect(pm.getCached('test')).toBe(42);
  });

  test('getCached returns undefined for expired entry', () => {
    pm.cache.set('test:abc', { data: 42, timestamp: Date.now() - 2000 });
    expect(pm.getCached('test')).toBeUndefined();
  });

  test('invalidateCache removes entry', async () => {
    await pm.cachedExecute('key1', async () => 'result1');
    expect(pm.getCached('key1')).toBe('result1');
    pm.invalidateCache('key1');
    expect(pm.getCached('key1')).toBeUndefined();
  });

  test('invalidateCache with prefix removes matching entries', async () => {
    await pm.cachedExecute('user:1', async () => 'a');
    await pm.cachedExecute('user:2', async () => 'b');
    await pm.cachedExecute('post:1', async () => 'c');
    pm.invalidateCacheByPrefix('user');
    expect(pm.getCached('user:1')).toBeUndefined();
    expect(pm.getCached('user:2')).toBeUndefined();
    expect(pm.getCached('post:1')).toBe('c');
  });
});

const PerformanceManager = require('../src/utils/performance');

describe('PerformanceManager getCached prefix-index optimization', () => {
  let pm;

  beforeEach(() => {
    pm = new PerformanceManager({ maxCacheSize: 1000, cacheTTL: 10000 });
  });

  test('returns first fresh match via prefix index', async () => {
    await pm.cachedExecute('user:1', () => Promise.resolve('u1'));
    await pm.cachedExecute('user:2', () => Promise.resolve('u2'));
    await pm.cachedExecute('session:1', () => Promise.resolve('s1'));

    expect(pm.getCached('user')).toBe('u1');
    expect(pm.getCached('session')).toBe('s1');
    expect(pm.getCached('nonexistent')).toBeUndefined();
  });

  test('returns fresh entry when an earlier expired entry exists', () => {
    pm.cache.set('p:old', { data: 'stale', timestamp: Date.now() - 20000 });
    pm._addToPrefixIndex('p:old');
    pm.cache.set('p:new', { data: 'fresh', timestamp: Date.now() });
    pm._addToPrefixIndex('p:new');

    expect(pm.getCached('p')).toBe('fresh');
    expect(pm.cache.has('p:old')).toBe(false);
  });

  test('purges expired candidates under the queried prefix only', () => {
    pm.cache.set('user:1', { data: 'u1', timestamp: Date.now() - 20000 });
    pm._addToPrefixIndex('user:1');
    pm.cache.set('user:2', { data: 'u2', timestamp: Date.now() });
    pm._addToPrefixIndex('user:2');
    pm.cache.set('other:1', { data: 'o1', timestamp: Date.now() - 20000 });
    pm._addToPrefixIndex('other:1');

    expect(pm.getCached('user')).toBe('u2');
    expect(pm.cache.has('user:1')).toBe(false);
    // Out-of-scope entries must not be touched by another prefix's lookup
    expect(pm.cache.has('other:1')).toBe(true);
  });

  test('falls back to linear scan for direct cache writes (no index)', () => {
    pm.cache.set('solo:x', { data: 'direct', timestamp: Date.now() });
    expect(pm.getCached('solo')).toBe('direct');

    pm.cache.set('solo:y', { data: 'gone', timestamp: Date.now() - 20000 });
    // Expired direct-write entry is purged, fresh one still returned
    expect(pm.getCached('solo')).toBe('direct');
    expect(pm.cache.has('solo:y')).toBe(false);
  });

  test('index stays symmetric with registrations after invalidation', async () => {
    await pm.cachedExecute('app:cache:a', () => Promise.resolve('a'));
    await pm.cachedExecute('app:cache:b', () => Promise.resolve('b'));

    pm.invalidateCacheByPrefix('app:cache');

    // No phantom index entries survive invalidation (leak regression guard)
    expect(pm._getKeysByPrefix('app:cache')).toHaveLength(0);
    expect(pm._getKeysByPrefix('app:cache:')).toHaveLength(0);
    expect(pm._getKeysByPrefix('app:cache:a')).toHaveLength(0);
    expect(pm._getKeysByPrefix('app')).toHaveLength(0);
  });

  test('handles large caches through the index without degradation', async () => {
    for (let i = 1; i <= 1000; i++) {
      await pm.cachedExecute(`user:${i}`, () => Promise.resolve(`data_${i}`));
    }
    const start = Date.now();
    expect(pm.getCached('user')).toBe('data_1');
    expect(Date.now() - start).toBeLessThan(50);
    expect(pm.cache.size).toBe(1000);
  });
});

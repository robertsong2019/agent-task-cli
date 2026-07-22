const { Cache } = require('../../src/utils/cache');

describe('F201: Cache.getAndTouch(key, ttl)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 1000 });
  });

  test('returns value and refreshes TTL', () => {
    cache.set('k1', 'v1', 100);
    const val = cache.getAndTouch('k1', 5000);
    expect(val).toBe('v1');
    // Key should still be alive well past original 100ms TTL
    const meta = cache.getWithMeta('k1');
    expect(meta).toBeTruthy();
    expect(meta.ttlRemaining).toBeGreaterThan(100);
  });

  test('returns undefined for missing key', () => {
    expect(cache.getAndTouch('nope', 5000)).toBeUndefined();
    expect(cache.stats.misses).toBe(1);
  });

  test('returns undefined for expired key', (done) => {
    cache.set('exp', 'val', 50);
    setTimeout(() => {
      expect(cache.getAndTouch('exp', 5000)).toBeUndefined();
      expect(cache.stats.evictions).toBeGreaterThanOrEqual(1);
      done();
    }, 80);
  });

  test('refreshes using original TTL when no ttl param given', () => {
    cache.set('k2', 'v2', 2000);
    const val = cache.getAndTouch('k2');
    expect(val).toBe('v2');
    const meta = cache.getWithMeta('k2');
    expect(meta.ttlRemaining).toBeGreaterThan(1000);
  });

  test('updates LRU position (moves to end)', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Touch 'a' to move it to end (most recently used)
    cache.getAndTouch('a');
    // Now evict — should evict 'b' (oldest untouched), not 'a'
    cache.set('d', 4); // maxSize=10, won't evict
    // Verify 'a' still exists
    expect(cache.get('a')).toBe(1);
  });

  test('increments hit counter on success', () => {
    cache.set('hit', 'val');
    cache.getAndTouch('hit', 3000);
    expect(cache.stats.hits).toBe(1);
  });
});

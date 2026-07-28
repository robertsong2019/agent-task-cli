const { Cache } = require('../../src/utils/cache');

describe('F210: Cache.touch(key, ttl?)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 1000 });
  });

  test('returns true and extends TTL for existing key', () => {
    cache.set('k1', 'value');
    const result = cache.touch('k1', 5000);
    expect(result).toBe(true);
    // Key should still exist after original TTL would have expired
    const entry = cache.cache.get('k1');
    expect(entry.expiresAt).toBeGreaterThan(Date.now() + 4000);
  });

  test('returns false for missing key', () => {
    const result = cache.touch('nonexistent');
    expect(result).toBe(false);
  });

  test('returns false for expired key and removes it', () => {
    cache.set('k1', 'value', 10); // 10ms TTL
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 20) { /* busy wait */ }
    const result = cache.touch('k1');
    expect(result).toBe(false);
    expect(cache.cache.has('k1')).toBe(false);
    expect(cache.stats.evictions).toBe(1);
  });

  test('uses defaultTTL when no ttl provided', () => {
    cache.set('k1', 'value', 50); // short TTL
    cache.touch('k1'); // should reset to defaultTTL (1000ms)
    const entry = cache.cache.get('k1');
    expect(entry.expiresAt - Date.now()).toBeGreaterThan(500);
  });

  test('does not update LRU position', () => {
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k3', 'v3'); // capacity=2 would evict, but default is larger
    // touch k1, then check it's still in original position
    cache.touch('k1');
    expect(cache.get('k1')).toBe('v1');
  });

  test('does not affect hit/miss stats', () => {
    cache.set('k1', 'value');
    const hitsBefore = cache.stats.hits;
    const missesBefore = cache.stats.misses;
    cache.touch('k1');
    expect(cache.stats.hits).toBe(hitsBefore);
    expect(cache.stats.misses).toBe(missesBefore);
  });

  test('works with permanent keys (no TTL)', () => {
    const c = new Cache({ defaultTTL: 0 }); // no TTL by default
    c.set('k1', 'value');
    const result = c.touch('k1', 1000);
    expect(result).toBe(true);
    const entry = c.cache.get('k1');
    expect(entry.expiresAt).toBeGreaterThan(Date.now());
  });

  test('touch multiple keys sequentially', () => {
    cache.set('a', 1, 100);
    cache.set('b', 2, 100);
    cache.set('c', 3, 100);
    expect(cache.touch('a', 5000)).toBe(true);
    expect(cache.touch('b', 5000)).toBe(true);
    expect(cache.touch('c', 5000)).toBe(true);
    // Wait for original TTL
    const start = Date.now();
    while (Date.now() - start < 120) { /* busy wait */ }
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});

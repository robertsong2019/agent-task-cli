const { Cache } = require('../src/utils/cache');

describe('F143: Cache.ttl()', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 0 });
  });

  afterEach(() => cache.destroy());

  test('returns remaining TTL for key with expiry', () => {
    cache.set('k1', 'v1', 5000);
    const remaining = cache.ttl('k1');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5000);
  });

  test('returns -1 for key with no expiry', () => {
    cache.cache.set('k2', { value: 'v2', expiresAt: null, lastAccessed: Date.now() });
    expect(cache.ttl('k2')).toBe(-1);
  });

  test('returns -2 for non-existent key', () => {
    expect(cache.ttl('nope')).toBe(-2);
  });

  test('returns -2 for expired key', async () => {
    cache.set('k3', 'v3', 10);
    await new Promise(r => setTimeout(r, 20));
    expect(cache.ttl('k3')).toBe(-2);
  });

  test('persist() makes ttl() return -1', () => {
    cache.set('k4', 'v4', 5000);
    cache.persist('k4');
    expect(cache.ttl('k4')).toBe(-1);
  });

  test('expire() updates remaining TTL', () => {
    cache.set('k5', 'v5', 1000);
    cache.expire('k5', 10000);
    const remaining = cache.ttl('k5');
    expect(remaining).toBeGreaterThan(5000);
  });
});

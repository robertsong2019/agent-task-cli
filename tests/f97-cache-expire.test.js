const { Cache } = require('../src/utils/cache');

describe('Cache.expire()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 0 }); });
  afterEach(() => { cache.destroy(); });

  test('returns true and updates TTL for existing key', () => {
    cache.set('a', 1, 5000);
    const result = cache.expire('a', 60000);
    expect(result).toBe(true);
    // key should still exist
    expect(cache.get('a')).toBe(1);
  });

  test('returns false for missing key', () => {
    expect(cache.expire('nope', 5000)).toBe(false);
  });

  test('returns false for already-expired key', () => {
    cache.set('b', 2, 1);
    // wait for expiry
    return new Promise(r => setTimeout(r, 10)).then(() => {
      expect(cache.expire('b', 5000)).toBe(false);
    });
  });

  test('set to null TTL makes key never expire', () => {
    cache.set('c', 3, 5000);
    cache.expire('c', null);
    // entry.expiresAt should be null
    const entry = cache.cache.get('c');
    expect(entry.expiresAt).toBeNull();
  });
});

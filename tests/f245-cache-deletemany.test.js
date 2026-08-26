const { Cache } = require('../src/utils/cache');

describe('F245: Cache.deleteMany(keys) — batch delete (inverse of getMany)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: null });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('deletes existing keys and returns count', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.deleteMany(['a', 'c'])).toBe(2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  test('missing keys are not counted', () => {
    cache.set('x', 1);
    expect(cache.deleteMany(['x', 'nope', 'also-nope'])).toBe(1);
    expect(cache.get('x')).toBeUndefined();
  });

  test('returns 0 for all-missing or empty input', () => {
    expect(cache.deleteMany([])).toBe(0);
    expect(cache.deleteMany(['ghost'])).toBe(0);
  });

  test('purges expired entries but does not count them as deleted', async () => {
    cache.set('fresh', 1);
    cache.set('stale', 2, 5); // 5ms TTL
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.deleteMany(['fresh', 'stale'])).toBe(1);
    expect(cache.get('fresh')).toBeUndefined();
  });

  test('duplicate keys: second delete of same key is not counted', () => {
    cache.set('only', 1);
    expect(cache.deleteMany(['only', 'only'])).toBe(1);
  });

  test('throws TypeError when keys is not an array', () => {
    expect(() => cache.deleteMany('a')).toThrow(TypeError);
    expect(() => cache.deleteMany(null)).toThrow(/must be an array/);
  });
});

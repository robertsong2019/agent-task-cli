const { Cache } = require('../../src/utils/cache');

describe('Cache F106: random()', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('returns null for empty cache', () => {
    expect(cache.random()).toBeNull();
  });

  test('returns an entry from a single-item cache', () => {
    cache.set('only', 42);
    const result = cache.random();
    expect(result).toEqual({ key: 'only', value: 42 });
  });

  test('returns a valid entry from multi-item cache', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    for (let i = 0; i < 20; i++) {
      const result = cache.random();
      expect(result).not.toBeNull();
      expect(['a', 'b', 'c']).toContain(result.key);
      expect([1, 2, 3]).toContain(result.value);
    }
  });

  test('skips expired entries', async () => {
    cache.set('fresh', 'val');
    cache.set('old', 'expired', 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 50));
    const result = cache.random();
    expect(result).toEqual({ key: 'fresh', value: 'val' });
  });

  test('returns null when all entries are expired', async () => {
    cache.set('x', 1, 10);
    await new Promise(r => setTimeout(r, 50));
    expect(cache.random()).toBeNull();
  });

  test('does not modify cache state', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const sizeBefore = cache.size;
    cache.random();
    expect(cache.size).toBe(sizeBefore);
  });
});

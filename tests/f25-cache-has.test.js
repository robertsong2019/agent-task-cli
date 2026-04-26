const { Cache } = require('../src/utils/cache');

describe('F25: Cache has()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 100 }); });

  test('returns true for existing key', () => {
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
  });

  test('returns false for missing key', () => {
    expect(cache.has('nope')).toBe(false);
  });

  test('returns false for expired key', async () => {
    cache.set('old', 'val', 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 20));
    expect(cache.has('old')).toBe(false);
  });

  test('does not affect hit/miss stats', () => {
    cache.set('a', 1);
    cache.has('a');
    cache.has('missing');
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);
  });
});

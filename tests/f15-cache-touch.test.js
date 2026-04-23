const { Cache } = require('../src/utils/cache');

describe('F15: Cache.touch()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 500 }); });
  afterEach(() => { cache.destroy(); });

  test('refreshes TTL on existing key', async () => {
    cache.set('a', 1, 100); // 100ms TTL
    await sleep(50);
    expect(cache.get('a')).toBe(1);
    const refreshed = cache.touch('a', 200); // extend to 200ms from now
    expect(refreshed).toBe(true);
    await sleep(100); // original 100ms would have expired
    expect(cache.get('a')).toBe(1); // still alive
  });

  test('returns false for missing key', () => {
    expect(cache.touch('nonexistent')).toBe(false);
  });

  test('returns false for expired key', async () => {
    cache.set('a', 1, 30);
    await sleep(50);
    expect(cache.touch('a')).toBe(false);
  });

  test('uses defaultTTL when no newTTL specified', async () => {
    cache.set('a', 1, 50);
    cache.touch('a'); // should use defaultTTL=500
    await sleep(60);
    expect(cache.get('a')).toBe(1);
  });

  test('updates lastAccessed time', () => {
    cache.set('a', 1, 5000);
    const entry = cache.cache.get('a');
    const before = entry.lastAccessed;
    cache.touch('a', 5000);
    expect(entry.lastAccessed).toBeGreaterThanOrEqual(before);
  });
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

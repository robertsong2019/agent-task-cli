const { Cache } = require('../src/utils/cache');

describe('F18: Cache.getOrSet()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 1000 }); });
  afterEach(() => { cache.destroy(); });

  test('returns cached value when key exists', async () => {
    cache.set('k', 'v');
    const result = await cache.getOrSet('k', () => 'new');
    expect(result).toBe('v');
  });

  test('calls factory and caches when key missing', async () => {
    let calls = 0;
    const result = await cache.getOrSet('k', async () => { calls++; return 42; });
    expect(result).toBe(42);
    expect(calls).toBe(1);
    expect(cache.get('k')).toBe(42);
  });

  test('caches factory result, does not re-call on second access', async () => {
    let calls = 0;
    await cache.getOrSet('k', async () => { calls++; return 'hi'; });
    await cache.getOrSet('k', async () => { calls++; return 'bye'; });
    expect(calls).toBe(1);
    expect(cache.get('k')).toBe('hi');
  });

  test('accepts non-async factory', async () => {
    const result = await cache.getOrSet('k', () => 'sync');
    expect(result).toBe('sync');
  });

  test('accepts static value as factory', async () => {
    const result = await cache.getOrSet('k', 'static');
    expect(result).toBe('static');
  });
});

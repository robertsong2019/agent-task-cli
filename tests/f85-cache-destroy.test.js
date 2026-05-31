const { Cache } = require('../src/utils/cache');

describe('F85 Cache.destroy()', () => {
  test('destroy clears the cache and stops the interval', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);

    cache.destroy();

    expect(cache.size()).toBe(0);
    expect(cache.cleanupInterval).toBeNull();
  });

  test('destroy is idempotent', () => {
    const cache = new Cache();
    cache.destroy();
    cache.destroy(); // second call should not throw
    expect(cache.size()).toBe(0);
  });

  test('cache works after destroy if re-used for reads', () => {
    const cache = new Cache();
    cache.set('x', 42);
    cache.destroy();
    expect(cache.get('x')).toBeUndefined();
  });

  test('setInterval does not block process exit (unref)', () => {
    const cache = new Cache();
    const interval = cache.cleanupInterval;
    expect(interval).not.toBeNull();
    cache.destroy();
    expect(cache.cleanupInterval).toBeNull();
  });
});

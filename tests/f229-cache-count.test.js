const { Cache } = require('../src/utils/cache');

describe('F229: Cache.count()', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('counts all non-expired entries without predicate', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.count()).toBe(3);
  });

  test('returns 0 for empty cache', () => {
    expect(cache.count()).toBe(0);
  });

  test('counts entries matching a predicate', () => {
    cache.set('a', 10);
    cache.set('b', 20);
    cache.set('c', 30);
    cache.set('d', 5);

    const count = cache.count((value) => value >= 15);
    expect(count).toBe(2);
  });

  test('predicate receives (value, key)', () => {
    cache.set('apple', 1);
    cache.set('banana', 2);
    cache.set('apricot', 3);

    const count = cache.count((_, key) => key.startsWith('a'));
    expect(count).toBe(2);
  });

  test('excludes expired entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3, 50); // 50ms TTL

    // Wait for 'c' to expire
    const start = Date.now();
    while (Date.now() - start < 60) {
      // busy wait
    }

    expect(cache.count()).toBe(2);
  });

  test('returns 0 when predicate matches nothing', () => {
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.count((v) => v > 100)).toBe(0);
  });

  test('handles complex predicate with object values', () => {
    cache.set('u1', { name: 'Alice', age: 30 });
    cache.set('u2', { name: 'Bob', age: 25 });
    cache.set('u3', { name: 'Carol', age: 35 });

    const count = cache.count((v) => v.age >= 30);
    expect(count).toBe(2);
  });
});

const { Cache } = require('../../src/utils/cache');

describe('F207: Cache.memo(fn, opts)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 5000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('caches result of function call', () => {
    let callCount = 0;
    const fn = (x) => { callCount++; return x * 2; };
    const memoized = cache.memo(fn);

    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  test('different args produce different cache entries', () => {
    let callCount = 0;
    const fn = (x) => { callCount++; return x + 1; };
    const memoized = cache.memo(fn);

    memoized(1);
    memoized(2);
    memoized(1); // cached
    expect(callCount).toBe(2);
  });

  test('supports custom keyFn', () => {
    let callCount = 0;
    const fn = (a, b) => { callCount++; return a + b; };
    const keyFn = (a, b) => `sum:${a}:${b}`;
    const memoized = cache.memo(fn, { keyFn });

    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);
    // Verify the custom key was used
    expect(cache.get('sum:1:2')).toBe(3);
  });

  test('respects custom TTL', (done) => {
    let callCount = 0;
    const fn = (x) => { callCount++; return x; };
    const memoized = cache.memo(fn, { ttl: 50 });

    memoized(42);
    expect(callCount).toBe(1);
    expect(memoized(42)).toBe(42);
    expect(callCount).toBe(1);

    setTimeout(() => {
      expect(memoized(42)).toBe(42);
      expect(callCount).toBe(2);
      done();
    }, 80);
  });

  test('returns memoized function with .cache property', () => {
    const fn = (x) => x;
    const memoized = cache.memo(fn);
    expect(memoized.cache).toBe(cache);
  });

  test('preserves this context when called on object', () => {
    const obj = {
      multiplier: 3,
      compute(x) { return x * this.multiplier; }
    };
    obj.compute = cache.memo(obj.compute.bind(obj));
    expect(obj.compute(4)).toBe(12);
    expect(obj.compute(4)).toBe(12);
  });

  test('handles undefined args via JSON serialization', () => {
    const fn = (x) => `got:${x}`;
    const memoized = cache.memo(fn);
    expect(memoized(undefined)).toBe('got:undefined');
    expect(memoized(undefined)).toBe('got:undefined');
    // Should only call once since JSON.stringify(undefined) === undefined,
    // which means key becomes "memo:undefined"
  });

  test('handles object args', () => {
    let calls = 0;
    const fn = (obj) => { calls++; return obj.a + obj.b; };
    const memoized = cache.memo(fn);

    expect(memoized({ a: 1, b: 2 })).toBe(3);
    expect(memoized({ a: 1, b: 2 })).toBe(3);
    expect(calls).toBe(1);
  });
});

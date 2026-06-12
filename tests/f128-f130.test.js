/**
 * F128: Cache.withTTL(key, fn, ttl) — compute & cache with explicit TTL
 * F129: Cache.snapshot() — plain-object of all non-expired entries
 */

const { Cache } = require('../src/utils/cache');

describe('F128: Cache.withTTL', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new Cache({ defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
    jest.useRealTimers();
  });

  test('computes and caches value when key is missing', async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const result = await cache.withTTL('answer', fn, 30000);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    const result2 = await cache.withTTL('answer', fn, 30000);
    expect(result2).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('respects TTL expiry', async () => {
    const fn = jest.fn().mockResolvedValue('hello');
    await cache.withTTL('greeting', fn, 5000);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(6000);
    const result = await cache.withTTL('greeting', fn, 5000);
    expect(result).toBe('hello');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('does not call fn when value exists', async () => {
    cache.set('existing', 'cached');
    const fn = jest.fn().mockResolvedValue('should-not-be-called');
    const result = await cache.withTTL('existing', fn, 30000);
    expect(result).toBe('cached');
    expect(fn).not.toHaveBeenCalled();
  });

  test('works with sync fn', async () => {
    const fn = jest.fn(() => 'sync-value');
    const result = await cache.withTTL('sync', fn, 10000);
    expect(result).toBe('sync-value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('returns undefined for expired key and recomputes', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    await cache.withTTL('key', fn, 3000);
    jest.advanceTimersByTime(4000);
    const result = await cache.withTTL('key', fn, 3000);
    expect(result).toBe('second');
  });
});

describe('F129: Cache.snapshot', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new Cache({ defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
    jest.useRealTimers();
  });

  test('returns empty object for empty cache', () => {
    expect(cache.snapshot()).toEqual({});
  });

  test('returns all non-expired entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 'hello');
    const snap = cache.snapshot();
    expect(snap).toEqual({ a: 1, b: 2, c: 'hello' });
  });

  test('excludes expired entries', () => {
    cache.set('fresh', 'value', 60000);
    cache.set('stale', 'old', 100);
    jest.advanceTimersByTime(200);
    const snap = cache.snapshot();
    expect(snap.fresh).toBe('value');
    expect(snap.stale).toBeUndefined();
  });

  test('snapshot keys are independent from cache', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const snap = cache.snapshot();
    delete snap.a;
    expect(cache.get('a')).toBe(1);
    expect(snap.a).toBeUndefined();
  });

  test('works with object values', () => {
    cache.set('user', { name: 'Alice', age: 30 });
    cache.set('list', [1, 2, 3]);
    const snap = cache.snapshot();
    expect(snap.user).toEqual({ name: 'Alice', age: 30 });
    expect(snap.list).toEqual([1, 2, 3]);
  });
});

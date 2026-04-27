const { Cache } = require('../src/utils/cache');

describe('Cache batch operations', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('mget', () => {
    test('returns multiple existing values', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.mget(['a', 'b', 'c'])).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('omits missing keys', () => {
      cache.set('a', 1);
      expect(cache.mget(['a', 'missing'])).toEqual({ a: 1 });
    });

    test('returns empty object for all missing keys', () => {
      expect(cache.mget(['x', 'y'])).toEqual({});
    });
  });

  describe('mset', () => {
    test('sets multiple values at once', () => {
      cache.mset({ x: 10, y: 20, z: 30 });
      expect(cache.get('x')).toBe(10);
      expect(cache.get('y')).toBe(20);
      expect(cache.get('z')).toBe(30);
    });

    test('respects custom TTL', () => {
      jest.useFakeTimers();
      cache.mset({ a: 1 }, 100); // 100ms TTL
      expect(cache.get('a')).toBe(1);
      jest.advanceTimersByTime(150);
      expect(cache.get('a')).toBeUndefined();
      jest.useRealTimers();
    });
  });

  describe('mdelete', () => {
    test('deletes multiple keys and returns count', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.mdelete(['a', 'b', 'nonexistent'])).toBe(2);
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(true);
    });
  });

  describe('invalidateByPrefix', () => {
    test('invalidates only keys with matching prefix', () => {
      cache.set('task:abc', { result: 1 });
      cache.set('task:def', { result: 2 });
      cache.set('agent:xyz', { name: 'bot' });
      expect(cache.invalidateByPrefix('task:')).toBe(2);
      expect(cache.has('task:abc')).toBe(false);
      expect(cache.has('task:def')).toBe(false);
      expect(cache.has('agent:xyz')).toBe(true);
    });

    test('returns 0 when no keys match', () => {
      cache.set('foo', 1);
      expect(cache.invalidateByPrefix('bar')).toBe(0);
      expect(cache.size()).toBe(1);
    });
  });

  describe('resetStats', () => {
    test('resets hit/miss/eviction counters to zero', () => {
      cache.set('x', 1);
      cache.get('x'); // hit
      cache.get('missing'); // miss
      const before = cache.getStats();
      expect(before.hits).toBeGreaterThanOrEqual(1);
      expect(before.misses).toBeGreaterThanOrEqual(1);
      cache.resetStats();
      const after = cache.getStats();
      expect(after.hits).toBe(0);
      expect(after.misses).toBe(0);
      expect(after.evictions).toBe(0);
      expect(after.size).toBe(cache.size());
    });
  });

  describe('entries', () => {
    test('returns all non-expired entries with metadata', () => {
      cache.set('a', 1);
      cache.set('b', 'hello', 60000);
      const entries = cache.entries();
      expect(entries.length).toBe(2);
      const a = entries.find(e => e.key === 'a');
      expect(a.value).toBe(1);
      expect(a.createdAt).toBeTruthy();
      expect(a.lastAccessed).toBeTruthy();
      expect(a.expiresAt).toBeTruthy(); // default TTL
      const b = entries.find(e => e.key === 'b');
      expect(b.value).toBe('hello');
    });

    test('excludes expired entries', () => {
      cache.set('expired', 'val', 1);
      return new Promise(resolve => setTimeout(() => {
        const entries = cache.entries();
        expect(entries.find(e => e.key === 'expired')).toBeUndefined();
        resolve();
      }, 10));
    });

    test('returns empty array for empty cache', () => {
      cache.clear();
      expect(cache.entries()).toEqual([]);
    });
  });
});

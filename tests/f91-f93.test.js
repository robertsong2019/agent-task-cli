const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');

describe('F91: Cache.shrink(maxSize)', () => {
  test('evicts oldest entries to reach maxSize', () => {
    const cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    const evicted = cache.shrink(2);
    expect(evicted).toBe(2);
    // Count non-expired entries
    let remaining = 0;
    const now = Date.now();
    for (const [, e] of cache.cache) {
      if (!e.expiresAt || e.expiresAt > now) remaining++;
    }
    expect(remaining).toBeLessThanOrEqual(2);
  });

  test('returns 0 when already within maxSize', () => {
    const cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    cache.set('x', 1);
    expect(cache.shrink(5)).toBe(0);
  });

  test('throws on invalid maxSize', () => {
    const cache = new Cache();
    expect(() => cache.shrink(-1)).toThrow('non-negative number');
    expect(() => cache.shrink('a')).toThrow('non-negative number');
  });

  test('skips expired entries when counting', () => {
    const cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    cache.set('fresh', 'v');
    cache.cache.set('expired', { value: 'old', expiresAt: Date.now() - 1000, createdAt: 0 });
    expect(cache.shrink(10)).toBe(0);
  });
});

describe('F92: EventBus.onceAsync(event, timeout)', () => {
  test('resolves with event object from emit', async () => {
    const bus = new EventBus();
    const promise = bus.onceAsync('test', 2000);
    bus.emit('test', { num: 42 });
    const args = await promise;
    expect(args[0].channel).toBe('test');
    expect(args[0].data).toEqual({ num: 42 });
  });

  test('rejects on timeout', async () => {
    const bus = new EventBus();
    await expect(bus.onceAsync('never', 50)).rejects.toThrow('timeout');
  });

  test('only fires once', async () => {
    const bus = new EventBus();
    const promise = bus.onceAsync('ping', 2000);
    bus.emit('ping', { v: 1 });
    bus.emit('ping', { v: 2 });
    const args = await promise;
    expect(args[0].data).toEqual({ v: 1 });
  });

  test('cleans up listener on timeout', async () => {
    const bus = new EventBus();
    try { await bus.onceAsync('x', 30); } catch (e) { /* expected */ }
    // Should not have lingering listeners
    expect(bus.listenerCount('x')).toBe(0);
  });
});

describe('F93: Cache.compact()', () => {
  test('removes expired entries, keeps fresh ones', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('fresh', 1);
    const past = Date.now() - 5000;
    cache.cache.set('old1', { value: 'x', expiresAt: past, createdAt: 0 });
    cache.cache.set('old2', { value: 'y', expiresAt: past, createdAt: 0 });
    const removed = cache.compact();
    expect(removed).toBe(2);
    expect(cache.cache.has('fresh')).toBe(true);
    expect(cache.cache.has('old1')).toBe(false);
  });

  test('returns 0 when no expired entries', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('a', 1);
    expect(cache.compact()).toBe(0);
  });

  test('handles empty cache', () => {
    const cache = new Cache();
    expect(cache.compact()).toBe(0);
  });
});

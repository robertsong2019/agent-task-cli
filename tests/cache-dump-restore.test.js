const { Cache } = require('../src/utils/cache');

describe('Cache dump() and restore()', () => {
  it('dump returns all non-expired entries', () => {
    const cache = new Cache({ defaultTTL: null });
    cache.set('a', 1, null); // no expiry
    cache.set('b', 2, 3600000); // 1h TTL
    const dump = cache.dump();
    expect(dump).toHaveLength(2);
    const keys = dump.map(e => e.key).sort();
    expect(keys).toEqual(['a', 'b']);
    expect(dump.find(e => e.key === 'a').ttlRemaining).toBeNull();
    expect(dump.find(e => e.key === 'b').ttlRemaining).toBeGreaterThan(0);
    cache.destroy();
  });

  it('dump excludes expired entries', () => {
    const cache = new Cache();
    cache.set('old', 'val', 1); // expires immediately
    cache.set('fresh', 'val2', 3600000);
    // Force expire
    const entry = cache.cache.get('old');
    entry.expiresAt = Date.now() - 1;
    const dump = cache.dump();
    expect(dump).toHaveLength(1);
    expect(dump[0].key).toBe('fresh');
    cache.destroy();
  });

  it('restore loads entries into cache with remaining TTL', () => {
    const cache1 = new Cache();
    cache1.set('x', 42, 60000);
    const dump = cache1.dump();
    cache1.destroy();

    const cache2 = new Cache();
    cache2.restore(dump);
    expect(cache2.get('x')).toBe(42);
    cache2.destroy();
  });

  it('dump/restore roundtrip preserves values', () => {
    const cache1 = new Cache({ defaultTTL: null });
    cache1.mset({ foo: 'bar', baz: [1, 2, 3], num: 99 }, null);
    const dump = cache1.dump();
    cache1.destroy();

    const cache2 = new Cache();
    cache2.restore(dump);
    expect(cache2.get('foo')).toBe('bar');
    expect(cache2.get('baz')).toEqual([1, 2, 3]);
    expect(cache2.get('num')).toBe(99);
    cache2.destroy();
  });

  it('restore throws on non-array input', () => {
    const cache = new Cache();
    expect(() => cache.restore('bad')).toThrow('requires an array');
    cache.destroy();
  });
});

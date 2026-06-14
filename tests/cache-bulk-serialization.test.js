const { Cache } = require('../src/utils/cache');

describe('Cache bulk + serialization', () => {
  test('getMany returns multiple values as Map', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.set('c', 3, 0);

    const result = cache.getMany(['a', 'b', 'nonexistent']);
    expect(result instanceof Map).toBe(true);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.has('nonexistent')).toBe(false);
    expect(result.size).toBe(2);
  });

  test('getMany with empty array returns empty Map', () => {
    const cache = new Cache();
    const result = cache.getMany([]);
    expect(result.size).toBe(0);
  });

  test('keysByPrefix finds matching keys', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('user:1', 'Alice', 0);
    cache.set('user:2', 'Bob', 0);
    cache.set('post:1', 'Hello', 0);
    cache.set('user:3', 'Carol', 0);

    const userKeys = cache.keysByPrefix('user:');
    expect(userKeys).toHaveLength(3);
    expect(userKeys).toContain('user:1');
    expect(userKeys).toContain('user:2');
    expect(userKeys).toContain('user:3');
    expect(userKeys).not.toContain('post:1');
  });

  test('keysByPrefix returns empty for no match', () => {
    const cache = new Cache();
    cache.set('a', 1, 0);
    const result = cache.keysByPrefix('xyz:');
    expect(result).toHaveLength(0);
  });

  test('exportJSON produces valid JSON with metadata', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('key1', 'value1', 0);
    cache.set('key2', { nested: true }, 0);

    const json = cache.exportJSON();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBeGreaterThan(0);
    expect(parsed.entries).toHaveLength(2);

    const keys = parsed.entries.map(e => e.key);
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  test('exportJSON skips expired entries', () => {
    const cache = new Cache({ defaultTTL: 0 });
    cache.set('alive', 'yes', 0);
    cache.set('dead', 'no', 1); // 1ms TTL

    return new Promise(resolve => {
      setTimeout(() => {
        const json = cache.exportJSON();
        const parsed = JSON.parse(json);
        const keys = parsed.entries.map(e => e.key);
        expect(keys).toContain('alive');
        expect(keys).not.toContain('dead');
        cache.destroy();
        resolve();
      }, 10);
    });
  });

  test('importJSON restores entries (merge mode)', () => {
    const cache1 = new Cache({ defaultTTL: 0 });
    cache1.set('a', 1, 0);
    cache1.set('b', 2, 0);
    const json = cache1.exportJSON();
    cache1.destroy();

    const cache2 = new Cache({ defaultTTL: 0 });
    cache2.set('existing', 'data', 0);
    const count = cache2.importJSON(json);

    expect(count).toBe(2);
    expect(cache2.get('a')).toBe(1);
    expect(cache2.get('b')).toBe(2);
    expect(cache2.get('existing')).toBe('data'); // merge preserved existing
    cache2.destroy();
  });

  test('importJSON replaces all (non-merge mode)', () => {
    const cache1 = new Cache({ defaultTTL: 0 });
    cache1.set('new1', 'val1', 0);
    const json = cache1.exportJSON();
    cache1.destroy();

    const cache2 = new Cache({ defaultTTL: 0 });
    cache2.set('old1', 'oldval', 0);
    cache2.importJSON(json, { merge: false });

    expect(cache2.get('new1')).toBe('val1');
    expect(cache2.get('old1')).toBeUndefined();
    cache2.destroy();
  });

  test('importJSON throws on invalid JSON', () => {
    const cache = new Cache();
    expect(() => cache.importJSON('not json')).toThrow();
    expect(() => cache.importJSON('{}')).toThrow(/missing entries/);
    cache.destroy();
  });

  test('exportJSON → importJSON round-trip preserves data', () => {
    const cache1 = new Cache({ defaultTTL: 0 });
    cache1.set('str', 'hello', 0);
    cache1.set('num', 42, 0);
    cache1.set('obj', { a: 1, b: [2, 3] }, 0);
    cache1.set('arr', [1, 2, 3], 0);

    const json = cache1.exportJSON();
    cache1.destroy();

    const cache2 = new Cache({ defaultTTL: 0 });
    cache2.importJSON(json);
    expect(cache2.get('str')).toBe('hello');
    expect(cache2.get('num')).toBe(42);
    expect(cache2.get('obj')).toEqual({ a: 1, b: [2, 3] });
    expect(cache2.get('arr')).toEqual([1, 2, 3]);
    cache2.destroy();
  });

  test('importJSON skips entries that expired during transit', () => {
    const cache1 = new Cache({ defaultTTL: 0 });
    cache1.set('shortlived', 'temp', 1); // 1ms TTL
    return new Promise(resolve => {
      setTimeout(() => {
        // Export AFTER expiry - the entry should be skipped
        const json = cache1.exportJSON();
        const parsed = JSON.parse(json);
        const keys = parsed.entries.map(e => e.key);
        expect(keys).not.toContain('shortlived');
        cache1.destroy();
        resolve();
      }, 10);
    });
  });
});

const { Cache } = require('../src/utils/cache');

describe('F226: Cache.getOrThrow()', () => {
  test('returns value when key exists', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    cache.set('key1', 'value1');
    expect(cache.getOrThrow('key1')).toBe('value1');
  });

  test('throws when key is missing', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    expect(() => cache.getOrThrow('nonexistent')).toThrow('Cache key not found or expired: nonexistent');
  });

  test('throws when key has expired', async () => {
    const cache = new Cache({ defaultTTL: 50 });
    cache.set('temp', 'data');
    // Wait for expiry
    await new Promise(r => setTimeout(r, 80));
    expect(() => cache.getOrThrow('temp')).toThrow();
  });

  test('works with numeric values including 0', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    cache.set('zero', 0);
    expect(cache.getOrThrow('zero')).toBe(0);

    cache.set('count', 42);
    expect(cache.getOrThrow('count')).toBe(42);
  });

  test('works with falsy values (empty string, false)', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    cache.set('emptyStr', '');
    expect(cache.getOrThrow('emptyStr')).toBe('');

    cache.set('boolFalse', false);
    expect(cache.getOrThrow('boolFalse')).toBe(false);
  });

  test('works with object values', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    const obj = { nested: { deep: 'value' } };
    cache.set('obj', obj);
    expect(cache.getOrThrow('obj')).toEqual(obj);
  });

  test('error message includes the key name', () => {
    const cache = new Cache({ defaultTTL: 60000 });
    expect(() => cache.getOrThrow('mySpecialKey')).toThrow('mySpecialKey');
  });
});

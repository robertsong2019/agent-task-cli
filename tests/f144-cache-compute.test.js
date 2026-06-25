const { Cache } = require('../src/utils/cache');

describe('F144: Cache.compute()', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 0 });
  });

  afterEach(() => cache.destroy());

  test('transforms existing value', () => {
    cache.set('counter', 5, 0);
    cache.cache.get('counter').expiresAt = null;

    const result = cache.compute('counter', (v) => v + 1, 0);
    cache.cache.get('counter').expiresAt = null;

    expect(result).toBe(6);
    expect(cache.get('counter')).toBe(6);
  });

  test('works on missing key (receives undefined)', () => {
    const result = cache.compute('new', (v) => v ?? 'default', 0);
    cache.cache.get('new').expiresAt = null;

    expect(result).toBe('default');
    expect(cache.get('new')).toBe('default');
  });

  test('deletes key when computer returns undefined', () => {
    cache.set('gone', 'data', 0);
    cache.cache.get('gone').expiresAt = null;

    const result = cache.compute('gone', () => undefined);
    expect(result).toBeUndefined();
    expect(cache.has('gone')).toBe(false);
  });

  test('can transform objects immutably', () => {
    cache.set('obj', { count: 1, name: 'test' }, 0);
    cache.cache.get('obj').expiresAt = null;

    cache.compute('obj', (v) => ({ ...v, count: v.count + 1 }), 0);
    cache.cache.get('obj').expiresAt = null;

    expect(cache.get('obj')).toEqual({ count: 2, name: 'test' });
  });

  test('supports chaining', () => {
    cache.set('x', 10, 0);
    cache.cache.get('x').expiresAt = null;

    cache.compute('x', (v) => v * 2, 0);
    cache.cache.get('x').expiresAt = null;
    cache.compute('x', (v) => v + 3, 0);
    cache.cache.get('x').expiresAt = null;

    expect(cache.get('x')).toBe(23);
  });
});

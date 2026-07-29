const { Cache } = require('../../src/utils/cache');

describe('F212: Cache.mset(entries, ttl?)', () => {
  let cache;
  beforeEach(() => { cache = new Cache(); });
  afterEach(() => { cache.destroy(); });

  test('sets multiple key-value pairs', () => {
    const count = cache.mset([['a', 1], ['b', 2], ['c', 3]]);
    expect(count).toBe(3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  test('returns 0 for empty array', () => {
    expect(cache.mset([])).toBe(0);
  });

  test('returns 0 for non-array', () => {
    expect(cache.mset(null)).toBe(0);
    expect(cache.mset('not-array')).toBe(0);
  });

  test('applies TTL to all entries', (done) => {
    cache.mset([['x', 'val1'], ['y', 'val2']], 50);
    expect(cache.get('x')).toBe('val1');
    expect(cache.get('y')).toBe('val2');
    setTimeout(() => {
      expect(cache.get('x')).toBeUndefined();
      expect(cache.get('y')).toBeUndefined();
      done();
    }, 60);
  });

  test('skips null/undefined keys', () => {
    const count = cache.mset([['a', 1], [null, 'skip'], [undefined, 'skip']]);
    expect(count).toBe(1);
    expect(cache.get('a')).toBe(1);
  });

  test('overwrites existing values', () => {
    cache.set('a', 'old');
    cache.mset([['a', 'new'], ['b', 2]]);
    expect(cache.get('a')).toBe('new');
    expect(cache.get('b')).toBe(2);
  });

  test('handles single entry', () => {
    const count = cache.mset([['only', 42]]);
    expect(count).toBe(1);
    expect(cache.get('only')).toBe(42);
  });

  test('works without TTL (persistent)', () => {
    cache.mset([['k1', 'v1'], ['k2', 'v2']]);
    expect(cache.get('k1')).toBe('v1');
    expect(cache.get('k2')).toBe('v2');
  });
});

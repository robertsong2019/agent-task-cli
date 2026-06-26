const { Cache } = require('../src/utils/cache');

describe('F150: Cache.replace(key, value, ttl?)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 60000 }); });
  afterEach(() => { cache.destroy(); });

  test('returns old value and sets new value when key exists', () => {
    cache.set('a', 1);
    const old = cache.replace('a', 2);
    expect(old).toBe(1);
    expect(cache.get('a')).toBe(2);
  });

  test('returns undefined when key does not exist', () => {
    expect(cache.replace('missing', 'x')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  test('returns undefined for expired key (treats as non-existent)', () => {
    cache.set('exp', 'val', 50);
    return new Promise(r => setTimeout(r, 60))
      .then(() => {
        expect(cache.replace('exp', 'new')).toBeUndefined();
      });
  });

  test('sets with custom TTL', () => {
    cache.set('k', 'v');
    cache.replace('k', 'v2', 100);
    return new Promise(r => setTimeout(r, 120))
      .then(() => {
        expect(cache.has('k')).toBe(false);
      });
  });

  test('works with object values', () => {
    const obj = { x: 1 };
    cache.set('obj', obj);
    const old = cache.replace('obj', { x: 2 });
    expect(old).toEqual({ x: 1 });
    expect(cache.get('obj')).toEqual({ x: 2 });
  });

  test('does not affect stats misses (uses has, not get)', () => {
    const before = { ...cache.stats };
    cache.replace('nope', 'x');
    expect(cache.stats.misses).toBe(before.misses);
  });
});

describe('F151: Cache.retain(predicate)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 60000 }); });
  afterEach(() => { cache.destroy(); });

  test('keeps only entries matching predicate, returns removed count', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const removed = cache.retain((v) => v > 1);
    expect(removed).toBe(1);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  test('returns 0 when all entries match', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.retain(() => true)).toBe(0);
    expect(cache.size()).toBe(2);
  });

  test('removes all when none match', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.retain(() => false)).toBe(2);
    expect(cache.size()).toBe(0);
  });

  test('predicate receives (value, key)', () => {
    cache.set('keep', 'x');
    cache.set('drop', 'y');
    const removed = cache.retain((v, k) => k === 'keep');
    expect(removed).toBe(1);
    expect(cache.has('keep')).toBe(true);
    expect(cache.has('drop')).toBe(false);
  });

  test('empty cache returns 0', () => {
    expect(cache.retain(() => true)).toBe(0);
  });

  test('throws TypeError for non-function predicate', () => {
    expect(() => cache.retain(null)).toThrow(TypeError);
    expect(() => cache.retain('foo')).toThrow(TypeError);
  });

  test('expired entries are skipped (not counted as removed)', () => {
    cache.set('fresh', 1);
    cache.set('stale', 2, 30);
    return new Promise(r => setTimeout(r, 50))
      .then(() => {
        const removed = cache.retain(() => true);
        // 'stale' is expired but retain skips expired, doesn't count it
        expect(removed).toBe(0);
        expect(cache.has('fresh')).toBe(true);
      });
  });
});

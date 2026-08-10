const { Cache } = require('../src/utils/cache');

describe('F230: Cache.incrIfLess(key, max, delta=1)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('increments when current + delta ≤ max', () => {
    cache.set('counter', 5);
    expect(cache.incrIfLess('counter', 10)).toBe(true);
    expect(cache.get('counter')).toBe(6);
  });

  test('increments with custom delta', () => {
    cache.set('counter', 3);
    expect(cache.incrIfLess('counter', 10, 4)).toBe(true);
    expect(cache.get('counter')).toBe(7);
  });

  test('returns false when increment would exceed max', () => {
    cache.set('counter', 8);
    expect(cache.incrIfLess('counter', 10, 5)).toBe(false); // 8+5=13 > 10
    expect(cache.get('counter')).toBe(8); // unchanged
  });

  test('returns false when current equals max', () => {
    cache.set('counter', 10);
    expect(cache.incrIfLess('counter', 10)).toBe(false);
    expect(cache.get('counter')).toBe(10);
  });

  test('creates key with delta if it does not exist', () => {
    expect(cache.has('newkey')).toBe(false);
    expect(cache.incrIfLess('newkey', 5)).toBe(true);
    expect(cache.get('newkey')).toBe(1);
  });

  test('creates key with custom delta if not existing and delta ≤ max', () => {
    expect(cache.incrIfLess('newkey', 5, 3)).toBe(true);
    expect(cache.get('newkey')).toBe(3);
  });

  test('returns false for non-existent key when delta > max', () => {
    expect(cache.incrIfLess('newkey', 2, 5)).toBe(false);
    expect(cache.has('newkey')).toBe(false);
  });

  test('throws TypeError for non-numeric existing value', () => {
    cache.set('text', 'hello');
    expect(() => cache.incrIfLess('text', 10)).toThrow(TypeError);
  });

  test('handles negative delta (decrement)', () => {
    cache.set('counter', 5);
    expect(cache.incrIfLess('counter', 10, -2)).toBe(true);
    expect(cache.get('counter')).toBe(3);
  });

  test('boundary: delta that exactly reaches max', () => {
    cache.set('counter', 7);
    expect(cache.incrIfLess('counter', 10, 3)).toBe(true); // 7+3=10 ≤ 10
    expect(cache.get('counter')).toBe(10);
  });
});

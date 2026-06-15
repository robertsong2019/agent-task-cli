const { Cache } = require('../src/utils/cache');

describe('F137: Cache.incrTo(key, target, delta) — ceiling increment', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ ttl: 60 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('creates key at min(delta, target) when key does not exist', () => {
    const result = cache.incrTo('counter', 10, 3);
    expect(result).toBe(3);
    expect(cache.get('counter')).toBe(3);
  });

  test('creates key at target when delta exceeds target', () => {
    const result = cache.incrTo('counter', 5, 10);
    expect(result).toBe(5);
    expect(cache.get('counter')).toBe(5);
  });

  test('increments towards target', () => {
    cache.set('c', 3);
    expect(cache.incrTo('c', 10, 2)).toBe(5);
    expect(cache.get('c')).toBe(5);
  });

  test('stops at target ceiling — does not overshoot', () => {
    cache.set('c', 8);
    expect(cache.incrTo('c', 10, 5)).toBe(10);
    expect(cache.get('c')).toBe(10);
  });

  test('returns current value without change when already at target', () => {
    cache.set('c', 10);
    expect(cache.incrTo('c', 10, 1)).toBe(10);
  });

  test('returns current value without change when above target', () => {
    cache.set('c', 15);
    expect(cache.incrTo('c', 10, 1)).toBe(15);
  });

  test('throws TypeError for non-number target', () => {
    expect(() => cache.incrTo('c', '10')).toThrow(TypeError);
  });

  test('throws RangeError for zero or negative delta', () => {
    expect(() => cache.incrTo('c', 10, 0)).toThrow(RangeError);
    expect(() => cache.incrTo('c', 10, -1)).toThrow(RangeError);
  });

  test('throws TypeError when existing value is not a number', () => {
    cache.set('c', 'string');
    expect(() => cache.incrTo('c', 10, 1)).toThrow(TypeError);
  });

  test('works with delta of 1 (default)', () => {
    cache.set('c', 4);
    expect(cache.incrTo('c', 10)).toBe(5);
    expect(cache.incrTo('c', 10)).toBe(6);
  });
});

const { Cache } = require('../src/utils/cache');

describe('F233: Cache.decrIfGreater(key, min, delta=1)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('decrements when current - delta ≥ min', () => {
    cache.set('counter', 5);
    expect(cache.decrIfGreater('counter', 0)).toBe(true);
    expect(cache.get('counter')).toBe(4);
  });

  test('decrements with custom delta', () => {
    cache.set('counter', 10);
    expect(cache.decrIfGreater('counter', 0, 4)).toBe(true);
    expect(cache.get('counter')).toBe(6);
  });

  test('returns false when decrement would go below min', () => {
    cache.set('counter', 3);
    expect(cache.decrIfGreater('counter', 0, 5)).toBe(false); // 3-5=-2 < 0
    expect(cache.get('counter')).toBe(3); // unchanged
  });

  test('returns false when current equals min', () => {
    cache.set('counter', 0);
    expect(cache.decrIfGreater('counter', 0)).toBe(false); // 0-1=-1 < 0
    expect(cache.get('counter')).toBe(0);
  });

  test('creates key with 0 if it does not exist (treats missing as 0)', () => {
    expect(cache.has('newkey')).toBe(false);
    // missing key → current=0, 0-1=-1 which is < min=0 → false
    expect(cache.decrIfGreater('newkey', 0)).toBe(false);
  });

  test('creates key with negative delta if missing and result ≥ min', () => {
    // missing key → current=0, 0+(-1)=-1... wait, delta default is 1, so 0-1=-1
    // For this to work, we need min ≤ -1
    expect(cache.decrIfGreater('newkey', -5)).toBe(true); // 0-1=-1 ≥ -5
    expect(cache.get('newkey')).toBe(-1);
  });

  test('throws TypeError for non-numeric existing value', () => {
    cache.set('text', 'hello');
    expect(() => cache.decrIfGreater('text', 0)).toThrow(TypeError);
  });

  test('boundary: delta that exactly reaches min', () => {
    cache.set('counter', 5);
    expect(cache.decrIfGreater('counter', 0, 5)).toBe(true); // 5-5=0 ≥ 0
    expect(cache.get('counter')).toBe(0);
  });

  test('rate limiter pattern: allow N decrements then block', () => {
    // Simulate a token bucket with 3 tokens
    cache.set('tokens', 3);
    expect(cache.decrIfGreater('tokens', 0)).toBe(true);  // 3→2
    expect(cache.decrIfGreater('tokens', 0)).toBe(true);  // 2→1
    expect(cache.decrIfGreater('tokens', 0)).toBe(true);  // 1→0
    expect(cache.decrIfGreater('tokens', 0)).toBe(false); // 0-1 < 0, blocked
    expect(cache.get('tokens')).toBe(0);
  });

  test('negative min allows going below zero', () => {
    cache.set('counter', -5);
    expect(cache.decrIfGreater('counter', -10, 3)).toBe(true); // -5-3=-8 ≥ -10
    expect(cache.get('counter')).toBe(-8);
  });
});

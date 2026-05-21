const { Cache } = require('../src/utils/cache');

describe('F73: Cache.incr(key, delta?)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 50 }); });
  afterEach(() => { cache.destroy(); });

  test('increments from undefined to delta (default 1)', () => {
    const result = cache.incr('counter');
    expect(result).toBe(1);
    expect(cache.get('counter')).toBe(1);
  });

  test('increments from undefined with custom delta', () => {
    expect(cache.incr('score', 10)).toBe(10);
    expect(cache.get('score')).toBe(10);
  });

  test('increments existing numeric value', () => {
    cache.set('hits', 5);
    expect(cache.incr('hits')).toBe(6);
    expect(cache.incr('hits', 3)).toBe(9);
  });

  test('throws TypeError for non-number value', () => {
    cache.set('name', 'alice');
    expect(() => cache.incr('name')).toThrow(TypeError);
  });

  test('supports negative delta (decrement)', () => {
    cache.set('lives', 3);
    expect(cache.incr('lives', -1)).toBe(2);
  });

  test('works with float delta', () => {
    cache.set('ratio', 1.5);
    expect(cache.incr('ratio', 0.5)).toBeCloseTo(2.0);
  });
});

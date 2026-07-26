const { Cache } = require('../../src/utils/cache');

describe('Cache F204: incrByEx(key, amount, ttl)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 5000 });
  });

  afterEach(() => cache.destroy());

  test('increments non-existent key, initializes to amount', () => {
    const result = cache.incrByEx('counter', 5, 3000);
    expect(result).toBe(5);
    expect(cache.get('counter')).toBe(5);
  });

  test('increments existing numeric value', () => {
    cache.set('views', 100);
    const result = cache.incrByEx('views', 10, 3000);
    expect(result).toBe(110);
    expect(cache.get('views')).toBe(110);
  });

  test('sets new TTL on the key after increment', () => {
    cache.set('rate', 1, 100); // 100ms TTL
    cache.incrByEx('rate', 1, 50000); // extend to 50s
    // Key should still be alive well past original 100ms TTL
    // We can't test real time easily, but we can check the entry's expiresAt
    const entry = cache.cache.get('rate');
    expect(entry).toBeTruthy();
    expect(entry.expiresAt).toBeGreaterThan(Date.now() + 1000);
  });

  test('default amount is 1', () => {
    const result = cache.incrByEx('hits', undefined, 3000);
    expect(result).toBe(1);
  });

  test('throws TypeError if amount is not a number', () => {
    expect(() => cache.incrByEx('k', 'abc', 3000)).toThrow(TypeError);
  });

  test('throws TypeError if ttl is not positive', () => {
    expect(() => cache.incrByEx('k', 1, 0)).toThrow(TypeError);
    expect(() => cache.incrByEx('k', 1, -1)).toThrow(TypeError);
  });

  test('throws TypeError if existing value is not a number', () => {
    cache.set('text', 'hello');
    expect(() => cache.incrByEx('text', 1, 3000)).toThrow(TypeError);
  });

  test('works with negative amounts (decrement)', () => {
    cache.set('score', 50);
    const result = cache.incrByEx('score', -10, 3000);
    expect(result).toBe(40);
  });

  test('key expires after the new TTL', (done) => {
    cache.incrByEx('temp', 1, 100); // 100ms TTL
    expect(cache.get('temp')).toBe(1);
    setTimeout(() => {
      expect(cache.get('temp')).toBeUndefined();
      done();
    }, 150);
  });
});

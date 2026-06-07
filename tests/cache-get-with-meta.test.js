const { Cache } = require('../src/utils/cache');

describe('Cache.getWithMeta (F112)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 5000, maxSize: 100 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('returns null for missing key', () => {
    expect(cache.getWithMeta('nope')).toBeNull();
  });

  test('returns null for expired key', () => {
    cache.set('old', 'value', 50);
    return new Promise(resolve => {
      setTimeout(() => {
        expect(cache.getWithMeta('old')).toBeNull();
        resolve();
      }, 80);
    });
  });

  test('returns value and metadata for existing key', () => {
    cache.set('key1', { name: 'test' });
    const meta = cache.getWithMeta('key1');
    expect(meta).not.toBeNull();
    expect(meta.value).toEqual({ name: 'test' });
    expect(meta.createdAt).toBeGreaterThan(0);
    expect(meta.expiresAt).toBeGreaterThan(0);
    expect(meta.ttlRemaining).toBeGreaterThan(0);
  });

  test('returns null ttlRemaining for non-expiring key', () => {
    cache.set('forever', 42, 0); // TTL=0 means no expiry
    const meta = cache.getWithMeta('forever');
    expect(meta).not.toBeNull();
    expect(meta.value).toBe(42);
    expect(meta.expiresAt).toBeNull();
    expect(meta.ttlRemaining).toBeNull();
  });

  test('ttlRemaining decreases over time', () => {
    cache.set('decaying', 'val', 500);
    const meta1 = cache.getWithMeta('decaying');
    expect(meta1.ttlRemaining).toBeGreaterThan(400);
    return new Promise(resolve => {
      setTimeout(() => {
        const meta2 = cache.getWithMeta('decaying');
        expect(meta2.ttlRemaining).toBeLessThan(meta1.ttlRemaining);
        resolve();
      }, 150);
    });
  });

  test('reflects accessedAt update after gets', () => {
    cache.set('counted', 'x');
    const meta1 = cache.getWithMeta('counted');
    expect(meta1.value).toBe('x');
    expect(meta1.accessedAt).toBeGreaterThan(0);
    // wait a bit and access again
    return new Promise(resolve => {
      setTimeout(() => {
        cache.get('counted');
        const meta2 = cache.getWithMeta('counted');
        expect(meta2.accessedAt).toBeGreaterThanOrEqual(meta1.accessedAt);
        resolve();
      }, 10);
    });
  });

  test('works with various value types', () => {
    cache.set('str', 'hello');
    cache.set('num', 123);
    cache.set('arr', [1, 2]);
    cache.set('bool', true);

    expect(cache.getWithMeta('str').value).toBe('hello');
    expect(cache.getWithMeta('num').value).toBe(123);
    expect(cache.getWithMeta('arr').value).toEqual([1, 2]);
    expect(cache.getWithMeta('bool').value).toBe(true);
  });
});

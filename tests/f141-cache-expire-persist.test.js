const { Cache } = require('../src/utils/cache');

describe('F141: Cache.expire() / persist() / getSet()', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 0 }); // no auto-TTL
  });

  afterEach(() => cache.destroy());

  describe('expire(key, ttl)', () => {
    test('sets TTL on an existing non-expiring key', async () => {
      cache.set('k1', 'v1', 0); // 0 means no expiry in this impl? check
      // Actually set with ttl=0 uses defaultTTL which we set to 0, meaning no expiry
      // Let's use explicit approach
      cache.cache.set('k1', { value: 'v1', expiresAt: null, lastAccessed: Date.now() });

      const result = cache.expire('k1', 100);
      expect(result).toBe(true);

      const entry = cache.cache.get('k1');
      expect(entry.expiresAt).not.toBeNull();
      expect(entry.expiresAt).toBeGreaterThan(Date.now());
    });

    test('updates TTL on a key that already has TTL', () => {
      cache.set('k2', 'v2', 5000);
      cache.expire('k2', 10000);

      const entry = cache.cache.get('k2');
      expect(entry.expiresAt).toBeGreaterThan(Date.now() + 5000);
    });

    test('returns false for non-existent key', () => {
      expect(cache.expire('nope', 1000)).toBe(false);
    });

    test('ttl=0 effectively deletes the key', () => {
      cache.set('k3', 'v3', 0);
      // Manually set no-expiry
      cache.cache.get('k3').expiresAt = null;

      cache.expire('k3', 0);
      expect(cache.has('k3')).toBe(false);
    });
  });

  describe('persist(key)', () => {
    test('removes TTL making the key non-expiring', () => {
      cache.set('p1', 'val', 5000);
      expect(cache.cache.get('p1').expiresAt).not.toBeNull();

      const result = cache.persist('p1');
      expect(result).toBe(true);
      expect(cache.cache.get('p1').expiresAt).toBeNull();
    });

    test('returns false for non-existent key', () => {
      expect(cache.persist('nope')).toBe(false);
    });

    test('persisted key survives longer than original TTL', async () => {
      cache.set('p2', 'val', 50); // 50ms TTL
      cache.persist('p2');

      await new Promise(r => setTimeout(r, 80));
      expect(cache.has('p2')).toBe(true);
    });
  });

  describe('swap(key, value, ttl)', () => {
    test('returns old value and sets new one', () => {
      cache.set('g1', 'old', 0);
      cache.cache.get('g1').expiresAt = null;

      const old = cache.swap('g1', 'new', 0);
      cache.cache.get('g1').expiresAt = null;

      expect(old).toBe('old');
      expect(cache.get('g1')).toBe('new');
    });

    test('returns undefined for non-existent key', () => {
      const old = cache.swap('g2', 'first', 0);
      expect(old).toBeUndefined();
      expect(cache.get('g2')).toBe('first');
    });

    test('works with TTL', async () => {
      cache.set('g3', 'old', 0);
      cache.swap('g3', 'new', 50);

      expect(cache.get('g3')).toBe('new');
      await new Promise(r => setTimeout(r, 80));
      expect(cache.has('g3')).toBe(false);
    });
  });
});

const { Cache } = require('../src/utils/cache');

// Round 76 — F274-F279: Redis hash-family parity continuation of the
// F265/F267/F269/F272 string-family lineage. Copy-on-write, TTL-preserving,
// WRONGTYPE = TypeError (same convention as strlen/append/setrange).
describe('Round 76: Cache hash family (F274 hset / F275 hget / F276 hgetall / F277 hdel / F278 hexists / F279 hlen)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F274: hset(key, field, value, ttl?)', () => {
    test('missing key → creates hash, returns 1 (new field)', () => {
      expect(cache.hset('h', 'name', 'alice')).toBe(1);
      expect(cache.get('h')).toEqual({ name: 'alice' });
    });

    test('new field on existing hash → 1; overwrite → 0', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hset('h', 'b', 2)).toBe(1);
      expect(cache.hset('h', 'a', 99)).toBe(0);
      expect(cache.get('h')).toEqual({ a: 99, b: 2 });
    });

    test('hset preserves TTL of an existing hash', () => {
      cache.set('h', { a: 1 }, 5000);
      const before = cache.ttl('h');
      expect(before).toBeGreaterThan(0);
      cache.hset('h', 'b', 2);
      expect(cache.ttl('h')).toBeGreaterThan(0);
      expect(cache.ttl('h')).toBeLessThanOrEqual(before + 50);
    });

    test('expired hash is purged → hset creates a fresh hash', () => {
      cache.set('h', { old: 1 }, 1);
      return new Promise((r) => setTimeout(r, 15)).then(() => {
        expect(cache.has('h')).toBe(false);
        expect(cache.hset('h', 'a', 2)).toBe(1);
        expect(cache.get('h')).toEqual({ a: 2 });
      });
    });

    test('ttl param applies only on creation; default TTL used when omitted', () => {
      cache.hset('h', 'a', 1, 4000);
      expect(cache.ttl('h')).toBeGreaterThan(0);
      const c2 = new Cache({ defaultTTL: 60000 });
      c2.hset('k', 'f', 1);
      expect(c2.ttl('k')).toBeGreaterThan(0);
      c2.destroy();
    });

    test('non-string field → TypeError', () => {
      expect(() => cache.hset('h', 42, 'v')).toThrow(TypeError);
    });

    test('value at key is not a hash (string) → TypeError (WRONGTYPE)', () => {
      cache.set('s', 'plain string');
      expect(() => cache.hset('s', 'f', 1)).toThrow(TypeError);
    });

    test('array value is not a hash → TypeError', () => {
      cache.set('arr', [1, 2]);
      expect(() => cache.hset('arr', 'f', 1)).toThrow(TypeError);
    });
  });

  describe('F275: hget(key, field)', () => {
    test('returns field value; missing key/field → undefined', () => {
      cache.hset('h', 'name', 'bob');
      expect(cache.hget('h', 'name')).toBe('bob');
      expect(cache.hget('h', 'nope')).toBeUndefined();
      expect(cache.hget('ghost', 'name')).toBeUndefined();
    });

    test('non-hash value → TypeError', () => {
      cache.set('s', 123);
      expect(() => cache.hget('s', 'f')).toThrow(TypeError);
    });

    test('plain object set via set() is a valid hash', () => {
      cache.set('o', { x: 1, y: 2 });
      expect(cache.hget('o', 'x')).toBe(1);
    });
  });

  describe('F276: hgetall(key)', () => {
    test('missing key → {} (Redis empty-list parity)', () => {
      expect(cache.hgetall('ghost')).toEqual({});
    });

    test('returns all fields; result is a copy (mutation-safe)', () => {
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 2);
      const all = cache.hgetall('h');
      expect(all).toEqual({ a: 1, b: 2 });
      all.c = 3;
      delete all.a;
      expect(cache.hgetall('h')).toEqual({ a: 1, b: 2 });
    });

    test('non-hash → TypeError', () => {
      cache.set('s', 'x');
      expect(() => cache.hgetall('s')).toThrow(TypeError);
    });
  });

  describe('F277: hdel(key, ...fields)', () => {
    test('removes fields, returns count actually removed', () => {
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 2);
      cache.hset('h', 'c', 3);
      expect(cache.hdel('h', 'a', 'c')).toBe(2);
      expect(cache.hgetall('h')).toEqual({ b: 2 });
    });

    test('duplicate field names counted once (Redis parity)', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hdel('h', 'a', 'a')).toBe(1);
    });

    test('missing fields contribute 0; missing key → 0', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hdel('h', 'ghost')).toBe(0);
      expect(cache.hdel('nokey', 'a')).toBe(0);
    });

    test('empty hash after delete → key removed entirely (Redis parity)', () => {
      cache.set('h', { only: 1 }, 5000);
      expect(cache.hdel('h', 'only')).toBe(1);
      expect(cache.has('h')).toBe(false);
    });

    test('no-op delete (0 removed) keeps the key and its TTL', () => {
      cache.set('h', { a: 1 }, 5000);
      expect(cache.hdel('h', 'ghost')).toBe(0);
      expect(cache.has('h')).toBe(true);
      expect(cache.ttl('h')).toBeGreaterThan(0);
    });

    test('hdel preserves TTL on partial delete', () => {
      cache.set('h', { a: 1, b: 2 }, 5000);
      cache.hdel('h', 'a');
      expect(cache.ttl('h')).toBeGreaterThan(0);
    });

    test('non-hash → TypeError; non-string field → TypeError', () => {
      cache.set('s', 'x');
      expect(() => cache.hdel('s', 'f')).toThrow(TypeError);
      expect(() => cache.hdel('h', 7)).toThrow(TypeError);
    });
  });

  describe('F278: hexists(key, field)', () => {
    test('true for present field; false for missing field/key', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hexists('h', 'a')).toBe(true);
      expect(cache.hexists('h', 'ghost')).toBe(false);
      expect(cache.hexists('ghost', 'a')).toBe(false);
    });

    test('non-hash → TypeError', () => {
      cache.set('s', {});
      cache.set('n', 5);
      expect(() => cache.hexists('n', 'f')).toThrow(TypeError);
    });
  });

  describe('F279: hlen(key)', () => {
    test('field count; missing key → 0', () => {
      expect(cache.hlen('ghost')).toBe(0);
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 2);
      expect(cache.hlen('h')).toBe(2);
      cache.hdel('h', 'a');
      expect(cache.hlen('h')).toBe(1);
    });

    test('non-hash → TypeError', () => {
      cache.set('s', 'str');
      expect(() => cache.hlen('s')).toThrow(TypeError);
    });
  });

  describe('cross-feature invariants', () => {
    test('h* works through dump/restore round-trip (hashes are plain values)', () => {
      cache.hset('h', 'a', 1);
      const json = cache.exportJSON();
      const c2 = new Cache({ defaultTTL: 0 });
      c2.importJSON(json);
      expect(c2.hgetall('h')).toEqual({ a: 1 });
      c2.destroy();
    });

    test('watchers fire on hash creation and mutation', () => {
      const events = [];
      cache.watch('h', (payload) => events.push(payload.event));
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 2);
      expect(events.filter((e) => e === 'set').length).toBe(2);
    });
  });
});

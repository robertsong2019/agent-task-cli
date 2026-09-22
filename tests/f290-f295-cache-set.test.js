const { Cache } = require('../src/utils/cache');

// Round 79 — F290-F295: Redis set family, first half (sadd/srem/smembers/
// sismember/scard/smove). Sets are stored as JS Set instances of string
// members, giving clean type separation from the hash family (plain objects).
describe('Round 79: Cache set first half (F290 sadd / F291 srem / F292 smembers / F293 sismember / F294 scard / F295 smove)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F290: sadd(key, member, ttl?)', () => {
    test('new member on missing key → creates set, returns 1', () => {
      expect(cache.sadd('s', 'a')).toBe(1);
      expect(cache.smembers('s')).toEqual(['a']);
    });

    test('duplicate member → returns 0, set unchanged', () => {
      cache.sadd('s', 'a');
      expect(cache.sadd('s', 'a')).toBe(0);
      expect(cache.scard('s')).toBe(1);
    });

    test('distinct members accumulate; insertion order preserved', () => {
      cache.sadd('s', 'b');
      cache.sadd('s', 'a');
      cache.sadd('s', 'c');
      expect(cache.smembers('s')).toEqual(['b', 'a', 'c']);
    });

    test('existing set keeps its TTL (Redis SADD never touches TTL)', () => {
      cache.sadd('s', 'a', 1000);
      const before = cache.getTTL('s');
      cache.sadd('s', 'b');
      expect(cache.getTTL('s')).toBeLessThanOrEqual(before);
      expect(cache.sismember('s', 'b')).toBe(true);
    });

    test('copy-on-write: previously returned smembers array is not the store', () => {
      cache.sadd('s', 'a');
      const before = cache.smembers('s');
      cache.sadd('s', 'b');
      expect(before).toEqual(['a']); // stale snapshot unaffected
      expect(cache.smembers('s')).toEqual(['a', 'b']);
    });

    test('non-string member → TypeError', () => {
      expect(() => cache.sadd('s', 42)).toThrow(TypeError);
      expect(() => cache.sadd('s', null)).toThrow(TypeError);
    });

    test('non-set value at key → TypeError (WRONGTYPE analog)', () => {
      cache.set('plain', 'string');
      expect(() => cache.sadd('plain', 'a')).toThrow(TypeError);
      cache.hset('h', 'f', 'v');
      expect(() => cache.sadd('h', 'a')).toThrow(TypeError);
    });
  });

  describe('F291: srem(key, ...members)', () => {
    test('removes members present; duplicates in args count once', () => {
      cache.sadd('s', 'a');
      cache.sadd('s', 'b');
      expect(cache.srem('s', 'a', 'a', 'nope')).toBe(1);
      expect(cache.smembers('s')).toEqual(['b']);
    });

    test('empty set after srem → key deleted entirely (Redis parity)', () => {
      cache.sadd('s', 'a');
      cache.srem('s', 'a');
      expect(cache.has('s')).toBe(false);
      expect(cache.smembers('s')).toEqual([]);
    });

    test('no-op srem (0 removed) leaves key and TTL untouched', () => {
      cache.sadd('s', 'a', 1000);
      const ttl = cache.getTTL('s');
      expect(cache.srem('s', 'nope')).toBe(0);
      expect(cache.getTTL('s')).toBe(ttl);
    });

    test('partial removal preserves TTL', () => {
      cache.sadd('s', 'a', 5000);
      cache.sadd('s', 'b');
      cache.srem('s', 'a');
      expect(cache.getTTL('s')).toBeGreaterThan(0);
      expect(cache.smembers('s')).toEqual(['b']);
    });

    test('missing key → 0; non-string member → TypeError', () => {
      expect(cache.srem('missing', 'a')).toBe(0);
      cache.sadd('s', 'a');
      expect(() => cache.srem('s', 42)).toThrow(TypeError);
    });
  });

  describe('F292: smembers(key)', () => {
    test('missing key → [] (Redis empty-array parity)', () => {
      expect(cache.smembers('missing')).toEqual([]);
    });

    test('returns a fresh copy — mutation-safe', () => {
      cache.sadd('s', 'a');
      const out = cache.smembers('s');
      out.push('b');
      expect(cache.smembers('s')).toEqual(['a']);
    });

    test('non-set value at key → TypeError', () => {
      cache.set('str', 'x');
      expect(() => cache.smembers('str')).toThrow(TypeError);
    });
  });

  describe('F293: sismember(key, member)', () => {
    test('member present → true; absent/missing key → false', () => {
      cache.sadd('s', 'a');
      expect(cache.sismember('s', 'a')).toBe(true);
      expect(cache.sismember('s', 'z')).toBe(false);
      expect(cache.sismember('missing', 'a')).toBe(false);
    });

    test('non-string member → false (can never be a member)', () => {
      cache.sadd('s', 'a');
      expect(cache.sismember('s', 42)).toBe(false);
    });

    test('metadata-neutral read: no stats bump', () => {
      cache.sadd('s', 'a');
      const before = cache.getStats();
      cache.sismember('s', 'a');
      expect(cache.getStats()).toEqual(before);
    });
  });

  describe('F294: scard(key)', () => {
    test('counts members; missing key → 0', () => {
      expect(cache.scard('missing')).toBe(0);
      cache.sadd('s', 'a');
      cache.sadd('s', 'b');
      expect(cache.scard('s')).toBe(2);
    });

    test('non-set value at key → TypeError', () => {
      cache.set('n', 5);
      expect(() => cache.scard('n')).toThrow(TypeError);
    });
  });

  describe('F295: smove(source, destination, member)', () => {
    test('moves member across keys → 1; member lands in destination', () => {
      cache.sadd('src', 'a');
      cache.sadd('src', 'b');
      cache.sadd('dst', 'x');
      expect(cache.smove('src', 'dst', 'a')).toBe(1);
      expect(cache.smembers('src')).toEqual(['b']);
      expect(cache.smembers('dst')).toEqual(['x', 'a']);
    });

    test('source emptied → source key deleted (Redis parity)', () => {
      cache.sadd('src', 'a');
      cache.sadd('dst', 'x');
      cache.smove('src', 'dst', 'a');
      expect(cache.has('src')).toBe(false);
    });

    test('missing destination → created (no TTL under defaultTTL 0; defaultTTL when set)', () => {
      cache.sadd('src', 'a', 100000);
      expect(cache.smove('src', 'dst', 'a')).toBe(1);
      expect(cache.smembers('dst')).toEqual(['a']);
      expect(cache.getTTL('dst')).toBe(-1); // created with defaultTTL=0 → no expiry
      const timed = new Cache({ maxSize: 10, defaultTTL: 60000 });
      try {
        timed.sadd('s', 'm');
        timed.smove('s', 'd', 'm');
        expect(timed.getTTL('d')).toBeGreaterThan(0);
      } finally {
        timed.destroy();
      }
    });

    test('member not in source (or source missing) → 0, destination untouched', () => {
      cache.sadd('src', 'b');
      cache.sadd('dst', 'x');
      expect(cache.smove('src', 'dst', 'nope')).toBe(0);
      expect(cache.smove('missing', 'dst', 'a')).toBe(0);
      expect(cache.smembers('dst')).toEqual(['x']);
      expect(cache.has('missing')).toBe(false); // never created
    });

    test('source === destination with member present → 1, member stays', () => {
      cache.sadd('s', 'a');
      cache.sadd('s', 'b');
      expect(cache.smove('s', 's', 'a')).toBe(1);
      expect(cache.smembers('s')).toEqual(['a', 'b']);
    });

    test('non-set value at either key → TypeError; non-string member → TypeError', () => {
      cache.set('str', 'x');
      cache.sadd('s', 'a');
      expect(() => cache.smove('str', 's', 'a')).toThrow(TypeError);
      expect(() => cache.smove('s', 'str', 'a')).toThrow(TypeError);
      expect(() => cache.smove('s', 's', 42)).toThrow(TypeError);
    });
  });

  describe('hash/set type separation (WRONGTYPE both directions)', () => {
    test('h* ops on a set key → TypeError', () => {
      cache.sadd('s', 'a');
      expect(() => cache.hget('s', 'a')).toThrow(TypeError);
      expect(() => cache.hgetall('s')).toThrow(TypeError);
      expect(() => cache.hset('s', 'f', 'v')).toThrow(TypeError);
      expect(() => cache.hlen('s')).toThrow(TypeError);
    });
  });
});

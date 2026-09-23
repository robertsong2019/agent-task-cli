const { Cache } = require('../src/utils/cache');

// Round 80 — F296-F298: Redis set algebra (sinter/sunion/sdiff). Read-only
// multi-key operations over the Set family introduced in Round 79: missing
// keys read as empty sets (Redis parity), non-set values throw the
// WRONGTYPE-analog TypeError, and every result is a fresh array.

describe('Round 80: Cache set algebra (F296 sinter / F297 sunion / F298 sdiff)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  const load = (key, ...members) => {
    for (const m of members) cache.sadd(key, m);
  };

  describe('F296: sinter(...keys)', () => {
    test('intersection of two sets, first key insertion order preserved', () => {
      load('a', 'x', 'y', 'z');
      load('b', 'y', 'x', 'w');
      expect(cache.sinter('a', 'b')).toEqual(['x', 'y']);
    });

    test('intersection of three sets narrows correctly', () => {
      load('a', 'x', 'y', 'z');
      load('b', 'x', 'y');
      load('c', 'y', 'x', 'q');
      expect(cache.sinter('a', 'b', 'c')).toEqual(['x', 'y']);
    });

    test('missing key reads as empty set → intersection is []', () => {
      load('a', 'x', 'y');
      expect(cache.sinter('a', 'missing')).toEqual([]);
      expect(cache.sinter('missing', 'a')).toEqual([]);
    });

    test('all keys missing → []', () => {
      expect(cache.sinter('m1', 'm2')).toEqual([]);
    });

    test('single key → full members copy (mutation-safe)', () => {
      load('a', 'x', 'y');
      const snapshot = cache.sinter('a');
      expect(snapshot).toEqual(['x', 'y']);
      snapshot.push('injected');
      expect(cache.smembers('a')).toEqual(['x', 'y']);
    });

    test('duplicate key args → same as single-key intersection', () => {
      load('a', 'x', 'y');
      expect(cache.sinter('a', 'a')).toEqual(['x', 'y']);
    });

    test('expired key treated as missing → []', () => {
      jest.useFakeTimers();
      try {
        load('a', 'x');
        load('e', 'x', 'y');
        cache.expire('e', 1);
        jest.advanceTimersByTime(5);
        expect(cache.sinter('a', 'e')).toEqual([]);
        expect(cache.sunion('a', 'e')).toEqual(['x']); // expired contributes nothing
        expect(cache.sdiff('e', 'a')).toEqual([]); // first key expired → []
      } finally {
        jest.useRealTimers();
      }
    });

    test('non-set value at any key → TypeError (WRONGTYPE analog)', () => {
      cache.set('plain', 'string');
      load('a', 'x');
      expect(() => cache.sinter('a', 'plain')).toThrow(TypeError);
      expect(() => cache.sinter('plain', 'a')).toThrow(TypeError);
    });

    test('zero keys → TypeError (Redis arity error analog)', () => {
      expect(() => cache.sinter()).toThrow(TypeError);
    });
  });

  describe('F297: sunion(...keys)', () => {
    test('union of two sets, first-seen order', () => {
      load('a', 'x', 'y');
      load('b', 'y', 'z');
      expect(cache.sunion('a', 'b')).toEqual(['x', 'y', 'z']);
    });

    test('union of three sets dedupes across all', () => {
      load('a', 'x');
      load('b', 'x', 'y');
      load('c', 'y', 'z');
      expect(cache.sunion('a', 'b', 'c')).toEqual(['x', 'y', 'z']);
    });

    test('missing keys ignored', () => {
      load('a', 'x');
      expect(cache.sunion('a', 'missing')).toEqual(['x']);
    });

    test('all keys missing → []', () => {
      expect(cache.sunion('m1', 'm2')).toEqual([]);
    });

    test('single key → fresh copy (mutation-safe)', () => {
      load('a', 'x', 'y');
      const snapshot = cache.sunion('a');
      snapshot.pop();
      expect(cache.smembers('a')).toEqual(['x', 'y']);
    });

    test('duplicate key args → members once', () => {
      load('a', 'x', 'y');
      expect(cache.sunion('a', 'a')).toEqual(['x', 'y']);
    });

    test('non-set value at any key → TypeError', () => {
      cache.hset('h', 'f', 'v');
      load('a', 'x');
      expect(() => cache.sunion('a', 'h')).toThrow(TypeError);
    });

    test('zero keys → TypeError', () => {
      expect(() => cache.sunion()).toThrow(TypeError);
    });
  });

  describe('F298: sdiff(key, ...keys)', () => {
    test('first set minus the rest, insertion order of first preserved', () => {
      load('a', 'x', 'y', 'z');
      load('b', 'y');
      load('c', 'z');
      expect(cache.sdiff('a', 'b', 'c')).toEqual(['x']);
    });

    test('nothing removed → full members copy', () => {
      load('a', 'x', 'y');
      load('b', 'q');
      expect(cache.sdiff('a', 'b')).toEqual(['x', 'y']);
    });

    test('everything removed → [] (key itself untouched: read-only)', () => {
      load('a', 'x');
      load('b', 'x');
      expect(cache.sdiff('a', 'b')).toEqual([]);
      expect(cache.smembers('a')).toEqual(['x']); // not deleted, unlike srem
    });

    test('first key missing → [] (even if others exist)', () => {
      load('b', 'y');
      expect(cache.sdiff('missing', 'b')).toEqual([]);
    });

    test('missing subtrahend keys ignored', () => {
      load('a', 'x');
      expect(cache.sdiff('a', 'missing1', 'missing2')).toEqual(['x']);
    });

    test('sdiff(k, k) → [] (key subtracting itself)', () => {
      load('a', 'x', 'y');
      expect(cache.sdiff('a', 'a')).toEqual([]);
    });

    test('mutation-safe: result array is not the store', () => {
      load('a', 'x');
      const snapshot = cache.sdiff('a');
      snapshot.push('injected');
      expect(cache.smembers('a')).toEqual(['x']);
    });

    test('non-set value at any key → TypeError', () => {
      cache.set('plain', 'string');
      load('a', 'x');
      expect(() => cache.sdiff('a', 'plain')).toThrow(TypeError);
      expect(() => cache.sdiff('plain', 'a')).toThrow(TypeError);
    });

    test('zero keys → TypeError (first key mandatory)', () => {
      expect(() => cache.sdiff()).toThrow(TypeError);
    });
  });
});

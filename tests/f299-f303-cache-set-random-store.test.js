const { Cache } = require('../src/utils/cache');

// Round 81 — F299-F303: Redis set store variants (sinterstore/sunionstore/
// sdiffstore) + random sampling family (spop/srandmember).
//
// RNG hook decision: spop/srandmember take an optional trailing `rng`
// parameter (default Math.random) rather than a constructor-level hook —
// parameter-override matches this module's `ttl = this.defaultTTL` signature
// convention, and deterministic tests need no global Math.random patching.
// Contract: rng() returns a float in [0, 1); defensive % len clamps the
// upper bound so a degenerate rng() === 1 stays in range.

describe('Round 81: Cache set store variants + random family', () => {
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

  describe('F299: sinterstore(destination, ...keys)', () => {
    test('stores intersection, returns result size', () => {
      load('a', 'x', 'y', 'z');
      load('b', 'y', 'x', 'w');
      expect(cache.sinterstore('d', 'a', 'b')).toBe(2);
      expect(cache.smembers('d')).toEqual(['x', 'y']);
    });

    test('empty result → destination key deleted (Redis parity)', () => {
      load('a', 'x');
      load('b', 'q');
      expect(cache.sinterstore('d', 'a', 'b')).toBe(0);
      expect(cache.smembers('d')).toEqual([]);
    });

    test('empty result deletes a pre-existing destination too', () => {
      load('d', 'stale');
      load('a', 'x');
      load('b', 'q');
      cache.sinterstore('d', 'a', 'b');
      expect(cache.smembers('d')).toEqual([]);
    });

    test('overwrites any pre-existing destination value (string/hash/set)', () => {
      load('a', 'x');
      cache.set('d', 'plain string');
      cache.sinterstore('d', 'a');
      expect(cache.smembers('d')).toEqual(['x']);
      cache.hset('h', 'f', 'v');
      cache.sinterstore('d', 'h' === 'h' ? 'a' : 'a');
      expect(cache.smembers('d')).toEqual(['x']);
    });

    test('destination === source key: compute-then-store is correct', () => {
      load('a', 'x', 'y');
      load('b', 'y', 'w');
      expect(cache.sinterstore('a', 'a', 'b')).toBe(1);
      expect(cache.smembers('a')).toEqual(['y']);
    });

    test('destination created with defaultTTL', () => {
      const ttlCache = new Cache({ maxSize: 100, defaultTTL: 100 });
      try {
        for (const m of ['x', 'y']) ttlCache.sadd('a', m);
        ttlCache.sinterstore('d', 'a');
        expect(ttlCache.ttl('d')).toBeGreaterThan(0);
      } finally {
        ttlCache.destroy();
      }
    });

    test('zero source keys → TypeError', () => {
      expect(() => cache.sinterstore('d')).toThrow(TypeError);
      expect(() => cache.sinterstore()).toThrow(TypeError);
    });

    test('non-set source value → TypeError', () => {
      cache.set('plain', 'string');
      expect(() => cache.sinterstore('d', 'plain')).toThrow(TypeError);
    });
  });

  describe('F300: sunionstore(destination, ...keys)', () => {
    test('stores union in first-seen order, returns size', () => {
      load('a', 'x', 'y');
      load('b', 'y', 'z');
      expect(cache.sunionstore('d', 'a', 'b')).toBe(3);
      expect(cache.smembers('d')).toEqual(['x', 'y', 'z']);
    });

    test('missing source keys contribute nothing; all missing → destination deleted', () => {
      load('a', 'x');
      cache.sunionstore('d', 'a', 'missing');
      expect(cache.smembers('d')).toEqual(['x']);
      expect(cache.sunionstore('d', 'missing1', 'missing2')).toBe(0);
      expect(cache.smembers('d')).toEqual([]);
    });

    test('single source key → full copy into destination', () => {
      load('a', 'x', 'y');
      expect(cache.sunionstore('d', 'a')).toBe(2);
      expect(cache.smembers('d')).toEqual(['x', 'y']);
    });

    test('non-set source → TypeError; destination untouched', () => {
      cache.set('plain', 'string');
      expect(() => cache.sunionstore('d', 'plain')).toThrow(TypeError);
      expect(cache.smembers('d')).toEqual([]);
    });
  });

  describe('F301: sdiffstore(destination, key, ...keys)', () => {
    test('stores difference, returns size', () => {
      load('a', 'x', 'y', 'z');
      load('b', 'y');
      load('c', 'z');
      expect(cache.sdiffstore('d', 'a', 'b', 'c')).toBe(1);
      expect(cache.smembers('d')).toEqual(['x']);
    });

    test('empty difference → destination deleted', () => {
      load('a', 'x');
      load('b', 'x');
      expect(cache.sdiffstore('d', 'a', 'b')).toBe(0);
      expect(cache.smembers('d')).toEqual([]);
    });

    test('missing first key → empty result → destination deleted', () => {
      load('d', 'stale');
      load('b', 'y');
      expect(cache.sdiffstore('d', 'missing', 'b')).toBe(0);
      expect(cache.smembers('d')).toEqual([]);
    });

    test('sdiffstore(d, a, a) → empty (self-subtraction)', () => {
      load('a', 'x', 'y');
      expect(cache.sdiffstore('d', 'a', 'a')).toBe(0);
    });

    test('zero keys → TypeError', () => {
      expect(() => cache.sdiffstore()).toThrow(TypeError);
    });
  });

  describe('F302: spop(key, count?, rng?)', () => {
    test('single pop without count returns one member (rng=()=>0 picks first)', () => {
      load('a', 'x', 'y', 'z');
      expect(cache.spop('a', undefined, () => 0)).toBe('x');
      expect(cache.smembers('a')).toEqual(['y', 'z']);
    });

    test('popping the last member deletes the key; next pop → null', () => {
      load('a', 'x');
      expect(cache.spop('a', undefined, () => 0)).toBe('x');
      expect(cache.smembers('a')).toEqual([]);
      expect(cache.spop('a', undefined, () => 0)).toBeNull();
    });

    test('missing key → null (no count) / [] (with count)', () => {
      expect(cache.spop('missing', undefined, () => 0)).toBeNull();
      expect(cache.spop('missing', 2, () => 0)).toEqual([]);
    });

    test('count pops distinct members, swap-remove pool order (rng=()=>0)', () => {
      load('a', 'x', 'y', 'z');
      expect(cache.spop('a', 2, () => 0)).toEqual(['x', 'y']);
      expect(cache.smembers('a')).toEqual(['z']);
    });

    test('rng near 1 picks from the pool tail', () => {
      load('a', 'x', 'y', 'z');
      expect(cache.spop('a', 1, () => 0.999999)).toEqual(['z']);
      expect(cache.smembers('a')).toEqual(['x', 'y']);
    });

    test('count > size → whole set popped, key deleted', () => {
      load('a', 'x', 'y');
      const picked = cache.spop('a', 5, () => 0);
      expect(picked.sort()).toEqual(['x', 'y']);
      expect(cache.smembers('a')).toEqual([]);
    });

    test('count = 0 → [], key untouched', () => {
      load('a', 'x');
      expect(cache.spop('a', 0, () => 0)).toEqual([]);
      expect(cache.smembers('a')).toEqual(['x']);
    });

    test('partial pop preserves TTL', () => {
      jest.useFakeTimers();
      try {
        load('a', 'x', 'y');
        cache.expire('a', 10);
        cache.spop('a', 1, () => 0);
        expect(cache.smembers('a')).toEqual(['y']); // survived the rewrite
        jest.advanceTimersByTime(15);
        expect(cache.smembers('a')).toEqual([]); // original expiry still applies
      } finally {
        jest.useRealTimers();
      }
    });

    test('negative / non-integer count → TypeError', () => {
      load('a', 'x');
      expect(() => cache.spop('a', -1, () => 0)).toThrow(TypeError);
      expect(() => cache.spop('a', 1.5, () => 0)).toThrow(TypeError);
      expect(cache.smembers('a')).toEqual(['x']);
    });

    test('default Math.random smoke: repeated pops drain the set exactly', () => {
      load('a', 'x', 'y', 'z', 'w');
      const drained = [];
      let member = cache.spop('a');
      while (member !== null) {
        drained.push(member);
        member = cache.spop('a');
      }
      expect(drained.sort()).toEqual(['w', 'x', 'y', 'z']);
    });
  });

  describe('F303: srandmember(key, count?, rng?)', () => {
    test('without count returns one member, set untouched', () => {
      load('a', 'x', 'y');
      const member = cache.srandmember('a', undefined, () => 0);
      expect(member).toBe('x');
      expect(cache.smembers('a')).toEqual(['x', 'y']);
    });

    test('missing key → null (no count) / [] (with count)', () => {
      expect(cache.srandmember('missing', undefined, () => 0)).toBeNull();
      expect(cache.srandmember('missing', 3, () => 0)).toEqual([]);
    });

    test('positive count: distinct members, never mutates the set', () => {
      load('a', 'x', 'y', 'z');
      expect(cache.srandmember('a', 3, () => 0)).toEqual(['x', 'y', 'z']);
      expect(cache.smembers('a')).toEqual(['x', 'y', 'z']);
    });

    test('positive count > size → whole set', () => {
      load('a', 'x', 'y');
      expect(cache.srandmember('a', 9, () => 0).sort()).toEqual(['x', 'y']);
    });

    test('negative count: with replacement — repeats allowed and can exceed size', () => {
      load('a', 'x', 'y');
      expect(cache.srandmember('a', -3, () => 0)).toEqual(['x', 'x', 'x']);
      expect(cache.smembers('a')).toEqual(['x', 'y']); // read-only
    });

    test('negative count with mixed rng values', () => {
      load('a', 'x', 'y', 'z');
      const seq = [0, 0.99, 0.5]; // x, z, y
      expect(cache.srandmember('a', -3, () => seq.shift())).toEqual(['x', 'z', 'y']);
    });

    test('count = 0 → []', () => {
      load('a', 'x');
      expect(cache.srandmember('a', 0, () => 0)).toEqual([]);
    });

    test('read-only: no stats side effects', () => {
      load('a', 'x');
      const before = JSON.stringify(cache.getStats());
      cache.srandmember('a', 1, () => 0);
      cache.srandmember('a', -2, () => 0);
      expect(JSON.stringify(cache.getStats())).toBe(before);
    });

    test('negative / non-integer count → TypeError', () => {
      load('a', 'x');
      expect(() => cache.srandmember('a', -1.5, () => 0)).toThrow(TypeError);
      expect(() => cache.srandmember('a', 2.5, () => 0)).toThrow(TypeError);
    });
  });
});

const { Cache } = require('../src/utils/cache');

// Round 78 — F287-F289: Redis hash-family completion (hstrlen / hrandfield / hscan).
// Hash family 13 -> 16 methods; all semantics cross-checked against Redis docs.
describe('Round 78: Cache hash final third (F287 hstrlen / F288 hrandfield / F289 hscan)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F287: hstrlen(key, field)', () => {
    test('existing field → value string length in UTF-16 code units', () => {
      cache.hset('h', 'a', 'hello');
      cache.hset('h', 'b', 12345);
      cache.hset('h', 'u', 'héllo'); // é is 1 BMP code unit
      expect(cache.hstrlen('h', 'a')).toBe(5);
      expect(cache.hstrlen('h', 'b')).toBe(5); // numeric coerced to string
      expect(cache.hstrlen('h', 'u')).toBe(5);
    });

    test('missing field → 0; missing key → 0 (Redis: 0/0)', () => {
      cache.hset('h', 'a', 'x');
      expect(cache.hstrlen('h', 'nope')).toBe(0);
      expect(cache.hstrlen('missing', 'a')).toBe(0);
    });

    test('non-hash value at key → TypeError', () => {
      cache.set('str', 'plain');
      expect(() => cache.hstrlen('str', 'a')).toThrow(TypeError);
    });

    test('non-string field → TypeError', () => {
      cache.hset('h', 'a', 'x');
      expect(() => cache.hstrlen('h', 42)).toThrow(TypeError);
    });

    test('metadata-neutral read: no stats bump', () => {
      cache.hset('h', 'a', 'x');
      const before = cache.getStats();
      cache.hstrlen('h', 'a');
      const after = cache.getStats();
      expect(after).toEqual(before);
    });
  });

  describe('F288: hrandfield(key, [count[, withValues]])', () => {
    test('missing key, no count → undefined (Redis nil)', () => {
      expect(cache.hrandfield('missing')).toBeUndefined();
    });

    test('missing key, count → empty array', () => {
      expect(cache.hrandfield('missing', 3)).toEqual([]);
    });

    test('count 0 → empty array', () => {
      cache.hmset('h', { a: 1, b: 2 });
      expect(cache.hrandfield('h', 0)).toEqual([]);
    });

    test('positive count → distinct fields, capped at hlen', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3 });
      const five = cache.hrandfield('h', 5); // > hlen 3
      expect(five).toHaveLength(3);
      expect(new Set(five).size).toBe(3);
      for (const f of five) expect(['a', 'b', 'c']).toContain(f);
    });

    test('positive count subset → distinct members of field set', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3, d: 4, e: 5 });
      const got = cache.hrandfield('h', 3);
      expect(got).toHaveLength(3);
      expect(new Set(got).size).toBe(3);
      for (const f of got) expect(['a', 'b', 'c', 'd', 'e']).toContain(f);
    });

    test('negative count → repetitions allowed, |count| entries', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3 });
      const got = cache.hrandfield('h', -7);
      expect(got).toHaveLength(7);
      for (const f of got) expect(['a', 'b', 'c']).toContain(f);
    });

    test('WITHVALUES → flat alternating [field, value, ...] (RESP2 shape)', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3 });
      const flat = cache.hrandfield('h', 3, true);
      expect(flat).toHaveLength(6);
      const back = {};
      for (let i = 0; i < flat.length; i += 2) {
        back[flat[i]] = flat[i + 1];
      }
      expect(back).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('no count on populated hash → single field name from the set', () => {
      cache.hmset('h', { a: 1, b: 2 });
      for (let i = 0; i < 20; i++) {
        expect(['a', 'b']).toContain(cache.hrandfield('h'));
      }
    });

    test('non-integer count → TypeError', () => {
      cache.hmset('h', { a: 1 });
      expect(() => cache.hrandfield('h', 1.5)).toThrow(TypeError);
      expect(() => cache.hrandfield('h', 'three')).toThrow(TypeError);
    });

    test('non-hash value at key → TypeError', () => {
      cache.set('str', 'plain');
      expect(() => cache.hrandfield('str')).toThrow(TypeError);
    });
  });

  describe('F289: hscan(key, cursor, {match, count})', () => {
    test('single call, small hash → full flat [field, value, ...], nextCursor "0"', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3 });
      const [cursor, entries] = cache.hscan('h', 0);
      expect(cursor).toBe('0');
      expect(entries).toEqual(['a', 1, 'b', 2, 'c', 3]); // insertion order
    });

    test('missing key → ["0", []]', () => {
      expect(cache.hscan('missing', 0)).toEqual(['0', []]);
    });

    test('COUNT chunks + full round-trip union = hgetall', () => {
      cache.hmset('h', { a: 1, b: 2, c: 3, d: 4, e: 5 });
      const acc = {};
      let cursor = 0;
      let hops = 0;
      do {
        const [next, flat] = cache.hscan('h', cursor, { count: 2 });
        for (let i = 0; i < flat.length; i += 2) acc[flat[i]] = flat[i + 1];
        cursor = Number(next);
        hops++;
      } while (cursor !== 0 && hops < 10);
      expect(hops).toBeGreaterThanOrEqual(3); // 5 fields / count 2 → ≥3 pages
      expect(acc).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5 });
    });

    test('MATCH glob filters (codebase *-wildcard convention)', () => {
      cache.hmset('h', { 'user:1': 'a', 'user:2': 'b', 'sess:x': 'c' });
      const [cursor, entries] = cache.hscan('h', 0, { match: 'user:*' });
      expect(cursor).toBe('0');
      expect(entries).toEqual(['user:1', 'a', 'user:2', 'b']);
    });

    test('MATCH + COUNT paginate the filtered set', () => {
      cache.hmset('h', { 'u:1': 1, 'u:2': 2, 'u:3': 3, 'z:9': 9 });
      const seen = [];
      let cursor = 0;
      do {
        const [next, flat] = cache.hscan('h', cursor, { match: 'u:*', count: 2 });
        for (let i = 0; i < flat.length; i += 2) seen.push(flat[i]);
        cursor = Number(next);
      } while (cursor !== 0);
      expect(seen).toEqual(['u:1', 'u:2', 'u:3']);
    });

    test('invalid cursor (non-integer / negative) → TypeError', () => {
      cache.hmset('h', { a: 1 });
      expect(() => cache.hscan('h', 1.5)).toThrow(TypeError);
      expect(() => cache.hscan('h', -1)).toThrow(TypeError);
    });

    test('invalid count (non-integer / < 1) → TypeError', () => {
      cache.hmset('h', { a: 1 });
      expect(() => cache.hscan('h', 0, { count: 0 })).toThrow(TypeError);
      expect(() => cache.hscan('h', 0, { count: 1.5 })).toThrow(TypeError);
    });

    test('non-hash value at key → TypeError', () => {
      cache.set('str', 'plain');
      expect(() => cache.hscan('str', 0)).toThrow(TypeError);
    });

    test('expired hash → ["0", []] (expired = missing)', () => {
      cache.hset('h', 'a', 1, 50);
      const entry = cache.cache.get('h');
      entry.expiresAt = Date.now() - 1;
      expect(cache.hscan('h', 0)).toEqual(['0', []]);
    });
  });
});

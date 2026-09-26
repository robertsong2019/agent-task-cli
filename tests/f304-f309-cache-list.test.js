const { Cache } = require('../src/utils/cache');

// Round 82 — F304-F309: Redis list family first half
// (lpush/rpush/llen/lrange/lpop/rpop).
//
// Storage model: a list lives in the cache as a plain JS Array of strings;
// like Set-family keys, list keys are runtime-only values (not
// JSON-exportable via exportJSON/dump — arrays of strings would round-trip,
// but the family deliberately mirrors the set/hash runtime-only contract).
// Redis parity anchors: empty list == missing key (popping the last element
// deletes the key); lpush(rpush) prepends(appends) each value in argument
// order; existing lists keep their TTL on push (Redis never touches TTL on
// writes); lpop/rpop with count (Redis 6.2+) return arrays.

describe('Round 82: Cache Redis list family first half', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F304: lpush(key, ...values)', () => {
    test('prepends single value, returns new length', () => {
      expect(cache.lpush('k', 'a')).toBe(1);
      expect(cache.lpush('k', 'b')).toBe(2);
      expect(cache.lrange('k', 0, -1)).toEqual(['b', 'a']);
    });

    test('multiple values prepend in argument order (Redis: [c, b, a])', () => {
      expect(cache.lpush('k', 'a', 'b', 'c')).toBe(3);
      expect(cache.lrange('k', 0, -1)).toEqual(['c', 'b', 'a']);
    });

    test('no values → TypeError', () => {
      expect(() => cache.lpush('k')).toThrow(TypeError);
    });

    test('non-string value → TypeError, key untouched', () => {
      cache.lpush('k', 'a');
      expect(() => cache.lpush('k', 'b', 42)).toThrow(TypeError);
      expect(cache.lrange('k', 0, -1)).toEqual(['a']);
    });

    test('non-list value at key → TypeError', () => {
      cache.set('k', 'plain');
      expect(() => cache.lpush('k', 'a')).toThrow(/not a list/);
    });

    test('push preserves an existing list TTL', () => {
      const c2 = new Cache({ maxSize: 10, defaultTTL: 0 });
      c2.lpush('k', 'a');
      const entry = c2.cache.get('k');
      entry.expiresAt = Date.now() + 40;
      c2.lpush('k', 'b');
      expect(c2.cache.get('k').expiresAt).toBe(entry.expiresAt);
      c2.destroy();
    });

    test('lpush onto expired key creates a fresh list', () => {
      const c2 = new Cache({ maxSize: 10, defaultTTL: 30 });
      c2.lpush('k', 'a');
      const entry = c2.cache.get('k');
      entry.expiresAt = Date.now() - 1;
      expect(c2.lpush('k', 'b')).toBe(1);
      expect(c2.lrange('k', 0, -1)).toEqual(['b']);
      c2.destroy();
    });
  });

  describe('F305: rpush(key, ...values)', () => {
    test('appends values in argument order, returns new length', () => {
      expect(cache.rpush('k', 'a', 'b', 'c')).toBe(3);
      expect(cache.lrange('k', 0, -1)).toEqual(['a', 'b', 'c']);
      expect(cache.rpush('k', 'd')).toBe(4);
      expect(cache.lrange('k', 0, -1)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('no values → TypeError', () => {
      expect(() => cache.rpush('k')).toThrow(TypeError);
    });

    test('non-string value → TypeError', () => {
      expect(() => cache.rpush('k', 'ok', null)).toThrow(TypeError);
    });

    test('non-list value at key → TypeError', () => {
      cache.hset('k', 'f', 'v');
      expect(() => cache.rpush('k', 'a')).toThrow(/not a list/);
    });

    test('mixed lpush/rpush order composition', () => {
      cache.rpush('k', 'b', 'c');
      cache.lpush('k', 'a');
      cache.rpush('k', 'd');
      expect(cache.lrange('k', 0, -1)).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('F306: llen(key)', () => {
    test('length of an existing list', () => {
      cache.rpush('k', 'a', 'b', 'c');
      expect(cache.llen('k')).toBe(3);
    });

    test('missing key → 0', () => {
      expect(cache.llen('nope')).toBe(0);
    });

    test('non-list value at key → TypeError', () => {
      cache.set('k', 'plain');
      expect(() => cache.llen('k')).toThrow(/not a list/);
    });

    test('expired key → 0 (and purged)', () => {
      const c2 = new Cache({ maxSize: 10, defaultTTL: 20 });
      c2.rpush('k', 'a');
      c2.cache.get('k').expiresAt = Date.now() - 1;
      expect(c2.llen('k')).toBe(0);
      expect(c2.cache.has('k')).toBe(false);
      c2.destroy();
    });
  });

  describe('F307: lrange(key, start, stop)', () => {
    beforeEach(() => {
      cache.rpush('k', 'a', 'b', 'c', 'd', 'e');
    });

    test('full range with 0, -1', () => {
      expect(cache.lrange('k', 0, -1)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    test('subrange is inclusive of stop', () => {
      expect(cache.lrange('k', 1, 3)).toEqual(['b', 'c', 'd']);
    });

    test('negative indices count from the end', () => {
      expect(cache.lrange('k', -2, -1)).toEqual(['d', 'e']);
    });

    test('out-of-range bounds clamp (Redis: no error)', () => {
      expect(cache.lrange('k', 2, 99)).toEqual(['c', 'd', 'e']);
      expect(cache.lrange('k', -99, 1)).toEqual(['a', 'b']);
    });

    test('start beyond stop → []', () => {
      expect(cache.lrange('k', 3, 1)).toEqual([]);
      expect(cache.lrange('k', 99, 100)).toEqual([]);
    });

    test('missing key → []', () => {
      expect(cache.lrange('nope', 0, -1)).toEqual([]);
    });

    test('returns a fresh array (mutation-safe)', () => {
      const out = cache.lrange('k', 0, -1);
      out.push('x');
      expect(cache.llen('k')).toBe(5);
    });

    test('non-integer start or stop → TypeError', () => {
      expect(() => cache.lrange('k', 0.5, 2)).toThrow(TypeError);
      expect(() => cache.lrange('k', 0, 'x')).toThrow(TypeError);
    });

    test('non-list value at key → TypeError', () => {
      cache.set('s', 'plain');
      expect(() => cache.lrange('s', 0, -1)).toThrow(/not a list/);
    });
  });

  describe('F308: lpop(key, count?)', () => {
    beforeEach(() => {
      cache.rpush('k', 'a', 'b', 'c');
    });

    test('pops the head element, returns it', () => {
      expect(cache.lpop('k')).toBe('a');
      expect(cache.lrange('k', 0, -1)).toEqual(['b', 'c']);
    });

    test('missing key → null', () => {
      expect(cache.lpop('nope')).toBeNull();
    });

    test('popping the last element deletes the key (Redis parity)', () => {
      cache.lpop('k');
      cache.lpop('k');
      cache.lpop('k');
      expect(cache.cache.has('k')).toBe(false);
      expect(cache.lpop('k')).toBeNull();
    });

    test('with count: returns array of popped heads in order', () => {
      expect(cache.lpop('k', 2)).toEqual(['a', 'b']);
      expect(cache.lrange('k', 0, -1)).toEqual(['c']);
    });

    test('count larger than length → whole list, key deleted', () => {
      expect(cache.lpop('k', 99)).toEqual(['a', 'b', 'c']);
      expect(cache.cache.has('k')).toBe(false);
    });

    test('count 0 → [] no-op; missing key with count → []', () => {
      expect(cache.lpop('k', 0)).toEqual([]);
      expect(cache.llen('k')).toBe(3);
      expect(cache.lpop('nope', 2)).toEqual([]);
    });

    test('negative or non-integer count → TypeError', () => {
      expect(() => cache.lpop('k', -1)).toThrow(TypeError);
      expect(() => cache.lpop('k', 1.5)).toThrow(TypeError);
    });

    test('partial pop preserves TTL', () => {
      const c2 = new Cache({ maxSize: 10, defaultTTL: 0 });
      c2.rpush('k', 'a', 'b');
      const entry = c2.cache.get('k');
      entry.expiresAt = Date.now() + 40;
      c2.lpop('k');
      expect(c2.cache.get('k').expiresAt).toBe(entry.expiresAt);
      c2.destroy();
    });

    test('non-list value at key → TypeError', () => {
      cache.set('s', 'plain');
      expect(() => cache.lpop('s')).toThrow(/not a list/);
    });
  });

  describe('F309: rpop(key, count?)', () => {
    beforeEach(() => {
      cache.rpush('k', 'a', 'b', 'c');
    });

    test('pops the tail element, returns it', () => {
      expect(cache.rpop('k')).toBe('c');
      expect(cache.lrange('k', 0, -1)).toEqual(['a', 'b']);
    });

    test('missing key → null', () => {
      expect(cache.rpop('nope')).toBeNull();
    });

    test('emptying the list deletes the key', () => {
      cache.rpop('k');
      cache.rpop('k');
      cache.rpop('k');
      expect(cache.cache.has('k')).toBe(false);
    });

    test('with count: pops from the tail, order is [tail, ...] (Redis parity)', () => {
      expect(cache.rpop('k', 2)).toEqual(['c', 'b']);
      expect(cache.lrange('k', 0, -1)).toEqual(['a']);
    });

    test('count larger than length → whole list (head-first order), key deleted', () => {
      expect(cache.rpop('k', 99)).toEqual(['c', 'b', 'a']);
      expect(cache.cache.has('k')).toBe(false);
    });

    test('count 0 → [] no-op', () => {
      expect(cache.rpop('k', 0)).toEqual([]);
      expect(cache.llen('k')).toBe(3);
    });

    test('negative or non-integer count → TypeError', () => {
      expect(() => cache.rpop('k', -2)).toThrow(TypeError);
      expect(() => cache.rpop('k', 'x')).toThrow(TypeError);
    });

    test('non-list value at key → TypeError', () => {
      cache.set('s', 'plain');
      expect(() => cache.rpop('s')).toThrow(/not a list/);
    });
  });
});

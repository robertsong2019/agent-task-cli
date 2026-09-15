const { Cache } = require('../src/utils/cache');

// Round 76b — F280-F284: Redis hash-family parity, extension half
// (continuation of F274-F279 core in the same round).
describe('Round 76b: Cache hash family extension (F280 hkeys / F281 hvals / F282 hincrby / F283 hmget / F284 hmset)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F280: hkeys(key)', () => {
    test('field names in insertion order; missing key → []', () => {
      expect(cache.hkeys('ghost')).toEqual([]);
      cache.hset('h', 'b', 1);
      cache.hset('h', 'a', 2);
      cache.hset('h', 'c', 3);
      expect(cache.hkeys('h')).toEqual(['b', 'a', 'c']);
    });

    test('reflects deletions; result is a fresh array', () => {
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 2);
      cache.hdel('h', 'a');
      const keys = cache.hkeys('h');
      expect(keys).toEqual(['b']);
      keys.push('injected');
      expect(cache.hkeys('h')).toEqual(['b']);
    });

    test('non-hash → TypeError', () => {
      cache.set('s', 'str');
      expect(() => cache.hkeys('s')).toThrow(TypeError);
    });
  });

  describe('F281: hvals(key)', () => {
    test('values aligned with insertion order; missing key → []', () => {
      expect(cache.hvals('ghost')).toEqual([]);
      cache.hset('h', 'x', 10);
      cache.hset('h', 'y', 20);
      expect(cache.hvals('h')).toEqual([10, 20]);
    });

    test('overwrites reflected; result is a fresh array', () => {
      cache.hset('h', 'x', 1);
      cache.hset('h', 'x', 99);
      const vals = cache.hvals('h');
      expect(vals).toEqual([99]);
      vals.push(0);
      expect(cache.hvals('h')).toEqual([99]);
    });

    test('non-hash → TypeError', () => {
      cache.set('n', 42);
      expect(() => cache.hvals('n')).toThrow(TypeError);
    });
  });

  describe('F282: hincrby(key, field, delta?)', () => {
    test('missing key → creates hash {field: delta}, returns delta', () => {
      expect(cache.hincrby('h', 'count', 5)).toBe(5);
      expect(cache.hgetall('h')).toEqual({ count: 5 });
    });

    test('missing field → set to delta; default delta = 1', () => {
      cache.hset('h', 'a', 10);
      expect(cache.hincrby('h', 'b', 3)).toBe(3);
      expect(cache.hincrby('h', 'a')).toBe(11);
      expect(cache.hgetall('h')).toEqual({ a: 11, b: 3 });
    });

    test('integer-string field value parses (string2ll analog)', () => {
      cache.set('h', { n: '42' });
      expect(cache.hincrby('h', 'n', 8)).toBe(50);
      expect(cache.hget('h', 'n')).toBe(50); // stored back as number
    });

    test('non-integer current value → TypeError; non-integer delta → TypeError', () => {
      cache.set('h', { f: 1.5, s: 'abc' });
      expect(() => cache.hincrby('h', 'f', 1)).toThrow(TypeError);
      expect(() => cache.hincrby('h', 's', 1)).toThrow(TypeError);
      expect(() => cache.hincrby('h', 'f2', 0.5)).toThrow(TypeError);
    });

    test('beyond ±(2^53-1) → RangeError (safe-integer overflow)', () => {
      cache.set('h', { max: Number.MAX_SAFE_INTEGER, min: -Number.MAX_SAFE_INTEGER });
      expect(() => cache.hincrby('h', 'max', 1)).toThrow(RangeError);
      expect(() => cache.hincrby('h', 'min', -1)).toThrow(RangeError);
    });

    test('TTL preserved on increment', () => {
      cache.set('h', { n: 1 }, 5000);
      cache.hincrby('h', 'n', 1);
      expect(cache.ttl('h')).toBeGreaterThan(0);
    });

    test('non-string field → TypeError', () => {
      expect(() => cache.hincrby('h', 7, 1)).toThrow(TypeError);
    });
  });

  describe('F283: hmget(key, fields)', () => {
    test('values aligned with input; missing fields → undefined slots', () => {
      cache.hset('h', 'a', 1);
      cache.hset('h', 'b', 'x');
      expect(cache.hmget('h', ['a', 'ghost', 'b'])).toEqual([1, undefined, 'x']);
    });

    test('missing key → all-undefined array aligned with input', () => {
      expect(cache.hmget('ghost', ['a', 'b'])).toEqual([undefined, undefined]);
    });

    test('empty fields array → []', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hmget('h', [])).toEqual([]);
      expect(cache.hmget('ghost', [])).toEqual([]);
    });

    test('non-array or non-string members → TypeError; non-hash → TypeError', () => {
      cache.hset('h', 'a', 1);
      expect(() => cache.hmget('h', 'a')).toThrow(TypeError);
      expect(() => cache.hmget('h', ['a', 2])).toThrow(TypeError);
      cache.set('s', 'str');
      expect(() => cache.hmget('s', ['a'])).toThrow(TypeError);
    });
  });

  describe('F284: hmset(key, obj, ttl?)', () => {
    test('missing key → creates hash with all fields, returns new-field count', () => {
      expect(cache.hmset('h', { a: 1, b: 2 })).toBe(2);
      expect(cache.hgetall('h')).toEqual({ a: 1, b: 2 });
    });

    test('existing hash → merges, returns count of NEW fields only', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hmset('h', { a: 99, b: 2 })).toBe(1); // a overwritten, b new
      expect(cache.hgetall('h')).toEqual({ a: 99, b: 2 });
    });

    test('preserves TTL on existing hash; ttl param applies on creation', () => {
      cache.hmset('h', { a: 1 }, 4000);
      expect(cache.ttl('h')).toBeGreaterThan(0);
      cache.hmset('h', { b: 2 });
      expect(cache.ttl('h')).toBeGreaterThan(0);
    });

    test('empty object → no-op, returns 0, key NOT created', () => {
      expect(cache.hmset('ghost', {})).toBe(0);
      expect(cache.has('ghost')).toBe(false);
    });

    test('null / array / non-object input → TypeError', () => {
      expect(() => cache.hmset('h', null)).toThrow(TypeError);
      expect(() => cache.hmset('h', [1, 2])).toThrow(TypeError);
      expect(() => cache.hmset('h', 'str')).toThrow(TypeError);
    });

    test('non-hash existing value → TypeError', () => {
      cache.set('s', 'str');
      expect(() => cache.hmset('s', { a: 1 })).toThrow(TypeError);
    });
  });

  describe('family invariants', () => {
    test('hkeys/hvals/hgetall stay consistent through mixed ops', () => {
      cache.hmset('h', { a: 1, b: 2 });
      cache.hincrby('h', 'c', 7);
      cache.hdel('h', 'a');
      expect(cache.hkeys('h')).toEqual(['b', 'c']);
      expect(cache.hvals('h')).toEqual([2, 7]);
      expect(cache.hlen('h')).toBe(2);
      expect(cache.hexists('h', 'a')).toBe(false);
    });
  });
});

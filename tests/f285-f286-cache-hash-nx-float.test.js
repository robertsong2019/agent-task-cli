const { Cache } = require('../src/utils/cache');

// Round 77 — F285-F286: Redis hash-family parity, NX/float half.
describe('Round 77: Cache hash NX/float (F285 hsetnx / F286 hincrbyfloat)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('F285: hsetnx(key, field, value, ttl?)', () => {
    test('missing key → creates hash, returns 1', () => {
      expect(cache.hsetnx('h', 'a', 1)).toBe(1);
      expect(cache.hget('h', 'a')).toBe(1);
    });

    test('missing field in existing hash → sets it, returns 1; TTL preserved', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hsetnx('h', 'b', 2)).toBe(1);
      expect(cache.hget('h', 'b')).toBe(2);
      expect(cache.hget('h', 'a')).toBe(1);
    });

    test('existing field → strict no-op: value untouched, returns 0', () => {
      cache.hset('h', 'a', 'original');
      expect(cache.hsetnx('h', 'a', 'clobber')).toBe(0);
      expect(cache.hget('h', 'a')).toBe('original');
    });

    test('existing-field no-op leaves TTL untouched (expire still fires)', () => {
      cache.set('h', { a: 'x' }, 40);
      cache.hsetnx('h', 'a', 'ignored');
      // Value untouched AND the expiry countdown was not refreshed.
      expect(cache.hget('h', 'a')).toBe('x');
      const ttlBefore = cache.ttl('h');
      cache.hsetnx('h', 'a', 'ignored');
      expect(cache.ttl('h')).toBe(ttlBefore);
    });

    test('falsy values (0, "", false, null) still occupy the NX slot', () => {
      cache.hset('h', 'zero', 0);
      expect(cache.hsetnx('h', 'zero', 99)).toBe(0);
      expect(cache.hget('h', 'zero')).toBe(0);
      expect(cache.hsetnx('h', 'nul', null)).toBe(1);
      expect(cache.hget('h', 'nul')).toBe(null);
    });

    test('fresh-hash TTL comes from ttl arg (default defaultTTL)', () => {
      cache.hsetnx('h', 'a', 1, 100);
      expect(cache.ttl('h')).toBeGreaterThan(90);
      expect(cache.ttl('h')).toBeLessThanOrEqual(100);
    });

    test('non-string field → TypeError; non-hash → TypeError', () => {
      expect(() => cache.hsetnx('h', 42, 'x')).toThrow(TypeError);
      cache.set('s', 'str');
      expect(() => cache.hsetnx('s', 'a', 1)).toThrow(TypeError);
    });

    test('rejected calls create nothing (atomicity)', () => {
      expect(() => cache.hsetnx('h', 7, 'x')).toThrow(TypeError);
      expect(cache.hexists('h', '7')).toBe(false);
      expect(cache.hlen('h')).toBe(0);
      expect(cache.get('h')).toBeUndefined();
    });
  });

  describe('F286: hincrbyfloat(key, field, delta = 1)', () => {
    test('missing key → hash created with {field: delta}; returns delta', () => {
      expect(cache.hincrbyfloat('h', 'w', 1.5)).toBe(1.5);
      expect(cache.hget('h', 'w')).toBe(1.5);
    });

    test('missing field → field set to delta', () => {
      cache.hset('h', 'a', 1);
      expect(cache.hincrbyfloat('h', 'b', 0.25)).toBe(0.25);
      expect(cache.hget('h', 'b')).toBe(0.25);
    });

    test('float delta on float value; existing TTL preserved', () => {
      cache.set('h', { w: 10.5 }, 60);
      expect(cache.hincrbyfloat('h', 'w', 0.5)).toBe(11);
      expect(cache.hget('h', 'w')).toBe(11);
      expect(cache.ttl('h')).toBeGreaterThan(50);
    });

    test('float-string current value parses (strtod analog)', () => {
      cache.hset('h', 'w', '10.5');
      expect(cache.hincrbyfloat('h', 'w', 1)).toBe(11.5);
      cache.hset('h', 'sci', '1e3');
      expect(cache.hincrbyfloat('h', 'sci', 0.5)).toBe(1000.5);
      cache.hset('h', 'neg', '-2.25');
      expect(cache.hincrbyfloat('h', 'neg', 0.25)).toBe(-2);
    });

    test('integer value/integer delta still works (10 + 1.5 = 11.5)', () => {
      cache.hset('h', 'w', 10);
      expect(cache.hincrbyfloat('h', 'w', 1.5)).toBe(11.5);
    });

    test('IEEE754 double parity: 0.1 + 0.2 === 0.30000000000000004', () => {
      cache.hset('h', 'w', 0.1);
      expect(cache.hincrbyfloat('h', 'w', 0.2)).toBe(0.30000000000000004);
    });

    test('non-float current value → TypeError', () => {
      cache.hset('h', 'w', 'abc');
      expect(() => cache.hincrbyfloat('h', 'w', 1)).toThrow(TypeError);
      cache.hset('h', 'w2', 'NaN');
      expect(() => cache.hincrbyfloat('h', 'w2', 1)).toThrow(TypeError);
      cache.hset('h', 'w3', '0x10');
      expect(() => cache.hincrbyfloat('h', 'w3', 1)).toThrow(TypeError);
    });

    test('non-number or non-finite delta → TypeError', () => {
      expect(() => cache.hincrbyfloat('h', 'w', '1.5')).toThrow(TypeError);
      expect(() => cache.hincrbyfloat('h', 'w', NaN)).toThrow(TypeError);
      expect(() => cache.hincrbyfloat('h', 'w', Infinity)).toThrow(TypeError);
    });

    test('overflow to Infinity → RangeError; hash unchanged on throw', () => {
      cache.hset('h', 'w', Number.MAX_VALUE);
      expect(() => cache.hincrbyfloat('h', 'w', Number.MAX_VALUE)).toThrow(RangeError);
      expect(cache.hget('h', 'w')).toBe(Number.MAX_VALUE);
    });

    test('non-string field → TypeError; non-hash → TypeError', () => {
      expect(() => cache.hincrbyfloat('h', 3, 1.5)).toThrow(TypeError);
      cache.set('s', 'str');
      expect(() => cache.hincrbyfloat('s', 'w', 1.5)).toThrow(TypeError);
    });
  });
});

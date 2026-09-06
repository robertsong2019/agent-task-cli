const { Storage } = require('../src/utils/storage');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 73: F269 Cache.incrBy/decrBy / F270 Storage.modeBy', () => {
  describe('F269: Cache incrByInt/decrByInt — Redis INCRBY/DECRBY integer parity (sibling of F250 incrByFloat)', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('incrByInt on missing key → base 0, returns delta, stores number', () => {
      expect(cache.incrByInt('hits', 5)).toBe(5);
      expect(cache.get('hits')).toBe(5);
    });

    test('incrByInt on existing number value increments and returns new value', () => {
      cache.set('hits', 10);
      expect(cache.incrByInt('hits', 3)).toBe(13);
      expect(cache.get('hits')).toBe(13);
    });

    test('incrByInt on existing integer-string parses and increments (Redis string semantics)', () => {
      cache.set('hits', '7');
      expect(cache.incrByInt('hits', 1)).toBe(8);
      expect(cache.get('hits')).toBe(8); // stored back as number
    });

    test('integer-string with leading/trailing spaces parses (Redis string2ll)', () => {
      cache.set('hits', '  42  ');
      expect(cache.incrByInt('hits', 1)).toBe(43);
    });

    test('incrBy preserves existing TTL (Redis INCR keeps TTL)', async () => {
      cache.set('hits', 1, 100000);
      cache.incrByInt('hits', 1);
      expect(cache.getTTL('hits')).toBeGreaterThan(60000);
    });

    test('incrByInt on persistent key stays persistent (TTL -1)', () => {
      cache.set('hits', 1, 0);
      cache.incrByInt('hits', 1);
      expect(cache.getTTL('hits')).toBe(-1);
    });

    test('incrByInt on expired key treats it as missing (fresh base 0)', async () => {
      cache.set('hits', 99, 5);
      await new Promise((r) => setTimeout(r, 15));
      expect(cache.incrByInt('hits', 2)).toBe(2);
      expect(cache.get('hits')).toBe(2);
    });

    test('decrByInt = incrByInt with negated delta; missing key → -delta', () => {
      cache.set('stock', 10);
      expect(cache.decrByInt('stock', 4)).toBe(6);
      expect(cache.decrByInt('fresh', 4)).toBe(-4);
    });

    test('negative deltas: incrByInt -3 === decrBy 3', () => {
      cache.set('n', 10);
      expect(cache.incrByInt('n', -3)).toBe(7);
    });

    test('non-integer delta → TypeError (Redis integer-or-out-of-range)', () => {
      expect(() => cache.incrByInt('k', 1.5)).toThrow(TypeError);
      expect(() => cache.incrByInt('k', '2')).toThrow(TypeError);
      expect(() => cache.incrByInt('k', NaN)).toThrow(TypeError);
      expect(() => cache.decrByInt('k', 0.5)).toThrow(TypeError);
    });

    test('non-integer-string value → TypeError (WRONGTYPE-family)', () => {
      cache.set('k', '3.5');
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
      cache.set('k', 'abc');
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
      cache.set('k', ' 12x');
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
      cache.set('k', '');
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
    });

    test('non-string non-number value → TypeError', () => {
      cache.set('k', { a: 1 });
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
      cache.set('k', [1, 2]);
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
      cache.set('k', true);
      expect(() => cache.incrByInt('k', 1)).toThrow(TypeError);
    });

    test('result beyond safe-integer range → RangeError (64-bit overflow analog)', () => {
      cache.set('k', Number.MAX_SAFE_INTEGER);
      expect(() => cache.incrByInt('k', 1)).toThrow(RangeError);
      cache.set('k', Number.MIN_SAFE_INTEGER);
      expect(() => cache.incrByInt('k', -1)).toThrow(RangeError);
    });

    test('unsafe existing value → RangeError even if delta would fit', () => {
      cache.set('k', 2 ** 53); // not a safe integer
      expect(() => cache.incrByInt('k', 0)).toThrow(RangeError);
    });
  });

  describe('F270: Storage.modeBy(field) — mode of finite numeric field values', () => {
    let storage, dir;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atc-f270-'));
      storage = new Storage(dir);
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    test('clear mode wins regardless of insertion order', async () => {
      for (const [id, v] of [['a', 1], ['b', 2], ['c', 2], ['d', 2], ['e', 3]]) {
        await storage.create(id, { v });
      }
      expect(await storage.modeBy('v')).toBe(2);
    });

    test('tie → smallest value (deterministic)', async () => {
      for (const [id, v] of [['a', 5], ['b', 5], ['c', 9], ['d', 9]]) {
        await storage.create(id, { v });
      }
      expect(await storage.modeBy('v')).toBe(5);
    });

    test('all values unique → every count 1, tie → smallest', async () => {
      for (const [id, v] of [['a', 30], ['b', 10], ['c', 20]]) {
        await storage.create(id, { v });
      }
      expect(await storage.modeBy('v')).toBe(10);
    });

    test('non-numeric and missing fields ignored (family guard)', async () => {
      await storage.create('a', { v: 4 });
      await storage.create('b', { v: 4 });
      await storage.create('c', { v: 'x' });
      await storage.create('d', { other: 9 });
      await storage.create('e', { v: NaN });
      await storage.create('f', { v: Infinity });
      await storage.create('g', { v: 7 });
      expect(await storage.modeBy('v')).toBe(4);
    });

    test('no tasks / no numerics → null', async () => {
      expect(await storage.modeBy('v')).toBeNull();
      await storage.create('a', { v: 'text' });
      expect(await storage.modeBy('v')).toBeNull();
    });

    test('single task → its value', async () => {
      await storage.create('a', { v: 7 });
      expect(await storage.modeBy('v')).toBe(7);
    });

    test('invalid field → TypeError', async () => {
      await expect(storage.modeBy('')).rejects.toThrow(TypeError);
      await expect(storage.modeBy(42)).rejects.toThrow(TypeError);
    });
  });
});

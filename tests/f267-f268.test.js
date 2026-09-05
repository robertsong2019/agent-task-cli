const { Storage } = require('../src/utils/storage');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 72: F267 Cache string ops / F268 Storage.percentileBy', () => {
  describe('F267: Cache append/strlen/getrange — Redis string ops parity', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('append on missing key creates it, returns new length', () => {
      expect(cache.append('k', 'Hello')).toBe(5);
      expect(cache.get('k')).toBe('Hello');
    });

    test('append on existing string concatenates and returns total length', () => {
      cache.set('k', 'Hello');
      expect(cache.append('k', ' World')).toBe(11);
      expect(cache.get('k')).toBe('Hello World');
    });

    test('append preserves existing TTL (Redis APPEND keeps TTL)', () => {
      cache.set('k', 'ab', 100000);
      cache.append('k', 'cd');
      expect(cache.get('k')).toBe('abcd');
      expect(cache.getTTL('k')).toBeGreaterThan(60000);
    });

    test('append on persistent key keeps it persistent', () => {
      cache.set('k', 'ab', 0);
      cache.append('k', 'cd');
      expect(cache.getTTL('k')).toBe(-1); // persistent (Redis TTL parity: -1)
    });

    test('append on expired key treats it as missing (fresh create)', () => {
      cache.set('k', 'old', 50);
      return new Promise((resolve) => setTimeout(resolve, 80)).then(() => {
        expect(cache.append('k', 'new')).toBe(3);
        expect(cache.get('k')).toBe('new');
      });
    });

    test('append on non-string value throws TypeError', () => {
      cache.set('k', 42);
      expect(() => cache.append('k', 'x')).toThrow(TypeError);
    });

    test('append with non-string suffix throws TypeError', () => {
      expect(() => cache.append('k', 123)).toThrow(TypeError);
    });

    test('strlen: missing key → 0, existing → length', () => {
      expect(cache.strlen('missing')).toBe(0);
      cache.set('k', 'hello');
      expect(cache.strlen('k')).toBe(5);
      cache.set('empty', '');
      expect(cache.strlen('empty')).toBe(0);
    });

    test('strlen on non-string value throws TypeError', () => {
      cache.set('k', { a: 1 });
      expect(() => cache.strlen('k')).toThrow(TypeError);
    });

    test('getrange basic: inclusive end, like Redis', () => {
      cache.set('k', 'Hello World');
      expect(cache.getrange('k', 0, 4)).toBe('Hello');
      expect(cache.getrange('k', 6, -1)).toBe('World');
      expect(cache.getrange('k', 0, -1)).toBe('Hello World');
    });

    test('getrange negative start from end', () => {
      cache.set('k', 'Hello');
      expect(cache.getrange('k', -3, -1)).toBe('llo');
      expect(cache.getrange('k', -5, -1)).toBe('Hello');
    });

    test('getrange clamps out-of-range indices', () => {
      cache.set('k', 'Hello');
      expect(cache.getrange('k', 0, 100)).toBe('Hello');
      expect(cache.getrange('k', 3, 1)).toBe(''); // start > end → empty
      expect(cache.getrange('k', 100, 200)).toBe('');
    });

    test('getrange missing key → empty string; non-string → TypeError; non-integer → TypeError', () => {
      expect(cache.getrange('missing', 0, -1)).toBe('');
      cache.set('k', 42);
      expect(() => cache.getrange('k', 0, 1)).toThrow(TypeError);
      expect(() => cache.getrange('x', 'a', 1)).toThrow(TypeError);
    });
  });

  describe('F268: Storage.percentileBy(field, p) — linear interpolation (medianBy generalization)', () => {
    let storage, dir;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atc-f268-'));
      storage = new Storage(dir);
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    test('p0/p100 = min/max; p50 on even count matches medianBy (interpolated)', async () => {
      for (const n of [10, 20, 30, 40]) await storage.create(String(n), { score: n });
      expect(await storage.percentileBy('score', 0)).toBe(10);
      expect(await storage.percentileBy('score', 100)).toBe(40);
      expect(await storage.percentileBy('score', 50)).toBe(25); // (20+30)/2 — equals medianBy
      expect(await storage.percentileBy('score', 25)).toBe(17.5);
      expect(await storage.percentileBy('score', 75)).toBe(32.5);
    });

    test('p50 on odd count = exact middle (matches medianBy)', async () => {
      for (const n of [5, 1, 9]) await storage.create(String(n), { v: n });
      expect(await storage.percentileBy('v', 50)).toBe(5);
      expect(await storage.percentileBy('v', 50)).toBe(await storage.medianBy('v'));
    });

    test('single value → that value at any percentile', async () => {
      await storage.create('a', { v: 7 });
      expect(await storage.percentileBy('v', 0)).toBe(7);
      expect(await storage.percentileBy('v', 100)).toBe(7);
    });

    test('unsorted input: interpolation computed on sorted values', async () => {
      for (const n of [40, 10, 30, 20]) await storage.create(String(n), { v: n });
      expect(await storage.percentileBy('v', 25)).toBe(17.5);
    });

    test('non-numeric and missing fields ignored (family guard)', async () => {
      await storage.create('a', { v: 1 });
      await storage.create('b', { v: 'x' });
      await storage.create('c', { other: 9 });
      await storage.create('d', { v: NaN });
      await storage.create('e', { v: Infinity });
      expect(await storage.percentileBy('v', 50)).toBe(1);
    });

    test('no tasks / no numerics → null', async () => {
      expect(await storage.percentileBy('v', 50)).toBeNull();
      await storage.create('a', { v: 'text' });
      expect(await storage.percentileBy('v', 50)).toBeNull();
    });

    test('invalid field or percentile → TypeError', async () => {
      await expect(storage.percentileBy('', 50)).rejects.toThrow(TypeError);
      await expect(storage.percentileBy('v', -1)).rejects.toThrow(TypeError);
      await expect(storage.percentileBy('v', 101)).rejects.toThrow(TypeError);
      await expect(storage.percentileBy('v', '50')).rejects.toThrow(TypeError);
    });
  });
});

const { Storage } = require('../src/utils/storage');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 71: F265 Cache.expire modes / F266 Storage.stddevBy', () => {
  describe('F265: Cache.expire(key, ttl, { mode }) — Redis 7 EXPIRE NX/XX/GT/LT parity', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('NX: applies TTL only on persistent (no-TTL) key', () => {
      cache.set('p', 1, 0); // persistent
      expect(cache.expire('p', 100000, { mode: 'NX' })).toBe(true);
      expect(cache.getTTL('p')).toBeGreaterThan(60000);
    });

    test('NX: fails on key that already has a TTL (TTL unchanged)', () => {
      cache.set('k', 1, 100000);
      expect(cache.expire('k', 50000, { mode: 'NX' })).toBe(false);
      expect(cache.getTTL('k')).toBeGreaterThan(60000); // still ~100s, not 50s
    });

    test('XX: applies TTL only on key with existing TTL', () => {
      cache.set('k', 1, 100000);
      expect(cache.expire('k', 50000, { mode: 'XX' })).toBe(true);
      expect(cache.getTTL('k')).toBeLessThanOrEqual(50000);
      expect(cache.getTTL('k')).toBeGreaterThan(0);
    });

    test('XX: fails on persistent key (stays persistent)', () => {
      cache.set('k', 1, 0);
      expect(cache.expire('k', 50000, { mode: 'XX' })).toBe(false);
      expect(cache.getTTL('k')).toBe(-1); // persistent sentinel
    });

    test('GT: succeeds only when new TTL greater than remaining', () => {
      cache.set('k', 1, 100000);
      expect(cache.expire('k', 50000, { mode: 'GT' })).toBe(false); // 50s < ~100s
      expect(cache.getTTL('k')).toBeGreaterThan(60000);
      expect(cache.expire('k', 200000, { mode: 'GT' })).toBe(true);
      expect(cache.getTTL('k')).toBeGreaterThan(100000);
    });

    test('GT: persistent key treated as infinite → fails', () => {
      cache.set('k', 1, 0);
      expect(cache.expire('k', 99999000, { mode: 'GT' })).toBe(false);
      expect(cache.getTTL('k')).toBe(-1);
    });

    test('LT: succeeds only when new TTL less than remaining', () => {
      cache.set('k', 1, 100000);
      expect(cache.expire('k', 200000, { mode: 'LT' })).toBe(false);
      expect(cache.getTTL('k')).toBeGreaterThan(60000);
      expect(cache.expire('k', 50000, { mode: 'LT' })).toBe(true);
      expect(cache.getTTL('k')).toBeLessThanOrEqual(50000);
    });

    test('LT: persistent key (infinite) → succeeds', () => {
      cache.set('k', 1, 0);
      expect(cache.expire('k', 50000, { mode: 'LT' })).toBe(true);
      expect(cache.getTTL('k')).toBeLessThanOrEqual(50000);
    });

    test('missing / expired key → false with any mode', async () => {
      expect(cache.expire('ghost', 50000, { mode: 'NX' })).toBe(false);
      cache.set('e', 1, 10);
      await new Promise((r) => setTimeout(r, 20));
      expect(cache.expire('e', 50000, { mode: 'XX' })).toBe(false);
      expect(cache.size()).toBe(0); // expired purged along the way
    });

    test('mode is case-insensitive; unknown mode → TypeError', () => {
      cache.set('k', 1, 100000);
      expect(cache.expire('k', 50000, { mode: 'xx' })).toBe(true);
      expect(() => cache.expire('k', 50000, { mode: 'ZZ' })).toThrow(TypeError);
    });

    test('no mode → legacy behavior unchanged', () => {
      cache.set('k', 1, 0);
      expect(cache.expire('k', 50000)).toBe(true);
      expect(cache.expire('k', null)).toBe(true); // back to persistent
      expect(cache.getTTL('k')).toBe(-1);
    });
  });

  describe('F266: Storage.stddevBy(field) — population stddev, sibling of avg/medianBy', () => {
    let storage, tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-stddev-'));
      storage = new Storage(tmpDir);
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    test('classic population stddev: [2,4,4,4,5,5,7,9] → 2', async () => {
      for (const v of [2, 4, 4, 4, 5, 5, 7, 9]) {
        await storage.saveTask(`t${v}-${Math.random()}`, { priority: v });
      }
      expect(await storage.stddevBy('priority')).toBeCloseTo(2, 10);
    });

    test('single value → 0', async () => {
      await storage.saveTask('t1', { priority: 3 });
      expect(await storage.stddevBy('priority')).toBe(0);
    });

    test('non-numeric / missing fields ignored, not NaN', async () => {
      await storage.saveTask('t1', { priority: 4 });
      await storage.saveTask('t2', { priority: 'high' });
      await storage.saveTask('t3', { other: 1 });
      await storage.saveTask('t4', { priority: 8 });
      expect(await storage.stddevBy('priority')).toBeCloseTo(2, 10);
    });

    test('empty store or no numerics → null', async () => {
      expect(await storage.stddevBy('priority')).toBeNull();
      await storage.saveTask('t1', { priority: 'low' });
      expect(await storage.stddevBy('priority')).toBeNull();
    });

    test('non-string / empty field → TypeError', async () => {
      await expect(storage.stddevBy(42)).rejects.toThrow(TypeError);
      await expect(storage.stddevBy('')).rejects.toThrow(TypeError);
    });
  });
});

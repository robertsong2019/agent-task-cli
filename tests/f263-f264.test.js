const { Storage } = require('../src/utils/storage');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 70: F263 Cache.setXX / F264 Storage.medianBy', () => {
  describe('F263: Cache.setXX(key, value, ttl?) — SET ... XX, mirror of setNX', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('missing key → false, nothing written', () => {
      expect(cache.setXX('k', 'v')).toBe(false);
      expect(cache.get('k')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    test('existing fresh key → true, value replaced', () => {
      cache.set('k', 'old', 0);
      expect(cache.setXX('k', 'new')).toBe(true);
      expect(cache.get('k')).toBe('new');
    });

    test('applies the given ttl on replace', async () => {
      cache.set('k', 'old', 0); // no expiry
      expect(cache.setXX('k', 'new', 10)).toBe(true);
      await new Promise((r) => setTimeout(r, 20));
      expect(cache.get('k')).toBeUndefined(); // new entry expired
    });

    test('expired key → false, entry purged, NOT overwritten (expired = missing)', async () => {
      cache.set('k', 'old', 10);
      await new Promise((r) => setTimeout(r, 20));
      // no has()/get() pre-touch: setXX must handle expiry itself
      expect(cache.setXX('k', 'new', 0)).toBe(false);
      expect(cache.get('k')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    test('setNX/setXX partition: exactly one wins on an existing key set', () => {
      expect(cache.setNX('k', 'first')).toBe(true);
      expect(cache.setNX('k', 'again')).toBe(false);
      expect(cache.setXX('k', 'second')).toBe(true);
      expect(cache.get('k')).toBe('second');
    });
  });

  describe('F264: Storage.medianBy(field) — sibling of minBy/maxBy (F249)', () => {
    let storage, tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-median-'));
      storage = new Storage(tmpDir);
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    test('odd count → middle value of finite numerics', async () => {
      await storage.saveTask('t1', { title: 'a', priority: 5 });
      await storage.saveTask('t2', { title: 'b', priority: 1 });
      await storage.saveTask('t3', { title: 'c', priority: 3 });
      expect(await storage.medianBy('priority')).toBe(3);
    });

    test('even count → average of the two middles', async () => {
      await storage.saveTask('t1', { title: 'a', priority: 1 });
      await storage.saveTask('t2', { title: 'b', priority: 2 });
      await storage.saveTask('t3', { title: 'c', priority: 4 });
      await storage.saveTask('t4', { title: 'd', priority: 9 });
      expect(await storage.medianBy('priority')).toBe(3);
    });

    test('non-numeric / missing fields ignored, not NaN-poisoning', async () => {
      await storage.saveTask('t1', { title: 'a', priority: 1 });
      await storage.saveTask('t2', { title: 'b', priority: 'oops' });
      await storage.saveTask('t3', { title: 'c' }); // no field
      await storage.saveTask('t4', { title: 'd', priority: 3 });
      expect(await storage.medianBy('priority')).toBe(2);
    });

    test('empty storage → null', async () => {
      expect(await storage.medianBy('priority')).toBeNull();
    });

    test('no task has a finite numeric value → null', async () => {
      await storage.saveTask('t1', { title: 'a', priority: 'x' });
      await storage.saveTask('t2', { title: 'b' });
      expect(await storage.medianBy('priority')).toBeNull();
    });

    test('non-string / empty field → TypeError (minBy/maxBy guard parity)', async () => {
      await expect(storage.medianBy('')).rejects.toThrow(TypeError);
      await expect(storage.medianBy(42)).rejects.toThrow(TypeError);
    });
  });
});

const { Cache } = require('../../src/utils/cache');
const { Storage } = require('../../src/utils/storage');
const { EventBus } = require('../../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Round 46: F184-F186', () => {
  describe('F184: Cache.serialize()', () => {
    test('returns empty object for empty cache', () => {
      const cache = new Cache({ maxSize: 10 });
      expect(cache.serialize()).toEqual({});
    });

    test('returns plain object of non-expired entries', () => {
      const cache = new Cache({ maxSize: 10 });
      cache.set('a', 1);
      cache.set('b', 'hello');
      cache.set('c', { nested: true });
      const out = cache.serialize();
      expect(out.a).toBe(1);
      expect(out.b).toBe('hello');
      expect(out.c).toEqual({ nested: true });
    });

    test('excludes expired entries', () => {
      const cache = new Cache({ maxSize: 10 });
      cache.set('fresh', 'yes');
      cache.set('stale', 'no', 50);
      return new Promise(resolve => {
        setTimeout(() => {
          const out = cache.serialize();
          expect(out.fresh).toBe('yes');
          expect(out.stale).toBeUndefined();
          resolve();
        }, 120);
      });
    });

    test('strips non-serializable values (functions, undefined)', () => {
      const cache = new Cache({ maxSize: 10 });
      cache.set('fn', () => 42);
      cache.set('obj', { a: 1, fn: () => 0, undef: undefined, good: 'yes' });
      cache.set('num', 99);
      const out = cache.serialize();
      expect(out.fn).toBeNull();
      expect(out.obj).toEqual({ a: 1, good: 'yes' });
      expect(out.num).toBe(99);
    });

    test('handles arrays with mixed serializable content', () => {
      const cache = new Cache({ maxSize: 10 });
      cache.set('arr', [1, 'x', () => 0, { y: 2 }]);
      const out = cache.serialize();
      expect(out.arr[0]).toBe(1);
      expect(out.arr[1]).toBe('x');
      expect(out.arr[3]).toEqual({ y: 2 });
    });
  });

  describe('F185: Storage.random(n)', () => {
    let tmpDir, storage;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-rand-'));
      storage = new Storage(tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns 1 task by default', async () => {
      for (let i = 0; i < 3; i++) {
        await storage.create(`t${i}`, { name: `task${i}` });
      }
      const result = await storage.random();
      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^t[0-2]$/);
    });

    test('returns up to n tasks', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.create(`t${i}`, { val: i });
      }
      const result = await storage.random(3);
      expect(result).toHaveLength(3);
    });

    test('returns all tasks when n exceeds count', async () => {
      await storage.create('a', { x: 1 });
      await storage.create('b', { x: 2 });
      const result = await storage.random(10);
      expect(result).toHaveLength(2);
    });

    test('returns empty array for empty storage', async () => {
      const result = await storage.random(5);
      expect(result).toEqual([]);
    });

    test('returns different results across calls (probabilistic)', async () => {
      for (let i = 0; i < 20; i++) {
        await storage.create(`t${i}`, { val: i });
      }
      const seen = new Set();
      for (let i = 0; i < 50; i++) {
        const [t] = await storage.random(1);
        seen.add(t.id);
      }
      // With 20 tasks and 50 draws, extremely likely to see >3 unique
      expect(seen.size).toBeGreaterThan(3);
    });
  });

  describe('F186: EventBus.size()', () => {
    test('returns 0 for empty bus', () => {
      const bus = new EventBus();
      expect(bus.size()).toBe(0);
    });

    test('counts total subscribers across channels', () => {
      const bus = new EventBus();
      bus.on('a', () => {});
      bus.on('a', () => {});
      bus.on('b', () => {});
      expect(bus.size()).toBe(3);
    });

    test('decreases after unsubscribe', () => {
      const bus = new EventBus();
      const unsub = bus.on('x', () => {});
      bus.on('x', () => {});
      expect(bus.size()).toBe(2);
      unsub();
      expect(bus.size()).toBe(1);
    });

    test('does not count wildcard listeners', () => {
      const bus = new EventBus();
      bus.on('*', () => {});
      bus.on('real', () => {});
      expect(bus.size()).toBe(1);
    });

    test('reflects removal of all listeners on a channel', () => {
      const bus = new EventBus();
      const u1 = bus.on('ch', () => {});
      const u2 = bus.on('ch', () => {});
      expect(bus.size()).toBe(2);
      u1();
      u2();
      expect(bus.size()).toBe(0);
    });
  });
});

const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 66: F253 EventBus.replayAll / F254 Storage.updateMany / F255 Cache.getStale', () => {
  describe('F253: EventBus.replayAll(channel, handler)', () => {
    let bus;

    beforeEach(() => {
      bus = new EventBus();
    });

    test('replays full backlog oldest-first, then live events', () => {
      bus.emit('task', { n: 1 });
      bus.emit('task', { n: 2 });
      bus.emit('task', { n: 3 });
      const order = [];
      bus.replayAll('task', (e) => order.push(e.data.n));
      bus.emit('task', { n: 4 });
      expect(order).toEqual([1, 2, 3, 4]);
    });

    test('no history → live events only', () => {
      const seen = [];
      const unsub = bus.replayAll('task', (e) => seen.push(e.data.n));
      bus.emit('task', { n: 1 });
      expect(seen).toEqual([1]);
      unsub();
    });

    test('exact-channel filter: other channels do not leak in', () => {
      bus.emit('other', { n: 1 });
      bus.emit('task:sub', { n: 2 });
      const seen = [];
      bus.replayAll('task', (e) => seen.push(e));
      expect(seen).toHaveLength(0);
    });

    test('unsubscribe stops delivery (backlog replay unaffected)', () => {
      bus.emit('task', { n: 1 });
      const seen = [];
      const unsub = bus.replayAll('task', (e) => seen.push(e.data.n));
      unsub();
      bus.emit('task', { n: 2 });
      expect(seen).toEqual([1]);
      expect(bus.listenerCount('task')).toBe(0);
    });

    test('drained channel replays nothing', () => {
      bus.emit('task', { n: 1 });
      bus.drainChannel('task');
      const seen = [];
      bus.replayAll('task', (e) => seen.push(e));
      expect(seen).toHaveLength(0);
    });

    test('throws TypeError when handler is not a function', () => {
      expect(() => bus.replayAll('task', null)).toThrow(TypeError);
      expect(() => bus.replayAll('task', 42)).toThrow(TypeError);
    });
  });

  describe('F254: Storage.updateMany(ids, updates)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-updatemany-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', status: 'open', priority: 1 });
      await storage.saveTask('t2', { title: 'B', status: 'open', priority: 2 });
      await storage.saveTask('t3', { title: 'C', status: 'open', priority: 3 });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('merges updates into every listed task', async () => {
      const { updated, missing } = await storage.updateMany(['t1', 't2'], { status: 'done' });
      expect(updated.sort()).toEqual(['t1', 't2']);
      expect(missing).toEqual([]);
      expect((await storage.getTask('t1')).status).toBe('done');
      expect((await storage.getTask('t2')).status).toBe('done');
      expect((await storage.getTask('t3')).status).toBe('open');
    });

    test('merge preserves untouched fields', async () => {
      await storage.updateMany(['t1'], { status: 'done' });
      const t1 = await storage.getTask('t1');
      expect(t1).toMatchObject({ title: 'A', status: 'done', priority: 1 });
    });

    test('reports missing ids without creating them', async () => {
      const { updated, missing } = await storage.updateMany(['t1', 'ghost'], { status: 'done' });
      expect(updated).toEqual(['t1']);
      expect(missing).toEqual(['ghost']);
      expect(await storage.getTask('ghost')).toBeNull();
    });

    test('empty ids → both lists empty', async () => {
      const r = await storage.updateMany([], { status: 'done' });
      expect(r.updated).toEqual([]);
      expect(r.missing).toEqual([]);
    });

    test('throws TypeError when ids is not an array', async () => {
      await expect(storage.updateMany('t1', {})).rejects.toThrow(TypeError);
      await expect(storage.updateMany(null, {})).rejects.toThrow(TypeError);
    });

    test('throws TypeError when updates is not a plain object', async () => {
      await expect(storage.updateMany(['t1'], null)).rejects.toThrow(TypeError);
      await expect(storage.updateMany(['t1'], ['x'])).rejects.toThrow(TypeError);
      await expect(storage.updateMany(['t1'], 'done')).rejects.toThrow(TypeError);
    });
  });

  describe('F255: Cache.getStale(key)', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    test('fresh key → { value, expired: false }', () => {
      cache.set('k', 'v', 10000);
      expect(cache.getStale('k')).toEqual({ value: 'v', expired: false });
    });

    test('expired key → { value, expired: true } and entry is NOT purged', () => {
      cache.set('k', 'v', 10);
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.getStale('k')).toEqual({ value: 'v', expired: true });
          expect(cache.cache.has('k')).toBe(true); // soft read: no purge
          resolve();
        }, 30);
      });
    });

    test('missing key → undefined', () => {
      expect(cache.getStale('nope')).toBeUndefined();
    });

    test('persistent key → expired: false', () => {
      cache.set('k', 'v', 0);
      expect(cache.getStale('k')).toEqual({ value: 'v', expired: false });
    });

    test('no hit/miss stats side effects', () => {
      cache.set('k', 'v', 10000);
      const before = cache.getStats();
      cache.getStale('k');
      const after = cache.getStats();
      expect(after.hits).toBe(before.hits);
      expect(after.misses).toBe(before.misses);
    });

    test('interops with get: get purges expired, getStale then sees nothing', () => {
      cache.set('k', 'v', 10);
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.getStale('k').expired).toBe(true);
          cache.get('k'); // hard read purges expired entry
          expect(cache.getStale('k')).toBeUndefined();
          resolve();
        }, 30);
      });
    });
  });
});

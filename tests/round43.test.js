const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');

describe('Round 43: F175-F177', () => {
  describe('F175: Cache.pop(key)', () => {
    let cache;
    beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
    afterEach(() => cache.destroy());

    it('returns value and removes key', () => {
      cache.set('a', 42);
      expect(cache.pop('a')).toBe(42);
      expect(cache.get('a')).toBeUndefined();
    });

    it('returns undefined for missing key', () => {
      expect(cache.pop('missing')).toBeUndefined();
    });

    it('returns undefined for expired key', async () => {
      cache.set('exp', 'val', 1);
      await new Promise(r => setTimeout(r, 10));
      expect(cache.pop('exp')).toBeUndefined();
    });

    it('increments hit stat then deletes', () => {
      cache.set('b', 'hello');
      cache.pop('b');
      expect(cache.stats.hits).toBe(1);
    });

    it('returns most recent value when called multiple times', () => {
      cache.set('c', 'first');
      cache.set('c', 'second');
      expect(cache.pop('c')).toBe('second');
      expect(cache.pop('c')).toBeUndefined();
    });
  });

  describe('F176: Storage.mapReduce(mapFn, reduceFn, initial)', () => {
    let storage, tmpDir;
    beforeEach(async () => {
      tmpDir = path.join(os.tmpdir(), 'test-mapreduce-' + Date.now());
      storage = new Storage(tmpDir);
      await storage.ensureDataDir();
      await storage.saveTask('t1', { score: 10, tag: 'a' });
      await storage.saveTask('t2', { score: 20, tag: 'b' });
      await storage.saveTask('t3', { score: 30, tag: 'a' });
    });
    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('sums a field across tasks', async () => {
      const total = await storage.mapReduce(
        t => t.score,
        (acc, val) => acc + val,
        0
      );
      expect(total).toBe(60);
    });

    it('counts tasks matching a condition', async () => {
      const count = await storage.mapReduce(
        t => t.tag === 'a' ? 1 : 0,
        (acc, val) => acc + val,
        0
      );
      expect(count).toBe(2);
    });

    it('returns initial for empty storage', async () => {
      await storage.clear();
      const result = await storage.mapReduce(t => t.score, (a, b) => a + b, 42);
      expect(result).toBe(42);
    });

    it('builds a grouped map', async () => {
      const grouped = await storage.mapReduce(
        t => ({ [t.tag]: t.score }),
        (acc, mapped) => {
          for (const [k, v] of Object.entries(mapped)) {
            (acc[k] = acc[k] || []).push(v);
          }
          return acc;
        },
        {}
      );
      expect(grouped).toEqual({ a: [10, 30], b: [20] });
    });
  });

  describe('F177: EventBus.forward(channel, targetBus, transform?)', () => {
    let bus1, bus2;

    it('relays event data to target bus', () => {
      bus1 = new EventBus();
      bus2 = new EventBus();
      const received = [];
      bus2.on('test', e => received.push(e.data));
      bus1.forward('test', bus2);
      bus1.emit('test', { msg: 'hello' });
      expect(received).toEqual([{ msg: 'hello' }]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('applies transform to event data before forwarding', () => {
      bus1 = new EventBus();
      bus2 = new EventBus();
      const received = [];
      bus2.on('data', e => received.push(e.data));
      bus1.forward('data', bus2, event => ({ ...event.data, transformed: true }));
      bus1.emit('data', { val: 1 });
      expect(received).toEqual([{ val: 1, transformed: true }]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('unsubscribes when unsubscribe function is called', () => {
      bus1 = new EventBus();
      bus2 = new EventBus();
      const received = [];
      bus2.on('x', e => received.push(e.data));
      const unsub = bus1.forward('x', bus2);
      unsub();
      bus1.emit('x', { msg: 'after unsub' });
      expect(received).toEqual([]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('throws on invalid targetBus', () => {
      bus1 = new EventBus();
      expect(() => bus1.forward('ch', null)).toThrow(TypeError);
      expect(() => bus1.forward('ch', {})).toThrow(TypeError);
      bus1.removeAllListeners();
    });

    it('pipes multiple events in order', () => {
      bus1 = new EventBus();
      bus2 = new EventBus();
      const received = [];
      bus2.on('ev', e => received.push(e.data));
      bus1.forward('ev', bus2);
      bus1.emit('ev', 1);
      bus1.emit('ev', 2);
      bus1.emit('ev', 3);
      expect(received).toEqual([1, 2, 3]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });
  });
});

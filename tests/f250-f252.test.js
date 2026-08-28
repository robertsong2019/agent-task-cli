const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 65: F250 Cache.incrByFloat / F251 Storage.sample / F252 EventBus.replayLast', () => {
  describe('F250: Cache.incrByFloat(key, amount)', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    test('missing key starts from 0 and stores the amount', () => {
      expect(cache.incrByFloat('k', 0.25)).toBe(0.25);
      expect(cache.get('k')).toBe(0.25);
    });

    test('adds to an existing float value', () => {
      cache.set('k', 1.5, 0);
      expect(cache.incrByFloat('k', 0.25)).toBe(1.75);
      expect(cache.get('k')).toBe(1.75);
    });

    test('negative amount decrements', () => {
      cache.set('k', 2.5, 0);
      expect(cache.incrByFloat('k', -1.25)).toBe(1.25);
    });

    test('works on integer values too', () => {
      cache.set('k', 2, 0);
      expect(cache.incrByFloat('k', 0.5)).toBe(2.5);
    });

    test('throws TypeError when current value is not a finite number', () => {
      cache.set('k', 'not-a-number', 0);
      expect(() => cache.incrByFloat('k', 1)).toThrow(TypeError);
      cache.set('inf', Infinity, 0);
      expect(() => cache.incrByFloat('inf', 1)).toThrow(TypeError);
    });

    test('throws TypeError for non-finite amount', () => {
      expect(() => cache.incrByFloat('k', NaN)).toThrow(TypeError);
      expect(() => cache.incrByFloat('k', Infinity)).toThrow(TypeError);
      expect(() => cache.incrByFloat('k', '0.5')).toThrow(TypeError);
    });
  });

  describe('F251: Storage.sample(n, rng?)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-sample-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', priority: 1 });
      await storage.saveTask('t2', { title: 'B', priority: 2 });
      await storage.saveTask('t3', { title: 'C', priority: 3 });
      await storage.saveTask('t4', { title: 'D', priority: 4 });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('returns n distinct full task objects with id', async () => {
      const got = await storage.sample(2);
      expect(got).toHaveLength(2);
      const ids = got.map((t) => t.id);
      expect(new Set(ids).size).toBe(2);
      for (const t of got) {
        expect(t).toMatchObject({ title: expect.any(String), priority: expect.any(Number) });
      }
    });

    test('is deterministic with an injected rng', async () => {
      const makeRng = (seq) => {
        let i = 0;
        return () => seq[i++ % seq.length];
      };
      const a = await storage.sample(3, makeRng([0.9, 0.0, 0.5, 0.2]));
      const ids = a.map((t) => t.id);
      // deterministic: a fresh rng over the same sequence reproduces the sample
      const b = await storage.sample(3, makeRng([0.9, 0.0, 0.5, 0.2]));
      expect(b.map((t) => t.id)).toEqual(ids);
      // 3 distinct valid ids
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(['t1', 't2', 't3', 't4']).toContain(id);
      }
      const c = await storage.sample(3, () => 0); // rng=0 → identity → insertion-order prefix
      expect(c.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });

    test('n=0 and negative n return empty array', async () => {
      expect(await storage.sample(0)).toEqual([]);
      expect(await storage.sample(-3)).toEqual([]);
    });

    test('n larger than size returns all tasks (shuffled, distinct)', async () => {
      const got = await storage.sample(99, () => 0.5);
      expect(got).toHaveLength(4);
      expect(new Set(got.map((t) => t.id)).size).toBe(4);
    });

    test('fractional n is floored', async () => {
      expect(await storage.sample(2.9, () => 0)).toHaveLength(2);
    });

    test('throws TypeError for non-finite n', async () => {
      await expect(storage.sample('two')).rejects.toThrow(TypeError);
      await expect(storage.sample(NaN)).rejects.toThrow(TypeError);
      await expect(storage.sample(Infinity)).rejects.toThrow(TypeError);
    });
  });

  describe('F252: EventBus.replayLast(channel, handler)', () => {
    let bus;

    beforeEach(() => {
      bus = new EventBus();
    });

    test('no history → no immediate call; live events still delivered', () => {
      const seen = [];
      const unsub = bus.replayLast('task', (e) => seen.push(e));
      expect(seen).toHaveLength(0);
      bus.emit('task', { n: 1 });
      expect(seen).toHaveLength(1);
      expect(seen[0].data).toEqual({ n: 1 });
      unsub();
    });

    test('replays the most recent historical event immediately', () => {
      bus.emit('task', { n: 1 });
      bus.emit('task', { n: 2 });
      const seen = [];
      bus.replayLast('task', (e) => seen.push(e));
      expect(seen).toHaveLength(1);
      expect(seen[0].data).toEqual({ n: 2 });
      expect(seen[0].channel).toBe('task');
    });

    test('replay is exact-channel: other channels do not leak in', () => {
      bus.emit('other', { n: 1 });
      const seen = [];
      bus.replayLast('task', (e) => seen.push(e));
      expect(seen).toHaveLength(0);
    });

    test('replayed event arrives before live events (ordering)', () => {
      bus.emit('task', { n: 'old' });
      const order = [];
      bus.replayLast('task', (e) => order.push(e.data.n));
      bus.emit('task', { n: 'new' });
      expect(order).toEqual(['old', 'new']);
    });

    test('unsubscribe stops delivery', () => {
      bus.emit('task', { n: 1 });
      const seen = [];
      const unsub = bus.replayLast('task', (e) => seen.push(e));
      unsub();
      bus.emit('task', { n: 2 });
      expect(seen).toHaveLength(1); // only the replay
      expect(bus.listenerCount('task')).toBe(0);
    });

    test('throws TypeError when handler is not a function', () => {
      expect(() => bus.replayLast('task', null)).toThrow(TypeError);
      expect(() => bus.replayLast('task', 'nope')).toThrow(TypeError);
    });
  });
});

const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 67: F18b getOrSet single-flight / F113b pluck ids-param / F258 onceAll', () => {
  describe('F18b: Cache.getOrSet single-flight upgrade (F18 contract preserved)', () => {
    test('returns cached value without invoking loader', async () => {
      const cache = new Cache();
      cache.set('k', 'cached');
      let calls = 0;
      const v = await cache.getOrSet('k', () => { calls++; return 'fresh'; });
      expect(v).toBe('cached');
      expect(calls).toBe(0);
      cache.destroy();
    });

    test('computes, caches, and returns loader result on miss', async () => {
      const cache = new Cache();
      let calls = 0;
      const v = await cache.getOrSet('k', async () => { calls++; return 42; });
      expect(v).toBe(42);
      expect(calls).toBe(1);
      expect(cache.get('k')).toBe(42);
      cache.destroy();
    });

    test('single-flight: concurrent misses share one loader invocation', async () => {
      const cache = new Cache();
      let calls = 0;
      const loader = () => new Promise((resolve) => {
        calls++;
        setTimeout(() => resolve('once'), 20);
      });
      const [a, b, c] = await Promise.all([
        cache.getOrSet('k', loader),
        cache.getOrSet('k', loader),
        cache.getOrSet('k', loader),
      ]);
      expect(calls).toBe(1);
      expect(a).toBe('once');
      expect(b).toBe('once');
      expect(c).toBe('once');
      cache.destroy();
    });

    test('rejected loader leaves cache untouched and clears in-flight (retry works)', async () => {
      const cache = new Cache();
      const boom = () => Promise.reject(new Error('boom'));
      await expect(cache.getOrSet('k', boom)).rejects.toThrow('boom');
      expect(cache.has('k')).toBe(false);
      // in-flight entry cleared → next call invokes loader again
      const v = await cache.getOrSet('k', () => Promise.resolve('ok'));
      expect(v).toBe('ok');
      cache.destroy();
    });

    test('undefined loader result returned, treated as miss (factory re-invoked next call)', async () => {
      const cache = new Cache();
      let calls = 0;
      const v1 = await cache.getOrSet('k', () => { calls++; return undefined; });
      expect(v1).toBe(undefined);
      await cache.getOrSet('k', () => { calls++; return undefined; });
      expect(calls).toBe(2); // undefined never satisfies a getOrSet hit
      cache.destroy();
    });

    test('static value accepted as factory (F18 contract); TTL option respected', async () => {
      const cache = new Cache();
      const v = await cache.getOrSet('k', 'static', 5);
      expect(v).toBe('static');
      expect(cache.get('k')).toBe('static');
      expect(cache.ttl('k')).toBeGreaterThan(0);
      expect(cache.ttl('k')).toBeLessThanOrEqual(5);
      cache.destroy();
    });
  });

  describe('F113b: Storage.pluck(field, ids?) — ids-param upgrade', () => {
    let storage;
    let dir;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atc-f257-'));
      storage = new Storage(dir);
      await storage.saveTask('t1', { id: 't1', title: 'alpha', priority: 1 });
      await storage.saveTask('t2', { id: 't2', title: 'beta', priority: 2 });
      await storage.saveTask('t3', { id: 't3', title: 'gamma', priority: 2 });
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    test('extracts field values across all tasks, keeping duplicates', async () => {
      const values = await storage.pluck('priority');
      expect(values).toEqual([1, 2, 2]);
    });

    test('skips tasks missing the field', async () => {
      await storage.saveTask('t4', { id: 't4', title: 'delta' });
      const values = await storage.pluck('priority');
      expect(values).toEqual([1, 2, 2]);
    });

    test('with ids: follows ids order, skips missing ids', async () => {
      const values = await storage.pluck('title', ['t3', 'nope', 't1']);
      expect(values).toEqual(['gamma', 'alpha']);
    });

    test('with ids: skips tasks (in list) missing the field', async () => {
      await storage.saveTask('t4', { id: 't4', title: 'delta' });
      const values = await storage.pluck('priority', ['t1', 't4', 't2']);
      expect(values).toEqual([1, 2]);
    });

    test('empty result for unknown field / empty ids list', async () => {
      expect(await storage.pluck('nonexistent')).toEqual([]);
      expect(await storage.pluck('title', [])).toEqual([]);
    });

    test('throws TypeError for bad field / bad ids', async () => {
      await expect(storage.pluck('')).rejects.toThrow(TypeError);
      await expect(storage.pluck(42)).rejects.toThrow(TypeError);
      await expect(storage.pluck('title', 't1')).rejects.toThrow(TypeError);
    });
  });

  describe('F258: EventBus.onceAll(channels, timeout?)', () => {
    let bus;

    beforeEach(() => {
      bus = new EventBus();
    });

    test('resolves with events in channels order once all have emitted', async () => {
      const p = bus.onceAll(['a', 'b', 'c']);
      bus.emit('b', { n: 2 });
      bus.emit('c', { n: 3 });
      bus.emit('a', { n: 1 });
      const events = await p;
      expect(events.map((e) => e.channel)).toEqual(['a', 'b', 'c']);
      expect(events.map((e) => e.data.n)).toEqual([1, 2, 3]);
    });

    test('auto-unsubscribes after resolve (no further deliveries)', async () => {
      const p = bus.onceAll(['a', 'b']);
      bus.emit('a', { n: 1 });
      bus.emit('b', { n: 2 });
      await p;
      expect(bus.listenerCount('a')).toBe(0);
      expect(bus.listenerCount('b')).toBe(0);
    });

    test('ignores duplicate emissions from the same channel', async () => {
      const p = bus.onceAll(['a', 'b']);
      bus.emit('a', { n: 1 });
      bus.emit('a', { n: 'dup' });
      bus.emit('b', { n: 2 });
      const events = await p;
      expect(events.map((e) => e.data.n)).toEqual([1, 2]);
    });

    test('rejects on timeout listing channels that never fired', async () => {
      await expect(bus.onceAll(['a', 'b', 'c'], 30)).rejects.toThrow(/b, c/);
    });

    test('cleans up listeners after timeout rejection', async () => {
      await expect(bus.onceAll(['a', 'b'], 20)).rejects.toThrow();
      expect(bus.listenerCount('a')).toBe(0);
      expect(bus.listenerCount('b')).toBe(0);
    });

    test('rejects synchronously-shaped (rejected promise) for empty/invalid channels', async () => {
      await expect(bus.onceAll([])).rejects.toThrow(TypeError);
      await expect(bus.onceAll('not-an-array')).rejects.toThrow(TypeError);
    });
  });

  describe('R67 twin purge: active-behavior pins + Cache.swap expired-key contract', () => {
    test('swap on live key returns previous value and replaces (F143 contract)', () => {
      const cache = new Cache();
      cache.set('k', 'old');
      expect(cache.swap('k', 'new')).toBe('old');
      expect(cache.get('k')).toBe('new');
      cache.destroy();
    });

    test('swap on expired key returns undefined (treats as missing) — TTL-blind bug fixed', async () => {
      const cache = new Cache();
      cache.set('k', 'old', 10);
      await new Promise((r) => setTimeout(r, 20));
      // no has()/get() pre-touch: swap must handle expiry itself
      const old = cache.swap('k', 'new');
      expect(old).toBe(undefined);
      expect(cache.get('k')).toBe('new');
      cache.destroy();
    });

    test('keys() and size() exclude expired entries (surviving-twin pin)', async () => {
      const cache = new Cache();
      cache.set('live', 1);
      cache.set('dead', 2, 10);
      await new Promise((r) => setTimeout(r, 20));
      expect(cache.keys()).toEqual(['live']);
      expect(cache.size()).toBe(1);
      cache.destroy();
    });
  });
});

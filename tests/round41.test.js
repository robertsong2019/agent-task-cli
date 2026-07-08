const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const { Cache } = require('../src/utils/cache');
const { RetryHandler } = require('../src/utils/retry-handler');
const { PriorityQueue } = require('../src/utils/priority-queue');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F166: EventBus.pause(channel) / resume(channel)', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('paused channel buffers events without firing handlers', () => {
    const received = [];
    bus.on('test', (e) => received.push(e.data));
    bus.pause('test');
    bus.emit('test', { v: 1 });
    bus.emit('test', { v: 2 });
    expect(received).toHaveLength(0);
  });

  test('resume flushes all buffered events to handlers', () => {
    const received = [];
    bus.on('test', (e) => received.push(e.data.v));
    bus.pause('test');
    bus.emit('test', { v: 1 });
    bus.emit('test', { v: 2 });
    bus.resume('test');
    expect(received).toEqual([1, 2]);
  });

  test('after resume, new events fire immediately', () => {
    const received = [];
    bus.on('test', (e) => received.push(e.data.v));
    bus.pause('test');
    bus.emit('test', { v: 1 });
    bus.resume('test');
    bus.emit('test', { v: 2 });
    expect(received).toEqual([1, 2]);
  });

  test('pause on non-existent channel is a no-op', () => {
    expect(() => bus.pause('nope')).not.toThrow();
  });

  test('resume on non-paused channel is a no-op', () => {
    expect(() => bus.resume('nope')).not.toThrow();
  });

  test('isPaused(channel) reports pause state', () => {
    expect(bus.isPaused('test')).toBe(false);
    bus.pause('test');
    expect(bus.isPaused('test')).toBe(true);
    bus.resume('test');
    expect(bus.isPaused('test')).toBe(false);
  });
});

describe('F167: Storage.aggregate(field, fn, initial)', () => {
  let storage;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agg-test-'));
    storage = new Storage(tmpDir);
    storage.saveTaskSync('a', { id: 'a', score: 10, name: 'A' });
    storage.saveTaskSync('b', { id: 'b', score: 20, name: 'B' });
    storage.saveTaskSync('c', { id: 'c', score: 30, name: 'C' });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test('sums a numeric field', () => {
    const sum = storage.aggregate('score', (acc, v) => acc + v, 0);
    expect(sum).toBe(60);
  });

  test('finds max value', () => {
    const max = storage.aggregate('score', (acc, v) => Math.max(acc, v), -Infinity);
    expect(max).toBe(30);
  });

  test('works with string concatenation', () => {
    const concat = storage.aggregate('name', (acc, v) => acc + v, '');
    expect(concat).toBe('ABC');
  });

  test('returns initial value for empty storage', () => {
    const empty = new Storage(tmpDir + '-empty');
    expect(empty.aggregate('score', (acc, v) => acc + v, 0)).toBe(0);
  });

  test('skips tasks where field is undefined', () => {
    storage.saveTaskSync('d', { id: 'd', name: 'D' }); // no score
    const sum = storage.aggregate('score', (acc, v) => acc + v, 0);
    expect(sum).toBe(60); // d.score is undefined, skipped
  });
});

describe('F168: ConcurrencyManager.allSettled(items, fn, concurrency?)', () => {
  test('returns all results and errors, never rejects', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const items = [1, 2, 3, 4, 5];
    const fn = async (x) => {
      if (x === 3) throw new Error('three is bad');
      return x * 10;
    };
    const results = await cm.allSettled(items, fn, 2);
    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 20 });
    expect(results[2]).toEqual({ status: 'rejected', reason: expect.any(Error) });
    expect(results[3]).toEqual({ status: 'fulfilled', value: 40 });
    expect(results[4]).toEqual({ status: 'fulfilled', value: 50 });
  });

  test('respects concurrency limit', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4];
    const fn = async (x) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 30));
      active--;
      return x;
    };
    await cm.allSettled(items, fn, 1);
    expect(maxActive).toBe(1);
  });

  test('empty items array returns empty results', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const results = await cm.allSettled([], async (x) => x, 2);
    expect(results).toEqual([]);
  });

  test('default concurrency uses maxConcurrent from constructor', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 3 });
    const items = [1, 2, 3];
    const fn = async (x) => x * 2;
    const results = await cm.allSettled(items, fn);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    expect(results.map(r => r.value)).toEqual([2, 4, 6]);
  });

  test('all rejected returns all rejected', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const fn = async () => { throw new Error('always'); };
    const results = await cm.allSettled([1, 2], fn, 2);
    expect(results.every(r => r.status === 'rejected')).toBe(true);
  });
});

describe('F169: Cache.msetnx(entries, ttl?)', () => {
  test('sets all keys when none exist', () => {
    const cache = new Cache();
    const result = cache.msetnx({ a: 1, b: 2, c: 3 });
    expect(result).toBe(true);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  test('returns false if any key already exists', () => {
    const cache = new Cache();
    cache.set('a', 99);
    const result = cache.msetnx({ a: 1, b: 2 });
    expect(result).toBe(false);
    // Original value preserved
    expect(cache.get('a')).toBe(99);
    // b should NOT be set (atomic)
    expect(cache.get('b')).toBeUndefined();
  });

  test('returns false if single key exists among many', () => {
    const cache = new Cache();
    cache.set('x', 'exists');
    const result = cache.msetnx({ a: 1, b: 2, x: 3 });
    expect(result).toBe(false);
    expect(cache.get('a')).toBeUndefined();
  });

  test('respects TTL parameter', () => {
    const cache = new Cache();
    cache.msetnx({ a: 1 }, 50);
    expect(cache.get('a')).toBe(1);
    // Wait for expiry
    return new Promise(resolve => {
      setTimeout(() => {
        expect(cache.get('a')).toBeUndefined();
        resolve();
      }, 120);
    });
  });

  test('empty entries object returns true', () => {
    const cache = new Cache();
    expect(cache.msetnx({})).toBe(true);
  });
});

describe('F170: RetryHandler.retryIf(fn, predicate, retries?)', () => {
  test('returns immediately when predicate is satisfied on first try', async () => {
    const rh = new RetryHandler();
    const fn = jest.fn().mockResolvedValue(5);
    const result = await rh.retryIf(fn, (v) => v >= 3);
    expect(result).toBe(5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries when predicate returns false', async () => {
    const rh = new RetryHandler();
    let count = 0;
    const fn = jest.fn().mockImplementation(async () => ++count);
    const result = await rh.retryIf(fn, (v) => v >= 3, 5);
    expect(result).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('throws when max retries exhausted without satisfying predicate', async () => {
    const rh = new RetryHandler();
    const fn = jest.fn().mockResolvedValue(1);
    await expect(rh.retryIf(fn, (v) => v >= 100, 3)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  test('retries on error and then checks predicate', async () => {
    const rh = new RetryHandler();
    let count = 0;
    const fn = jest.fn().mockImplementation(async () => {
      count++;
      if (count < 2) throw new Error('timeout'); // retryable
      return 'ok';
    });
    const result = await rh.retryIf(fn, (v) => v === 'ok', 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('default retries to maxRetries from constructor', async () => {
    const rh = new RetryHandler({ maxRetries: 2 });
    let count = 0;
    const fn = jest.fn().mockImplementation(async () => ++count);
    await expect(rh.retryIf(fn, (v) => v >= 100)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('F171: PriorityQueue.drainUntil(predicate)', () => {
  test('drains items while predicate holds (lower priority = dequeued first)', () => {
    const pq = new PriorityQueue();
    // Priority 1 is highest (dequeued first), 5 is lowest
    pq.enqueue('a', 1);  // first out
    pq.enqueue('b', 2);
    pq.enqueue('c', 3);
    pq.enqueue('d', 5);  // last out
    // drainUntil drains from front (highest priority = lowest number)
    // predicate: priority <= 3 → drains a(1), b(2), c(3), stops at d(5)
    const drained = pq.drainUntil((item, priority) => priority <= 3);
    expect(drained.map(d => d.item)).toEqual(['a', 'b', 'c']);
    expect(pq.size).toBe(1); // 'd' remains
  });

  test('stops at first item that fails predicate', () => {
    const pq = new PriorityQueue();
    pq.enqueue('high', 1);   // first out, passes
    pq.enqueue('mid', 3);    // second out, fails predicate
    pq.enqueue('low', 5);    // never reached
    const drained = pq.drainUntil((item, priority) => priority <= 2);
    expect(drained.map(d => d.item)).toEqual(['high']);
    expect(pq.size).toBe(2);
  });

  test('returns empty array for empty queue', () => {
    const pq = new PriorityQueue();
    expect(pq.drainUntil(() => true)).toEqual([]);
  });

  test('returns empty array when predicate always false', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    expect(pq.drainUntil(() => false)).toEqual([]);
    expect(pq.size).toBe(2); // nothing removed
  });

  test('drains all when predicate always true', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    pq.enqueue('c', 3);
    const drained = pq.drainUntil(() => true);
    expect(drained).toHaveLength(3);
    expect(pq.size).toBe(0);
  });

  test('predicate receives item and priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    const seen = [];
    pq.drainUntil((item, priority) => {
      seen.push({ item, priority });
      return true;
    });
    expect(seen).toHaveLength(2);
  });
});

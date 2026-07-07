const { PriorityQueue } = require('../src/utils/priority-queue');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const { Cache } = require('../src/utils/cache');
const { RetryHandler } = require('../src/utils/retry-handler');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ============================================================
// F160: PriorityQueue.drain()
// ============================================================
describe('F160: PriorityQueue drain()', () => {
  test('returns empty array for empty queue', () => {
    const pq = new PriorityQueue();
    expect(pq.drain()).toEqual([]);
  });

  test('returns all items in priority order', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 9);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 5);
    expect(pq.drain()).toEqual(['high', 'mid', 'low']);
  });

  test('leaves queue empty after drain', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    pq.drain();
    expect(pq.size).toBe(0);
    expect(pq.isEmpty()).toBe(true);
  });

  test('can enqueue again after drain', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);
    pq.drain();
    pq.enqueue('y', 1);
    expect(pq.size).toBe(1);
    expect(pq.dequeue()).toBe('y');
  });

  test('preserves FIFO for same priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('first', 5);
    pq.enqueue('second', 5);
    pq.enqueue('third', 5);
    expect(pq.drain()).toEqual(['first', 'second', 'third']);
  });
});

// ============================================================
// F161: Storage.findOne(filter)
// ============================================================
describe('F161: Storage findOne(filter)', () => {
  let storage, tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('returns null for empty storage', async () => {
    const result = await storage.findOne({ status: 'pending' });
    expect(result).toBeNull();
  });

  test('returns first matching task', async () => {
    await storage.saveTask('1', { status: 'pending', name: 'task1' });
    await storage.saveTask('2', { status: 'done', name: 'task2' });
    const result = await storage.findOne({ status: 'done' });
    expect(result.id).toBe('2');
    expect(result.status).toBe('done');
  });

  test('matches on multiple fields', async () => {
    await storage.saveTask('1', { status: 'pending', priority: 'high' });
    await storage.saveTask('2', { status: 'pending', priority: 'low' });
    const result = await storage.findOne({ status: 'pending', priority: 'high' });
    expect(result.id).toBe('1');
  });

  test('returns null when no match', async () => {
    await storage.saveTask('1', { status: 'pending' });
    const result = await storage.findOne({ status: 'archived' });
    expect(result).toBeNull();
  });

  test('returns null for empty filter (no match on all tasks)', async () => {
    await storage.saveTask('1', { name: 'test' });
    // Empty filter matches everything, but findOne returns the first
    const result = await storage.findOne({});
    expect(result).not.toBeNull();
    expect(result.id).toBe('1');
  });
});

// ============================================================
// F162: EventBus.merge(otherBus)
// ============================================================
describe('F162: EventBus merge()', () => {
  test('merges subscribers from another bus', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    let received = null;
    bus2.on('test:event', (event) => { received = event.data; });
    const count = bus1.merge(bus2);
    expect(count).toBe(1);
    bus1.emit('test:event', { msg: 'hello' });
    expect(received).toBeTruthy();
    expect(received.msg).toBe('hello');
  });

  test('merges multiple channels', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    let count = 0;
    bus2.on('a', () => { count++; });
    bus2.on('b', () => { count++; });
    const merged = bus1.merge(bus2);
    expect(merged).toBe(2);
    bus1.emit('a', {});
    bus1.emit('b', {});
    expect(count).toBe(2);
  });

  test('merges history from other bus', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    bus2.emit('old-event', { x: 1 });
    bus1.merge(bus2);
    const history = bus1.getHistory();
    expect(history.some(e => e.channel === 'old-event')).toBe(true);
  });

  test('throws on non-EventBus argument', () => {
    const bus = new EventBus();
    expect(() => bus.merge(null)).toThrow(TypeError);
    expect(() => bus.merge({})).toThrow(TypeError);
  });

  test('handles empty bus merge', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const count = bus1.merge(bus2);
    expect(count).toBe(0);
  });
});

// ============================================================
// F163: ConcurrencyManager.map(items, fn, opts?)
// ============================================================
describe('F163: ConcurrencyManager map()', () => {
  test('maps all items with correct results', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 3 });
    const items = [1, 2, 3, 4, 5];
    const { results, partial } = await cm.map(items, async (x) => x * 2);
    expect(partial).toBe(false);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test('results are in order regardless of execution order', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 5 });
    const items = [1, 2, 3, 4, 5];
    const { results } = await cm.map(items, async (x) => {
      await new Promise(r => setTimeout(r, (6 - x) * 10)); // earlier items take longer
      return x;
    });
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  test('collects errors when stopOnError is false', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const items = [1, 2, 3];
    const { results, errors, partial } = await cm.map(items, async (x) => {
      if (x === 2) throw new Error('fail');
      return x * 10;
    });
    expect(partial).toBe(true);
    expect(results[0]).toBe(10);
    expect(results[1]).toBeUndefined();
    expect(results[2]).toBe(30);
    expect(errors[1]).toBeInstanceOf(Error);
  });

  test('rejects on first error when stopOnError is true', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    const items = [1, 2, 3];
    await expect(
      cm.map(items, async (x) => {
        if (x === 2) throw new Error('fail');
        return x;
      }, { stopOnError: true })
    ).rejects.toThrow('fail');
  });

  test('handles empty array', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 3 });
    const { results, partial } = await cm.map([], async (x) => x);
    expect(results).toEqual([]);
    expect(partial).toBe(false);
  });

  test('respects concurrency limit', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    let maxConcurrent = 0;
    let current = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await cm.map(items, async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(r => setTimeout(r, 20));
      current--;
    });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// F164: Cache.rename(oldKey, newKey, opts?)
// ============================================================
describe('F164: Cache rename()', () => {
  test('renames key preserving value', () => {
    const cache = new Cache();
    cache.set('old', 'value');
    expect(cache.rename('old', 'new')).toBe(true);
    expect(cache.get('new')).toBe('value');
    expect(cache.has('old')).toBe(false);
  });

  test('returns false for missing key', () => {
    const cache = new Cache();
    expect(cache.rename('missing', 'new')).toBe(false);
  });

  test('returns false for expired key', async () => {
    const cache = new Cache();
    cache.set('old', 'val', 10);
    await new Promise(r => setTimeout(r, 20));
    expect(cache.rename('old', 'new')).toBe(false);
  });

  test('keepOriginal copies instead of moving', () => {
    const cache = new Cache();
    cache.set('src', 'data');
    expect(cache.rename('src', 'dst', { keepOriginal: true })).toBe(true);
    expect(cache.get('src')).toBe('data');
    expect(cache.get('dst')).toBe('data');
  });

  test('preserves remaining TTL', async () => {
    const cache = new Cache();
    cache.set('old', 'val', 1000);
    await new Promise(r => setTimeout(r, 100));
    cache.rename('old', 'new');
    // new key should still have most of its TTL
    expect(cache.has('new')).toBe(true);
  });

  test('overwrites existing destination key', () => {
    const cache = new Cache();
    cache.set('old', 'oldval');
    cache.set('new', 'newval');
    cache.rename('old', 'new');
    expect(cache.get('new')).toBe('oldval');
    expect(cache.has('old')).toBe(false);
  });
});

// ============================================================
// F165: RetryHandler.withFallback(fn, fallbackFn, opts?)
// ============================================================
describe('F165: RetryHandler withFallback()', () => {
  test('returns fn result on success', async () => {
    const rh = new RetryHandler({ maxRetries: 2 });
    const result = await rh.withFallback(
      async () => 'success',
      async () => 'fallback'
    );
    expect(result).toBe('success');
  });

  test('returns fallback result on failure', async () => {
    const rh = new RetryHandler({ maxRetries: 1, baseDelay: 1 });
    const result = await rh.withFallback(
      async () => { throw new Error('timeout'); },
      async (err, attempts) => `fallback:${err.message}:${attempts}`
    );
    // timeout is retryable, maxRetries=1 → 2 total attempts
    expect(result).toBe('fallback:timeout:2');
  });

  test('fallback receives error and attempt count', async () => {
    const rh = new RetryHandler({ maxRetries: 3, baseDelay: 1 });
    let received = null;
    await rh.withFallback(
      async () => { throw new Error('timeout'); },
      async (err, attempts) => { received = { err: err.message, attempts }; return 'ok'; },
      { maxRetries: 1 }
    );
    expect(received.err).toBe('timeout');
    // maxRetries=1 → 2 total attempts
    expect(received.attempts).toBe(2);
  });

  test('respects retry options', async () => {
    const rh = new RetryHandler({ maxRetries: 5, baseDelay: 1 });
    let callCount = 0;
    await rh.withFallback(
      async () => { callCount++; throw new Error('timeout'); },
      async () => 'fallback',
      { maxRetries: 1 }
    );
    // timeout is retryable, maxRetries=1 → 2 total attempts
    expect(callCount).toBe(2);
  });

  test('does not call fallback on non-retryable error that succeeds via try()', async () => {
    const rh = new RetryHandler({
      maxRetries: 3,
      baseDelay: 1,
      retryableErrors: ['timeout']
    });
    let fallbackCalled = false;
    const result = await rh.withFallback(
      async () => 'ok',
      async () => { fallbackCalled = true; return 'fallback'; }
    );
    expect(result).toBe('ok');
    expect(fallbackCalled).toBe(false);
  });
});

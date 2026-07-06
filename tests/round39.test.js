const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ─── F157: Storage.paginate ───
describe('F157: Storage.paginate', () => {
  let storage;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-paginate-'));
    storage = new Storage(tmpDir);
    // Seed 25 tasks
    for (let i = 1; i <= 25; i++) {
      await storage.saveTask(`task-${i}`, {
        name: `Task ${i}`,
        status: i <= 10 ? 'done' : 'pending',
        priority: i,
        createdAt: new Date(2026, 0, i).toISOString()
      });
    }
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns correct page metadata', async () => {
    const result = await storage.paginate(1, 10);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(10);
  });

  test('last page has hasMore=false', async () => {
    const result = await storage.paginate(3, 10);
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  test('throws on page < 1', async () => {
    await expect(storage.paginate(0, 10)).rejects.toThrow('page must be >= 1');
  });

  test('throws on pageSize < 1', async () => {
    await expect(storage.paginate(1, 0)).rejects.toThrow('pageSize must be >= 1');
  });

  test('filters by status', async () => {
    const result = await storage.paginate(1, 5, { status: 'done' });
    expect(result.total).toBe(10);
    expect(result.items.every(t => t.status === 'done')).toBe(true);
  });

  test('sorts by custom field ascending', async () => {
    const result = await storage.paginate(1, 5, { sortBy: 'priority', order: 'asc' });
    const priorities = result.items.map(t => t.priority);
    expect(priorities).toEqual([1, 2, 3, 4, 5]);
  });

  test('sorts by custom field descending', async () => {
    const result = await storage.paginate(1, 5, { sortBy: 'priority', order: 'desc' });
    const priorities = result.items.map(t => t.priority);
    expect(priorities).toEqual([25, 24, 23, 22, 21]);
  });

  test('empty storage returns empty items', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-paginate-'));
    const emptyStorage = new Storage(emptyDir);
    const result = await emptyStorage.paginate(1, 10);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.hasMore).toBe(false);
    await fs.rm(emptyDir, { recursive: true, force: true });
  });
});

// ─── F158: EventBus.emitWithRetry ───
describe('F158: EventBus.emitWithRetry', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('delivers to all handlers on success', async () => {
    const results = [];
    bus.on('test', async () => { results.push('a'); });
    bus.on('test', async () => { results.push('b'); });
    const res = await bus.emitWithRetry('test', { x: 1 }, 2);
    expect(res.delivered).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.errors).toEqual([]);
    expect(results).toEqual(['a', 'b']);
  });

  test('retries failing handler and succeeds on final attempt', async () => {
    let calls = 0;
    bus.on('flaky', async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
    });
    const res = await bus.emitWithRetry('flaky', {}, 3);
    expect(res.delivered).toBe(1);
    expect(res.failed).toBe(0);
    expect(calls).toBe(3);
  });

  test('reports failure after retries exhausted', async () => {
    bus.on('always-fail', async () => { throw new Error('boom'); });
    const res = await bus.emitWithRetry('always-fail', {}, 1);
    expect(res.delivered).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errors[0].error).toBe('boom');
  });

  test('mixed success and failure handlers', async () => {
    bus.on('mixed', async () => {});
    bus.on('mixed', async () => { throw new Error('nope'); });
    const res = await bus.emitWithRetry('mixed', {}, 0);
    expect(res.delivered).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors[0].error).toBe('nope');
  });

  test('throws on invalid channel', async () => {
    await expect(bus.emitWithRetry('', {}, 2)).rejects.toThrow('non-empty string');
  });

  test('throws on negative retries', async () => {
    await expect(bus.emitWithRetry('test', {}, -1)).rejects.toThrow('retries must be >= 0');
  });

  test('stores event in history', async () => {
    await bus.emitWithRetry('hist-test', { val: 42 }, 0);
    const history = bus._history.filter(e => e.channel === 'hist-test');
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].data.val).toBe(42);
  });
});

// ─── F159: Cache.touchMany ───
describe('F159: Cache.touchMany', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('refreshes TTL for multiple existing keys', () => {
    cache.set('a', 1, 5000);
    cache.set('b', 2, 5000);
    cache.set('c', 3, 5000);
    const refreshed = cache.touchMany(['a', 'b', 'c'], 30000);
    expect(refreshed).toBe(3);
  });

  test('skips non-existent keys', () => {
    cache.set('a', 1);
    const refreshed = cache.touchMany(['a', 'nope', 'nada']);
    expect(refreshed).toBe(1);
  });

  test('skips expired keys', () => {
    cache.set('old', 'val', 1); // 1ms TTL
    // Wait for expiry
    return new Promise(resolve => {
      setTimeout(() => {
        const refreshed = cache.touchMany(['old'], 60000);
        expect(refreshed).toBe(0);
        resolve();
      }, 10);
    });
  });

  test('uses default TTL when not specified', () => {
    cache.set('x', 'val', 1000);
    const refreshed = cache.touchMany(['x']);
    expect(refreshed).toBe(1);
  });

  test('returns 0 for empty array', () => {
    expect(cache.touchMany([])).toBe(0);
  });

  test('throws on non-array input', () => {
    expect(() => cache.touchMany('not-array')).toThrow('keys must be an array');
  });

  test('mixed existing, missing, and expired keys', () => {
    cache.set('good', 1, 60000);
    cache.set('expiring', 2, 1);
    return new Promise(resolve => {
      setTimeout(() => {
        const refreshed = cache.touchMany(['good', 'expiring', 'missing'], 60000);
        expect(refreshed).toBe(1); // only 'good'
        resolve();
      }, 10);
    });
  });
});

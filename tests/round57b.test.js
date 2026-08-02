/**
 * Round 57 Part 2: F222 Cache.expireAll + F223 Cache.oldest
 *           + Storage.batchDelete + EventBus.listenerCount
 */
const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Cache.expireAll (F222) ---
describe('F222: Cache.expireAll', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
  afterEach(() => { cache.destroy(); });

  test('expires all entries with TTL', () => {
    cache.set('a', 1, 5000);
    cache.set('b', 2, 5000);
    cache.set('c', 3, 5000);
    const expired = cache.expireAll();
    expect(expired).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
  });

  test('keeps entries without TTL (null expiresAt)', () => {
    cache.setWithExpiry('perm', 'forever', null);
    cache.set('temp', 'short', 5000);
    const expired = cache.expireAll();
    expect(expired).toBe(1);
    expect(cache.get('perm')).toBe('forever');
  });

  test('returns 0 for empty cache', () => {
    expect(cache.expireAll()).toBe(0);
  });

  test('updates stats.size after expiry', () => {
    cache.set('a', 1, 5000);
    cache.set('b', 2, 5000);
    cache.expireAll();
    expect(cache.stats.size).toBe(0);
  });
});

// --- Cache.oldest (F223) ---
describe('F223: Cache.oldest', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
  afterEach(() => { cache.destroy(); });

  test('returns the key with oldest lastAccessed', () => {
    cache.set('first', 1);
    // small delay to ensure different lastAccessed
    const start = Date.now();
    while (Date.now() === start) {} // busy wait ~1ms
    cache.set('second', 2);
    expect(cache.oldest()).toBe('first');
  });

  test('returns undefined for empty cache', () => {
    expect(cache.oldest()).toBeUndefined();
  });

  test('excludes expired entries', () => {
    cache.set('old', 1, 50);
    cache.set('new', 2);
    return new Promise(r => setTimeout(r, 80)).then(() => {
      expect(cache.oldest()).toBe('new');
    });
  });

  test('single entry returns that key', () => {
    cache.set('only', 42);
    expect(cache.oldest()).toBe('only');
  });
});

// --- Storage.batchDelete ---
describe('Storage.batchDelete', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atc-test-'));
    storage = new Storage(tmpDir);
    // Seed with some tasks
    await storage.saveTask('t1', { name: 'task1' });
    await storage.saveTask('t2', { name: 'task2' });
    await storage.saveTask('t3', { name: 'task3' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('deletes multiple tasks by ID', async () => {
    const deleted = await storage.batchDelete(['t1', 't2']);
    expect(deleted).toBe(2);
    expect(await storage.getTask('t1')).toBeNull();
    expect(await storage.getTask('t2')).toBeNull();
    expect(await storage.getTask('t3')).not.toBeNull();
  });

  test('skips non-existent IDs', async () => {
    const deleted = await storage.batchDelete(['t1', 'missing']);
    expect(deleted).toBe(1);
  });

  test('returns 0 for empty array', async () => {
    expect(await storage.batchDelete([])).toBe(0);
  });

  test('returns 0 for non-array input', async () => {
    expect(await storage.batchDelete(null)).toBe(0);
    expect(await storage.batchDelete('t1')).toBe(0);
  });

  test('deleting all tasks leaves empty storage', async () => {
    await storage.batchDelete(['t1', 't2', 't3']);
    const tasks = await storage.loadTasks();
    expect(Object.keys(tasks)).toHaveLength(0);
  });
});

// --- EventBus.listenerCount ---
describe('EventBus.listenerCount', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('returns 0 for channel with no listeners', () => {
    expect(bus.listenerCount('evt')).toBe(0);
  });

  test('returns correct count after adding listeners', () => {
    bus.on('evt', () => {});
    bus.on('evt', () => {});
    expect(bus.listenerCount('evt')).toBe(2);
  });

  test('returns correct count after removing a listener', () => {
    const unsub = bus.on('evt', () => {});
    bus.on('evt', () => {});
    unsub();
    expect(bus.listenerCount('evt')).toBe(1);
  });

  test('tracks channels independently', () => {
    bus.on('a', () => {});
    bus.on('b', () => {});
    bus.on('b', () => {});
    expect(bus.listenerCount('a')).toBe(1);
    expect(bus.listenerCount('b')).toBe(2);
  });

  test('once listeners are counted before firing', () => {
    bus.once('evt', () => {});
    expect(bus.listenerCount('evt')).toBe(1);
    bus.emit('evt', {});
    // after firing, once listener should be removed
    // Note: this depends on EventEmitter internals
  });
});

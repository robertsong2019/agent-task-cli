/**
 * Round 57: F218 Cache.withExpiry + F219 Cache.getEntries + F220 Cache.size
 *           + Storage.findOrCreate + EventBus.emitWithRetry
 */
const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Cache.withExpiry (F218) ---
describe('F218: Cache.withExpiry', () => {
  let cache;
  beforeEach(() => { cache = new Cache(); });
  afterEach(() => { cache.destroy(); });

  test('sets with absolute expiry and returns this for chaining', () => {
    const future = Date.now() + 5000;
    const result = cache.withExpiry('k', 'v', future);
    expect(result).toBe(cache); // chaining
    expect(cache.get('k')).toBe('v');
  });

  test('expired key returns undefined', () => {
    cache.withExpiry('k', 'v', Date.now() - 100);
    expect(cache.get('k')).toBeUndefined();
  });

  test('null expiry means never expire', () => {
    cache.withExpiry('k', 'v', null);
    expect(cache.get('k')).toBe('v');
  });
});

// --- Cache.getEntries (F219) ---
describe('F219: Cache.getEntries', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
  afterEach(() => { cache.destroy(); });

  test('returns all non-expired entries as pairs', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const entries = cache.getEntries();
    expect(entries).toHaveLength(2);
    const keys = entries.map(e => e[0]).sort();
    expect(keys).toEqual(['a', 'b']);
  });

  test('each entry has value, createdAt, lastAccessed, expiresAt', () => {
    cache.set('x', 'val');
    const [, entry] = cache.getEntries()[0];
    expect(entry.value).toBe('val');
    expect(typeof entry.createdAt).toBe('number');
    expect(typeof entry.lastAccessed).toBe('number');
  });

  test('filters by wildcard pattern', () => {
    cache.set('user:1', 'alice');
    cache.set('user:2', 'bob');
    cache.set('admin:1', 'carol');
    const userEntries = cache.getEntries('user:*');
    expect(userEntries).toHaveLength(2);
  });

  test('returns empty array for empty cache', () => {
    expect(cache.getEntries()).toEqual([]);
  });

  test('excludes expired entries', () => {
    cache.set('old', 'val', 50);
    cache.set('new', 'val2');
    return new Promise(r => setTimeout(r, 80)).then(() => {
      const entries = cache.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe('new');
    });
  });
});

// --- Cache.size (F220) ---
describe('F220: Cache.size', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
  afterEach(() => { cache.destroy(); });

  test('returns 0 for empty cache', () => {
    expect(cache.size()).toBe(0);
  });

  test('returns count of active entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size()).toBe(3);
  });

  test('excludes expired entries', () => {
    cache.set('a', 1, 50);
    cache.set('b', 2);
    return new Promise(r => setTimeout(r, 80)).then(() => {
      expect(cache.size()).toBe(1);
    });
  });
});

// --- Storage.findOrCreate (F218-s) ---
describe('Storage.findOrCreate', () => {
  let tmpDir, storage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atc-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates task when it does not exist', async () => {
    const task = await storage.findOrCreate('t1', { name: 'test', status: 'pending' });
    expect(task.id).toBe('t1');
    expect(task.name).toBe('test');
    expect(task.createdAt).toBeDefined();
  });

  test('returns existing task without overwriting', async () => {
    await storage.saveTask('t1', { name: 'original', status: 'done' });
    const task = await storage.findOrCreate('t1', { name: 'should-not-override' });
    expect(task.name).toBe('original');
    expect(task.status).toBe('done');
  });

  test('works with empty defaults', async () => {
    const task = await storage.findOrCreate('t2');
    expect(task.id).toBe('t2');
  });
});

// --- EventBus.emitSync (F221) ---
describe('EventBus.emitSync', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('synchronously emits and returns count of handlers fired', () => {
    bus.on('evt', () => {});
    bus.on('evt', () => {});
    const count = bus.emitSync('evt', { x: 1 });
    expect(count).toBe(2);
  });

  test('returns 0 for channel with no listeners', () => {
    expect(bus.emitSync('nope', {})).toBe(0);
  });

  test('fire handlers synchronously (no await)', () => {
    let called = false;
    bus.on('evt', () => { called = true; });
    bus.emitSync('evt', {});
    expect(called).toBe(true);
  });

  test('stores event in history', () => {
    bus.on('evt', () => {});
    bus.emitSync('evt', { msg: 'hi' });
    expect(bus._history).toHaveLength(1);
    expect(bus._history[0].channel).toBe('evt');
  });

  test('default data is empty object', () => {
    bus.on('evt', (event) => {
      expect(event.data).toEqual({});
    });
    bus.emitSync('evt');
  });
});

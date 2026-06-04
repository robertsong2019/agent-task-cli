const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

// --- F103: Cache.type(key) ---
describe('F103: Cache.type(key)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ ttl: 60000 }); });

  test('returns "string" for string values', () => {
    cache.set('s', 'hello');
    expect(cache.type('s')).toBe('string');
  });

  test('returns "number" for numeric values', () => {
    cache.set('n', 42);
    expect(cache.type('n')).toBe('number');
  });

  test('returns "boolean" for boolean values', () => {
    cache.set('b', true);
    expect(cache.type('b')).toBe('boolean');
  });

  test('returns "object" for plain objects', () => {
    cache.set('o', { a: 1 });
    expect(cache.type('o')).toBe('object');
  });

  test('returns "array" for arrays', () => {
    cache.set('arr', [1, 2, 3]);
    expect(cache.type('arr')).toBe('array');
  });

  test('returns "null" for null values', () => {
    cache.set('nil', null);
    expect(cache.type('nil')).toBe('null');
  });

  test('returns "undefined" for missing keys', () => {
    expect(cache.type('nonexistent')).toBe('undefined');
  });

  test('returns "undefined" for expired keys', () => {
    cache.set('exp', 'value', 1); // 1ms TTL
    return new Promise(r => setTimeout(r, 10)).then(() => {
      expect(cache.type('exp')).toBe('undefined');
    });
  });
});

// --- F104: EventBus.eventNames() ---
describe('F104: EventBus.eventNames()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus({ history: true }); });

  test('returns empty array when no events emitted', () => {
    expect(bus.eventNames()).toEqual([]);
  });

  test('returns single channel name after one emit', () => {
    bus.emit('click', { x: 1 });
    expect(bus.eventNames()).toEqual(['click']);
  });

  test('returns unique channel names after multiple emits', () => {
    bus.emit('click', {});
    bus.emit('hover', {});
    bus.emit('click', {});
    bus.emit('scroll', {});
    const names = bus.eventNames();
    expect(names.sort()).toEqual(['click', 'hover', 'scroll']);
  });

  test('returns empty after clearHistory', () => {
    bus.emit('a', {});
    bus.emit('b', {});
    expect(bus.eventNames().length).toBe(2);
    bus.clearHistory();
    expect(bus.eventNames()).toEqual([]);
  });
});

// --- F105: Storage.bulkDelete(ids[]) ---
describe('F105: Storage.bulkDelete(ids[])', () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { id: 't1', status: 'pending' });
    await storage.saveTask('t2', { id: 't2', status: 'done' });
    await storage.saveTask('t3', { id: 't3', status: 'pending' });
    await storage.saveTask('t4', { id: 't4', status: 'done' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('deletes multiple existing tasks', async () => {
    const count = await storage.bulkDelete(['t1', 't2']);
    expect(count).toBe(2);
    const remaining = await storage.ids();
    expect(remaining.sort()).toEqual(['t3', 't4']);
  });

  test('returns count of actually deleted (skips non-existent)', async () => {
    const count = await storage.bulkDelete(['t1', 'nonexistent', 't3']);
    expect(count).toBe(2);
  });

  test('handles empty array (returns 0, no changes)', async () => {
    const count = await storage.bulkDelete([]);
    expect(count).toBe(0);
    const allIds = await storage.ids();
    expect(allIds.length).toBe(4);
  });

  test('handles all IDs matching (full wipe)', async () => {
    const count = await storage.bulkDelete(['t1', 't2', 't3', 't4']);
    expect(count).toBe(4);
    const remaining = await storage.ids();
    expect(remaining).toEqual([]);
  });
});

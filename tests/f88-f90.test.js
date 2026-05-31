const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;

// F88: Cache.toPairs()
describe('Cache.toPairs()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 10 }); });
  afterEach(() => { cache.destroy(); });

  test('returns all non-expired entries as [key, value] pairs', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.toPairs()).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  test('excludes expired entries', () => {
    cache.set('a', 1, 1);
    cache.set('b', 2);
    const entry = cache.cache.get('a');
    entry.expiresAt = Date.now() - 1;
    expect(cache.toPairs()).toEqual([['b', 2]]);
  });

  test('returns empty array for empty cache', () => {
    expect(cache.toPairs()).toEqual([]);
  });
});

// F89: EventBus.removeAllListeners()
describe('EventBus.removeAllListeners()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('removes all listeners for a specific channel', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    bus.on('ch', fn1);
    bus.on('ch', fn2);
    expect(bus.removeAllListeners('ch')).toBe(2);
    bus.emit('ch', {});
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  test('removes all listeners across all channels when no channel given', () => {
    const fn = jest.fn();
    bus.on('a', fn);
    bus.on('b', fn);
    expect(bus.removeAllListeners()).toBe(2);
    bus.emit('a', {});
    bus.emit('b', {});
    expect(fn).not.toHaveBeenCalled();
  });

  test('returns 0 for channel with no listeners', () => {
    expect(bus.removeAllListeners('none')).toBe(0);
  });
});

// F90: Storage.map()
describe('Storage.map()', () => {
  let storage;
  const mapTestDir = './test-data-map-f90';
  beforeEach(async () => {
    storage = new Storage(mapTestDir);
    try { await fs.rm(mapTestDir, { recursive: true, force: true }); } catch (e) {}
  });
  afterEach(async () => {
    try { await fs.rm(mapTestDir, { recursive: true, force: true }); } catch (e) {}
  });

  test('transforms all tasks with mapper function', async () => {
    await storage.saveTask('t1', { id: 't1', status: 'done', value: 10 });
    await storage.saveTask('t2', { id: 't2', status: 'pending', value: 20 });
    const result = await storage.map(t => t.value * 2);
    expect(result.sort()).toEqual([20, 40]);
  });

  test('returns empty array for no tasks', async () => {
    const result = await storage.map(t => t.id);
    expect(result).toEqual([]);
  });
});

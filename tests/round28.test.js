const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

describe('F115: Cache.watch()', () => {
  test('fires callback on set', () => {
    const cache = new Cache();
    const events = [];
    cache.watch('k', e => events.push(e));
    cache.set('k', 42);
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ key: 'k', event: 'set', value: 42 });
    cache.destroy();
  });

  test('fires callback on delete', () => {
    const cache = new Cache();
    const events = [];
    cache.set('k', 1);
    cache.watch('k', e => events.push(e));
    cache.delete('k');
    expect(events.length).toBe(1);
    expect(events[0].event).toBe('delete');
    expect(events[0].value).toBe(1);
    cache.destroy();
  });

  test('unwatch stops notifications', () => {
    const cache = new Cache();
    const events = [];
    const unwatch = cache.watch('k', e => events.push(e));
    cache.set('k', 1);
    unwatch();
    cache.set('k', 2);
    expect(events.length).toBe(1);
    cache.destroy();
  });

  test('multiple watchers on same key', () => {
    const cache = new Cache();
    const a = [], b = [];
    cache.watch('k', e => a.push(e));
    cache.watch('k', e => b.push(e));
    cache.set('k', 'hello');
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    cache.destroy();
  });
});

describe('F116+F117: Storage.min() / max()', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'store-test-')); });
  afterEach(() => { try { rmSync(dir, { recursive: true }); } catch {} });

  test('min() returns minimum of numeric field', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3 });
    await storage.saveTask('b', { id: 'b', priority: 1 });
    await storage.saveTask('c', { id: 'c', priority: 5 });
    expect(await storage.min('priority')).toBe(1);
  });

  test('max() returns maximum of numeric field', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3 });
    await storage.saveTask('b', { id: 'b', priority: 7 });
    expect(await storage.max('priority')).toBe(7);
  });

  test('returns null for empty storage', async () => {
    const storage = new Storage(dir);
    expect(await storage.min('priority')).toBeNull();
    expect(await storage.max('priority')).toBeNull();
  });

  test('ignores non-numeric values', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3, name: 'test' });
    expect(await storage.min('name')).toBeNull();
    expect(await storage.max('priority')).toBe(3);
  });
});

describe('F118: EventBus.last()', () => {
  test('returns last event for channel', () => {
    const bus = new EventBus();
    bus.emit('ch', 1);
    bus.emit('ch', 2);
    bus.emit('other', 99);
    bus.emit('ch', 3);
    const last = bus.last('ch');
    expect(last.length).toBe(1);
    expect(last[0].data).toBe(3);
  });

  test('returns last N events', () => {
    const bus = new EventBus();
    bus.emit('ch', 'a');
    bus.emit('ch', 'b');
    bus.emit('ch', 'c');
    const last = bus.last('ch', 2);
    expect(last.length).toBe(2);
    expect(last[0].data).toBe('b');
    expect(last[1].data).toBe('c');
  });

  test('returns empty array for unknown channel', () => {
    const bus = new EventBus();
    expect(bus.last('nope')).toEqual([]);
  });
});

const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F215: Cache.mdelete', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100, ttl: 0 }); });
  afterEach(() => { cache.destroy(); });

  test('deletes multiple existing keys, returns count', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const deleted = cache.mdelete(['a', 'b', 'c']);
    expect(deleted).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
  });

  test('skips non-existent keys in count', () => {
    cache.set('x', 1);
    const deleted = cache.mdelete(['x', 'nonexistent']);
    expect(deleted).toBe(1);
  });

  test('returns 0 for empty array', () => {
    cache.set('key', 'val');
    expect(cache.mdelete([])).toBe(0);
    expect(cache.get('key')).toBe('val');
  });

  test('returns 0 for non-array input', () => {
    expect(cache.mdelete(null)).toBe(0);
    expect(cache.mdelete(undefined)).toBe(0);
  });

  test('deletes expired keys too', async () => {
    cache.set('temp', 'data', 50);
    await new Promise(r => setTimeout(r, 60));
    const deleted = cache.mdelete(['temp']);
    expect(deleted).toBe(1);
    expect(cache.get('temp')).toBeUndefined();
  });
});

describe('F216: Storage.union', () => {
  let tmpDir1, tmpDir2, storage1, storage2;

  beforeEach(() => {
    tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'store1-'));
    tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'store2-'));
    storage1 = new Storage(tmpDir1);
    storage2 = new Storage(tmpDir2);
  });

  afterEach(() => {
    fs.rmSync(tmpDir1, { recursive: true, force: true });
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });

  test('merges non-overlapping tasks from both storages', async () => {
    await storage1.saveTask('t1', { id: 't1', title: 'Task 1' });
    await storage2.saveTask('t2', { id: 't2', title: 'Task 2' });
    const merged = await storage1.union(storage2);
    expect(Object.keys(merged).sort()).toEqual(['t1', 't2']);
    expect(merged.t1.title).toBe('Task 1');
    expect(merged.t2.title).toBe('Task 2');
  });

  test('other storage wins on ID collision', async () => {
    await storage1.saveTask('shared', { id: 'shared', title: 'From S1', version: 1 });
    await storage2.saveTask('shared', { id: 'shared', title: 'From S2', version: 2 });
    const merged = await storage1.union(storage2);
    expect(merged.shared.title).toBe('From S2');
    expect(merged.shared.version).toBe(2);
  });

  test('handles empty storages', async () => {
    const merged = await storage1.union(storage2);
    expect(Object.keys(merged)).toEqual([]);
  });

  test('original storages are not modified', async () => {
    await storage1.saveTask('a', { id: 'a', val: 1 });
    await storage2.saveTask('b', { id: 'b', val: 2 });
    await storage1.union(storage2);
    const s1Tasks = await storage1.loadTasks();
    expect(Object.keys(s1Tasks)).toEqual(['a']);
  });
});

describe('F217: EventBus.drainChannel', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('removes and returns all events for a channel', () => {
    bus.emit('chanA', { n: 1 });
    bus.emit('chanB', { n: 2 });
    bus.emit('chanA', { n: 3 });
    bus.emit('chanA', { n: 4 });
    bus.emit('chanC', { n: 5 });

    const drained = bus.drainChannel('chanA');
    expect(drained).toHaveLength(3);
    expect(drained.map(e => e.data.n)).toEqual([1, 3, 4]);
  });

  test('clears drained events from history', () => {
    bus.emit('chanA', 1);
    bus.emit('chanA', 2);
    bus.drainChannel('chanA');

    const remaining = bus.drainChannel('chanA');
    expect(remaining).toHaveLength(0);
  });

  test('preserves other channels in history', () => {
    bus.emit('chanA', 'x');
    bus.emit('chanB', 'y');
    bus.emit('chanA', 'z');

    bus.drainChannel('chanA');

    const chanB = bus.drainChannel('chanB');
    expect(chanB).toHaveLength(1);
    expect(chanB[0].data).toBe('y');
  });

  test('returns empty array for non-existent channel', () => {
    bus.emit('real', 1);
    const drained = bus.drainChannel('nonexistent');
    expect(drained).toEqual([]);
  });

  test('returns empty array for empty history', () => {
    const drained = bus.drainChannel('anything');
    expect(drained).toEqual([]);
  });
});

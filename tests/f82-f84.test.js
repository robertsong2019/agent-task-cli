const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F82: Cache.keys()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 60000 }); });
  afterEach(() => cache.destroy());

  test('returns empty array for empty cache', () => {
    expect(cache.keys()).toEqual([]);
  });

  test('returns all non-expired keys', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.keys().sort()).toEqual(['a', 'b', 'c']);
  });

  test('excludes expired keys', () => {
    cache.set('a', 1, 1);
    cache.set('b', 2);
    return new Promise(r => setTimeout(r, 10)).then(() => {
      expect(cache.keys()).toEqual(['b']);
    });
  });

  test('keys match values length', () => {
    cache.set('x', 'val');
    cache.set('y', 'val2');
    expect(cache.keys().length).toBe(cache.values().length);
  });
});

describe('F83: Storage.countByStatus()', () => {
  let storage, tmpDir;
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-f83-'));
    storage = new Storage(tmpDir);
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test('returns empty object for no tasks', async () => {
    const counts = await storage.countByStatus();
    expect(counts).toEqual({});
  });

  test('counts tasks by status', async () => {
    await storage.saveTask('t1', { id: 't1', status: 'running' });
    await storage.saveTask('t2', { id: 't2', status: 'running' });
    await storage.saveTask('t3', { id: 't3', status: 'done' });
    const counts = await storage.countByStatus();
    expect(counts).toEqual({ running: 2, done: 1 });
  });

  test('handles tasks without status as unknown', async () => {
    await storage.saveTask('t1', { id: 't1' });
    const counts = await storage.countByStatus();
    expect(counts).toEqual({ unknown: 1 });
  });
});

describe('F84: EventBus.emitDebounced()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('emits after delay', (done) => {
    bus.on('ch', (evt) => {
      expect(evt.data).toBe('hello');
      done();
    });
    bus.emitDebounced('ch', 'hello', 30);
  });

  test('coalesces rapid emits — only last fires', (done) => {
    const received = [];
    bus.on('ch', (evt) => received.push(evt.data));
    bus.emitDebounced('ch', 'a', 50);
    bus.emitDebounced('ch', 'b', 50);
    bus.emitDebounced('ch', 'c', 50);
    setTimeout(() => {
      expect(received).toEqual(['c']);
      done();
    }, 100);
  });

  test('cancel prevents emission', (done) => {
    const received = [];
    bus.on('ch', (evt) => received.push(evt.data));
    const cancel = bus.emitDebounced('ch', 'x', 50);
    cancel();
    setTimeout(() => {
      expect(received).toEqual([]);
      done();
    }, 100);
  });
});

const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F79: Cache.swap', () => {
  test('returns undefined for non-existent key and sets new value', () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    const old = cache.swap('k1', 'new');
    expect(old).toBeUndefined();
    expect(cache.get('k1')).toBe('new');
    cache.destroy();
  });

  test('returns old value and replaces with new', () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    cache.set('k1', 'old');
    const old = cache.swap('k1', 'new');
    expect(old).toBe('old');
    expect(cache.get('k1')).toBe('new');
    cache.destroy();
  });

  test('preserves TTL when specified', () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    cache.swap('k1', 'val', 1);
    expect(cache.get('k1')).toBe('val');
    // value should still be there immediately
    expect(cache.get('k1')).toBe('val');
    cache.destroy();
  });
});

describe('F80: EventBus.pipe', () => {
  test('pipes events from one bus to another', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('data', (e) => received.push(e));

    bus1.pipe('data', bus2);
    bus1.emit('data', { x: 1 });

    expect(received).toHaveLength(1);
    expect(received[0].data.x).toBe(1);
    bus1.reset();
    bus2.reset();
  });

  test('pipes to different target channel', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('renamed', (e) => received.push(e));

    bus1.pipe('src', bus2, 'renamed');
    bus1.emit('src', { y: 2 });

    expect(received).toHaveLength(1);
    expect(received[0].data.y).toBe(2);
    bus1.reset();
    bus2.reset();
  });

  test('unpipe stops forwarding', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('data', (e) => received.push(e));

    const unpipe = bus1.pipe('data', bus2);
    bus1.emit('data', { a: 1 });
    unpipe();
    bus1.emit('data', { a: 2 });

    expect(received).toHaveLength(1);
    bus1.reset();
    bus2.reset();
  });
});

describe('F81: Storage.getOrCreate', () => {
  test('returns existing task without overwriting', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-goc-'));
    const storage = new Storage(tmpDir);
    await storage.saveTask('t1', { title: 'Existing', status: 'done' });

    const task = await storage.getOrCreate('t1', { title: 'New', status: 'pending' });
    expect(task.title).toBe('Existing');
    expect(task.status).toBe('done');

    await fs.rm(tmpDir, { recursive: true });
  });

  test('creates task with defaults when not found', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-goc-'));
    const storage = new Storage(tmpDir);

    const task = await storage.getOrCreate('t1', { title: 'Created', status: 'pending' });
    expect(task.id).toBe('t1');
    expect(task.title).toBe('Created');

    // Verify persisted
    const loaded = await storage.getTask('t1');
    expect(loaded.title).toBe('Created');

    await fs.rm(tmpDir, { recursive: true });
  });

  test('creates with empty defaults if not provided', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-goc-'));
    const storage = new Storage(tmpDir);

    const task = await storage.getOrCreate('t1');
    expect(task.id).toBe('t1');

    await fs.rm(tmpDir, { recursive: true });
  });
});

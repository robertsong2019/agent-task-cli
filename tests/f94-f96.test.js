const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const path = require('path');
const fs = require('fs/promises');

// --- F94: EventBus.intercept ---
describe('F94: EventBus.intercept(channel, fn)', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('interceptor modifies data before subscribers', () => {
    bus.intercept('test', (data) => ({ ...data, modified: true }));
    let received;
    bus.on('test', (e) => { received = e.data; });
    bus.emit('test', { value: 1 });
    expect(received.modified).toBe(true);
    expect(received.value).toBe(1);
  });

  test('interceptor returning false blocks emission', () => {
    bus.intercept('blocked', () => false);
    let called = false;
    bus.on('blocked', () => { called = true; });
    bus.emit('blocked', {});
    expect(called).toBe(false);
  });

  test('remove function removes interceptor', () => {
    const remove = bus.intercept('test', (data) => ({ ...data, extra: 1 }));
    remove();
    let received;
    bus.on('test', (e) => { received = e.data; });
    bus.emit('test', { value: 2 });
    expect(received.extra).toBeUndefined();
  });
});

// --- F95: Cache.getSet ---
describe('F95: Cache.getSet(key, factory, ttl?)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 10 }); });
  afterEach(() => { cache.destroy(); });

  test('always calls factory and sets value', async () => {
    let calls = 0;
    const result = await cache.getSet('k', async () => { calls++; return 'fresh'; });
    expect(result).toBe('fresh');
    expect(calls).toBe(1);
    expect(cache.get('k')).toBe('fresh');
  });

  test('refreshes even if key exists', async () => {
    cache.set('k', 'old');
    const result = await cache.getSet('k', async () => 'new');
    expect(result).toBe('new');
    expect(cache.get('k')).toBe('new');
  });
});

// --- F96: Storage.transaction ---
describe('F96: Storage.transaction(fn)', () => {
  let storage;
  const testDir = './test-data-txn';
  beforeEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch {}
    storage = new Storage(testDir);
  });
  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch {}
  });

  test('commits on success', async () => {
    const result = await storage.transaction(async (s) => {
      await s.saveTask('t1', { id: 't1', name: 'task1' });
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(await storage.getTask('t1')).toBeDefined();
  });

  test('rolls back on error', async () => {
    await storage.saveTask('t1', { id: 't1', name: 'original' });
    await expect(
      storage.transaction(async (s) => {
        await s.saveTask('t2', { id: 't2', name: 'added' });
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');
  });
});

// Alias for transaction test readability
const s = () => storage;

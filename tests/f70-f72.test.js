const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F70: Cache.setNX', () => {
  test('setNX new key returns true and sets value', () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    expect(cache.setNX('key1', 'val1')).toBe(true);
    expect(cache.get('key1')).toBe('val1');
    cache.destroy();
  });

  test('setNX existing key returns false', () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    cache.setNX('key1', 'val1');
    expect(cache.setNX('key1', 'val2')).toBe(false);
    expect(cache.get('key1')).toBe('val1');
    cache.destroy();
  });

  test('setNX on expired key returns true', async () => {
    const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });
    cache.set('key2', 'old', 1);
    await new Promise(r => setTimeout(r, 10));
    expect(cache.setNX('key2', 'new')).toBe(true);
    expect(cache.get('key2')).toBe('new');
    cache.destroy();
  });
});

describe('F71: EventBus.throttle', () => {
  test('throttles rapid emissions', async () => {
    const bus = new EventBus();
    const received = [];
    bus.on('tick', (e) => received.push(e.data));
    const throttledEmit = bus.throttle('tick', 100);

    throttledEmit('a');
    throttledEmit('b');
    throttledEmit('c');

    expect(received).toEqual(['a']);

    await new Promise(r => setTimeout(r, 120));
    expect(throttledEmit('d')).toBe(true);
    expect(received).toEqual(['a', 'd']);
    bus.reset();
  });
});

describe('F72: Storage.batchUpdate', () => {
  test('batch updates multiple tasks, skips nonexistent', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-batch-'));
    const storage = new Storage(tmpDir);

    await storage.saveTask('t1', { title: 'Task 1', status: 'pending', createdAt: new Date().toISOString() });
    await storage.saveTask('t2', { title: 'Task 2', status: 'pending', createdAt: new Date().toISOString() });
    await storage.saveTask('t3', { title: 'Task 3', status: 'pending', createdAt: new Date().toISOString() });

    const results = await storage.batchUpdate([
      { id: 't1', updates: { status: 'done' } },
      { id: 't2', updates: { status: 'running', progress: 50 } },
      { id: 't_nonexistent', updates: { status: 'x' } },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('done');
    expect(results[1].status).toBe('running');
    expect(results[1].progress).toBe(50);

    const t3 = await storage.getTask('t3');
    expect(t3.status).toBe('pending');

    await fs.rm(tmpDir, { recursive: true });
  });
});

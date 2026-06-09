const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

// F119: Cache.shuffle()
describe('Cache.shuffle()', () => {
  test('returns all non-expired entries in random order', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);

    const shuffled = cache.shuffle();
    expect(shuffled).toHaveLength(5);
    
    const keys = shuffled.map(e => e.key).sort();
    expect(keys).toEqual(['a', 'b', 'c', 'd', 'e']);

    const vals = shuffled.map(e => e.value).sort();
    expect(vals).toEqual([1, 2, 3, 4, 5]);

    // Statistical check: not same order every time
    const orders = [];
    for (let i = 0; i < 5; i++) {
      const c = new Cache();
      c.set('a', 1); c.set('b', 2); c.set('c', 3);
      orders.push(c.shuffle().map(e => e.key).join(''));
    }
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  test('excludes expired entries', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2, 10);
    const shuffled = cache.shuffle();
    expect(shuffled).toHaveLength(2);
  });

  test('returns empty array for empty cache', () => {
    const cache = new Cache();
    expect(cache.shuffle()).toEqual([]);
  });
});

// F120: Storage.reverse()
describe('Storage.reverse()', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'storage-rev-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('returns tasks in reverse insertion order', async () => {
    await storage.saveTask('t1', { name: 'first' });
    await storage.saveTask('t2', { name: 'second' });
    await storage.saveTask('t3', { name: 'third' });

    const reversed = await storage.reverse();
    // JSON object order is insertion order
    expect(reversed.map(t => t.name)).toEqual(['third', 'second', 'first']);
  });

  test('returns empty array for empty storage', async () => {
    const reversed = await storage.reverse();
    expect(reversed).toEqual([]);
  });

  test('does not modify original data', async () => {
    await storage.saveTask('t1', { name: 'a' });
    await storage.saveTask('t2', { name: 'b' });

    const reversed = await storage.reverse();
    expect(reversed[0].name).toBe('b');

    const tasks = await storage.loadTasks();
    const keys = Object.keys(tasks);
    expect(keys[0]).toBe('t1');
  });
});

// F121: EventBus.waitUntil()
describe('EventBus.waitUntil()', () => {
  test('resolves when event matches predicate', async () => {
    const bus = new EventBus();
    setTimeout(() => {
      bus.emit('test', { value: 5 });
      bus.emit('test', { value: 10 });
    }, 10);

    const result = await bus.waitUntil('test', data => data.value > 7, 1000);
    expect(result.value).toBe(10);
  });

  test('rejects on timeout', async () => {
    const bus = new EventBus();
    await expect(
      bus.waitUntil('test', () => true, 50)
    ).rejects.toThrow('waitUntil timed out');
  });

  test('unsubscribes after resolving', async () => {
    const bus = new EventBus();
    const promise = bus.waitUntil('test', d => d.ok, 500);
    bus.emit('test', { ok: true });
    await promise;

    bus.emit('test', { ok: true });
    const subs = bus._subscribers.get('test');
    expect(subs ? subs.size : 0).toBe(0);
  });
});

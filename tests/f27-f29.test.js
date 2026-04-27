const { EventBus } = require('../src/utils/event-bus');
const { Cache } = require('../src/utils/cache');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

// F27: EventBus.channelNames()
describe('F27: EventBus.channelNames()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => { bus.reset(); });

  test('returns empty array when no subscribers', () => {
    expect(bus.channelNames()).toEqual([]);
  });

  test('returns channels with active subscribers', () => {
    const unsub1 = bus.on('task:started', () => {});
    const unsub2 = bus.on('task:completed', () => {});
    const names = bus.channelNames();
    expect(names).toContain('task:started');
    expect(names).toContain('task:completed');
    expect(names.length).toBe(2);
    unsub1();
    unsub2();
  });

  test('removes channel after all subscribers unsubscribe', () => {
    const unsub = bus.on('temp', () => {});
    expect(bus.channelNames()).toContain('temp');
    unsub();
    expect(bus.channelNames()).not.toContain('temp');
  });
});

// F28: Cache.deleteByPattern()
describe('F28: Cache.deleteByPattern()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 50 }); });
  afterEach(() => { cache.destroy(); });

  test('deletes keys matching wildcard pattern', () => {
    cache.set('user:1:name', 'Alice');
    cache.set('user:2:name', 'Bob');
    cache.set('user:1:email', 'alice@test.com');
    cache.set('post:1', 'Hello');
    const deleted = cache.deleteByPattern('user:*:name');
    expect(deleted).toBe(2);
    expect(cache.has('user:1:name')).toBe(false);
    expect(cache.has('user:2:name')).toBe(false);
    expect(cache.has('user:1:email')).toBe(true);
    expect(cache.has('post:1')).toBe(true);
  });

  test('returns 0 when no keys match', () => {
    cache.set('foo', 1);
    expect(cache.deleteByPattern('bar*')).toBe(0);
    expect(cache.has('foo')).toBe(true);
  });

  test('handles pattern with multiple wildcards', () => {
    cache.set('a:b:c', 1);
    cache.set('a:x:c', 2);
    cache.set('a:b:d', 3);
    expect(cache.deleteByPattern('a:*:c')).toBe(2);
    expect(cache.size()).toBe(1);
    expect(cache.has('a:b:d')).toBe(true);
  });

  test('deletes all keys with * pattern', () => {
    cache.set('k1', 1);
    cache.set('k2', 2);
    expect(cache.deleteByPattern('*')).toBe(2);
    expect(cache.size()).toBe(0);
  });
});

// F29: ConcurrencyManager.queueSize getter
describe('F29: ConcurrencyManager.queueSize', () => {
  test('returns 0 when queue is empty', () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    expect(cm.queueSize).toBe(0);
  });

  test('returns pending count when tasks are queued', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    // Block the single slot
    const blocker = cm.execute(() => new Promise(() => {})); // never resolves
    // Queue two more
    const t1 = cm.execute(() => Promise.resolve(1)).catch(() => {});
    const t2 = cm.execute(() => Promise.resolve(2)).catch(() => {});
    // Give event loop a tick
    await new Promise(r => setTimeout(r, 10));
    expect(cm.queueSize).toBe(2);
    cm.clearQueue();
  });
});

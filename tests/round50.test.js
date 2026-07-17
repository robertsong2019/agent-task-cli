const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');

// ─── F198: ConcurrencyManager.awaitIdle(timeout?) ─────────────────────────────

describe('F198: ConcurrencyManager.awaitIdle(timeout?)', () => {
  let cm;

  beforeEach(() => {
    cm = new ConcurrencyManager(2);
  });

  afterEach(async () => {
    // Give lingering timers a moment to clean up
    if (!cm.isIdle()) {
      await cm.awaitIdle(1000).catch(() => {});
    }
  });

  test('resolves true immediately when already idle', async () => {
    const result = await cm.awaitIdle(100);
    expect(result).toBe(true);
  });

  test('resolves true after tasks complete', async () => {
    let resolveTask;
    const taskPromise = cm.execute(() => new Promise(res => { resolveTask = res; }), 't1');
    // Not idle yet
    const idlePromise = cm.awaitIdle(3000);
    resolveTask(42);
    const result = await idlePromise;
    expect(result).toBe(true);
    await taskPromise;
  });

  test('resolves false on timeout when tasks still running', async () => {
    let resolveTask;
    const taskPromise = cm.execute(() => new Promise(res => { resolveTask = res; }), 't1');
    const result = await cm.awaitIdle(50);
    expect(result).toBe(false);
    resolveTask(0);
    await taskPromise;
  });

  test('resolves true after queued tasks drain', async () => {
    // max=1 so tasks queue up
    const cm1 = new ConcurrencyManager(1);
    let resolveT1;
    const t1 = cm1.execute(() => new Promise(res => { resolveT1 = res; }), 't1');
    let resolveT2;
    const t2 = cm1.execute(() => new Promise(res => { resolveT2 = res; }), 't2');

    const idlePromise = cm1.awaitIdle(3000);
    resolveT1(1);
    resolveT2(2);
    const result = await idlePromise;
    expect(result).toBe(true);
    await Promise.all([t1, t2]);
  });

  test('infinity timeout (no timeout arg) waits indefinitely', async () => {
    let resolveTask;
    const taskPromise = cm.execute(() => new Promise(res => { resolveTask = res; }), 't1');
    const idlePromise = cm.awaitIdle();
    resolveTask('done');
    const result = await idlePromise;
    expect(result).toBe(true);
    await taskPromise;
  });
});

// ─── F199: Cache.shift() ──────────────────────────────────────────────────────

describe('F199: Cache.shift()', () => {
  test('returns undefined on empty cache', () => {
    const cache = new Cache();
    expect(cache.shift()).toBeUndefined();
  });

  test('evicts and returns oldest (LRU insertion order) entry', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.shift()).toEqual({ key: 'a', value: 1 });
    expect(cache.shift()).toEqual({ key: 'b', value: 2 });
    expect(cache.get('c')).toBe(3);
  });

  test('increments eviction counter', () => {
    const cache = new Cache();
    cache.set('x', 'val');
    const before = cache.stats.evictions;
    cache.shift();
    expect(cache.stats.evictions).toBe(before + 1);
  });

  test('decrements size', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.stats.size).toBe(2);
    cache.shift();
    expect(cache.stats.size).toBe(1);
  });

  test('skips expired entries and returns next valid one', async () => {
    const cache = new Cache();
    cache.set('expired', 'old', 10); // 10ms TTL
    cache.set('valid', 'new');
    await new Promise(r => setTimeout(r, 20));
    const result = cache.shift();
    expect(result).toEqual({ key: 'valid', value: 'new' });
    expect(cache.stats.size).toBe(0);
  });

  test('returns undefined when all entries expired', async () => {
    const cache = new Cache();
    cache.set('a', 1, 10);
    await new Promise(r => setTimeout(r, 20));
    expect(cache.shift()).toBeUndefined();
    expect(cache.stats.size).toBe(0);
  });

  test('can drain entire cache via loop', () => {
    const cache = new Cache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const drained = [];
    while (true) {
      const entry = cache.shift();
      if (!entry) break;
      drained.push(entry);
    }
    expect(drained).toHaveLength(3);
    expect(drained.map(e => e.key)).toEqual(['a', 'b', 'c']);
    expect(cache.stats.size).toBe(0);
  });
});

// ─── F200: EventBus.hasListeners(channel) ─────────────────────────────────────

describe('F200: EventBus.hasListeners(channel)', () => {
  test('returns false for channel with no subscribers', () => {
    const bus = new EventBus();
    expect(bus.hasListeners('empty')).toBe(false);
  });

  test('returns true after subscribing', () => {
    const bus = new EventBus();
    bus.on('test', () => {});
    expect(bus.hasListeners('test')).toBe(true);
  });

  test('returns false after all subscribers removed', () => {
    const bus = new EventBus();
    const handler = () => {};
    bus.on('test', handler);
    bus.off('test', handler);
    expect(bus.hasListeners('test')).toBe(false);
  });

  test('returns true with multiple subscribers', () => {
    const bus = new EventBus();
    bus.on('multi', () => {});
    bus.on('multi', () => {});
    expect(bus.hasListeners('multi')).toBe(true);
  });

  test('does not count wildcard subscribers', () => {
    const bus = new EventBus();
    bus.on('*', () => {});
    expect(bus.hasListeners('anything')).toBe(false);
  });

  test('works with pattern-matched channels', () => {
    const bus = new EventBus();
    bus.onPattern('user:*', () => {});
    // Pattern subscribers go in _patternSubscribers, not _subscribers
    // hasListeners only checks direct subscribers per spec
    expect(bus.hasListeners('user:created')).toBe(false);
    bus.on('user:created', () => {});
    expect(bus.hasListeners('user:created')).toBe(true);
  });

  test('returns false for empty string channel', () => {
    const bus = new EventBus();
    expect(bus.hasListeners('')).toBe(false);
  });
});

const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');

describe('F52: EventBus.subscriberCount', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('returns 0 for channel with no subscribers', () => {
    expect(bus.subscriberCount('test')).toBe(0);
  });

  test('returns correct count after subscribing', () => {
    const unsub1 = bus.on('test', () => {});
    expect(bus.subscriberCount('test')).toBe(1);
    const unsub2 = bus.on('test', () => {});
    expect(bus.subscriberCount('test')).toBe(2);
    unsub1();
    expect(bus.subscriberCount('test')).toBe(1);
    unsub2();
    expect(bus.subscriberCount('test')).toBe(0);
  });

  test('counts per channel independently', () => {
    bus.on('a', () => {});
    bus.on('b', () => {});
    bus.on('b', () => {});
    expect(bus.subscriberCount('a')).toBe(1);
    expect(bus.subscriberCount('b')).toBe(2);
  });
});

describe('F53: Cache.findKeys', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 50, defaultTTL: 60000 }); });
  afterEach(() => cache.destroy());

  test('finds keys by value predicate', () => {
    cache.set('user:1', { name: 'Alice', age: 30 });
    cache.set('user:2', { name: 'Bob', age: 25 });
    cache.set('user:3', { name: 'Charlie', age: 30 });
    const result = cache.findKeys((k, v) => v.age === 30);
    expect(result.sort()).toEqual(['user:1', 'user:3']);
  });

  test('finds keys by key predicate', () => {
    cache.set('task:a', 1);
    cache.set('task:b', 2);
    cache.set('event:c', 3);
    const result = cache.findKeys((k) => k.startsWith('task:'));
    expect(result.sort()).toEqual(['task:a', 'task:b']);
  });

  test('returns empty array when no match', () => {
    cache.set('x', 1);
    expect(cache.findKeys(() => false)).toEqual([]);
  });

  test('skips expired entries', async () => {
    cache.set('expired', 'old', 1);
    await new Promise(r => setTimeout(r, 10));
    cache.set('valid', 'new');
    const result = cache.findKeys((k) => true);
    expect(result).toEqual(['valid']);
  });
});

describe('F54: EventBus.waitForPattern', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('resolves when matching event is emitted', async () => {
    const promise = bus.waitForPattern('task:*', 2000);
    setTimeout(() => bus.emit('task:started', { id: 1 }), 50);
    const event = await promise;
    expect(event.channel).toBe('task:started');
    expect(event.data.id).toBe(1);
  });

  test('rejects on timeout', async () => {
    await expect(bus.waitForPattern('test:*', 100)).rejects.toThrow('Timeout');
  });

  test('only matches the pattern, not other channels', async () => {
    const promise = bus.waitForPattern('task:done', 200);
    setTimeout(() => bus.emit('task:started', {}), 50);
    await expect(promise).rejects.toThrow('Timeout');
  });

  test('handles wildcard patterns', async () => {
    const promise = bus.waitForPattern('user:*:update', 2000);
    setTimeout(() => bus.emit('user:123:update', { field: 'name' }), 50);
    const event = await promise;
    expect(event.data.field).toBe('name');
  });
});

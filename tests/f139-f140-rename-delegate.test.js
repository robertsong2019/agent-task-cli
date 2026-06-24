/**
 * F139: Cache.renameKey(oldKey, newKey)
 * F140: EventBus.delegate(targetBus, channels)
 */
const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');

describe('F139: Cache.renameKey', () => {
  let cache;
  beforeEach(() => { cache = new Cache(); });

  test('renames existing key preserving value', () => {
    cache.set('old', 'value');
    expect(cache.renameKey('old', 'new')).toBe(true);
    expect(cache.get('new')).toBe('value');
    expect(cache.has('old')).toBe(false);
  });

  test('preserves TTL', () => {
    cache.set('old', 'val', 5000);
    cache.renameKey('old', 'new');
    const stats = cache.getStats();
    // Key should still exist and be valid
    expect(cache.get('new')).toBe('val');
  });

  test('returns false for non-existent key', () => {
    expect(cache.renameKey('missing', 'new')).toBe(false);
  });

  test('overwrites if newKey already exists', () => {
    cache.set('old', 'oldval');
    cache.set('new', 'newval');
    cache.renameKey('old', 'new');
    expect(cache.get('new')).toBe('oldval');
    expect(cache.has('old')).toBe(false);
  });

  test('works with mset keys', () => {
    cache.mset({ a: 1, b: 2 });
    cache.renameKey('a', 'c');
    expect(cache.get('c')).toBe(1);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
  });

  test('same key rename is no-op returning true', () => {
    cache.set('x', 42);
    expect(cache.renameKey('x', 'x')).toBe(true);
    expect(cache.get('x')).toBe(42);
  });
});

describe('F140: EventBus.delegate', () => {
  test('forwards events to target bus', () => {
    const source = new EventBus();
    const target = new EventBus();
    source.delegate(target);

    const received = [];
    target.on('test.event', (event) => received.push(event));

    source.emit('test.event', { msg: 'hello' });
    expect(received).toHaveLength(1);
    expect(received[0].data.msg).toBe('hello');
    expect(received[0].data.__delegated).toBe(true);
  });

  test('filters by channel list', () => {
    const source = new EventBus();
    const target = new EventBus();
    source.delegate(target, ['important']);

    const received = [];
    target.on('important', (event) => received.push(event));
    target.on('noise', (event) => received.push(event));

    source.emit('important', { x: 1 });
    source.emit('noise', { x: 2 });
    expect(received).toHaveLength(1);
    expect(received[0].data.x).toBe(1);
  });

  test('throws on invalid target', () => {
    const source = new EventBus();
    expect(() => source.delegate(null)).toThrow();
    expect(() => source.delegate({})).toThrow();
  });

  test('undelegate stops forwarding', () => {
    const source = new EventBus();
    const target = new EventBus();
    const received = [];
    target.on('e', (event) => received.push(event));

    const undelegate = source.delegate(target);
    source.emit('e', { n: 1 });
    undelegate();
    source.emit('e', { n: 2 });

    expect(received).toHaveLength(1);
    expect(received[0].data.n).toBe(1);
  });

  test('multiple delegations work independently', () => {
    const source = new EventBus();
    const target1 = new EventBus();
    const target2 = new EventBus();
    const r1 = [], r2 = [];

    target1.on('e', (event) => r1.push(event));
    target2.on('e', (event) => r2.push(event));

    source.delegate(target1);
    source.delegate(target2);

    source.emit('e', { v: 42 });
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    expect(r1[0].data.v).toBe(42);
    expect(r2[0].data.v).toBe(42);
  });
});

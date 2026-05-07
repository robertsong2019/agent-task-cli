const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { TaskChain } = require('../src/task-chain');

describe('F55: Cache.rename', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('renames key preserving value and TTL', () => {
    const cache = new Cache();
    cache.set('a', 42, 5000);
    const result = cache.rename('a', 'b');
    expect(result).toBe(true);
    expect(cache.get('b')).toBe(42);
    expect(cache.get('a')).toBeUndefined();
  });

  test('returns false for non-existent key', () => {
    const cache = new Cache();
    expect(cache.rename('missing', 'b')).toBe(false);
  });

  test('returns false for expired key', () => {
    jest.useFakeTimers();
    const cache = new Cache();
    cache.set('a', 1, 1); // 1ms TTL
    jest.advanceTimersByTime(10);
    expect(cache.rename('a', 'b')).toBe(false);
  });
});

describe('F56: EventBus.emitIf', () => {
  test('emits when predicate returns true', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('test', e => received.push(e.data));
    const emitted = bus.emitIf('test', { x: 1 }, (ch, data) => data.x > 0);
    expect(emitted).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].x).toBe(1);
  });

  test('does not emit when predicate returns false', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('test', e => received.push(e.data));
    const emitted = bus.emitIf('test', { x: -1 }, (ch, data) => data.x > 0);
    expect(emitted).toBe(false);
    expect(received).toHaveLength(0);
  });

  test('predicate receives channel name', () => {
    const bus = new EventBus();
    let ch = null;
    bus.on('my-ch', () => {});
    bus.emitIf('my-ch', {}, (c) => { ch = c; return true; });
    expect(ch).toBe('my-ch');
  });
});

describe('F57: TaskChain.stepNames', () => {
  test('returns ordered step names', () => {
    const chain = new TaskChain();
    chain.add('alpha', async () => 1);
    chain.add('beta', async () => 2);
    chain.add('gamma', async () => 3);
    expect(chain.stepNames()).toEqual(['alpha', 'beta', 'gamma']);
  });

  test('returns empty array for empty chain', () => {
    const chain = new TaskChain();
    expect(chain.stepNames()).toEqual([]);
  });

  test('returns a copy (not internal reference)', () => {
    const chain = new TaskChain();
    chain.add('a', async () => {});
    const names = chain.stepNames();
    names.push('hacked');
    expect(chain.stepNames()).toEqual(['a']);
  });
});

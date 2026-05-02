const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { TaskChain } = require('../src/task-chain');

describe('F38: Cache.values()', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 10, defaultTTL: 60000 }); });
  afterEach(() => cache.destroy());

  test('returns all non-expired values', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const vals = cache.values();
    expect(vals.sort()).toEqual([1, 2, 3]);
  });

  test('excludes expired entries', () => {
    cache.set('a', 1);
    cache.set('b', 2, 1); // 1ms TTL
    return new Promise(r => setTimeout(r, 10)).then(() => {
      expect(cache.values()).toEqual([1]);
    });
  });

  test('returns empty array when cache is empty', () => {
    expect(cache.values()).toEqual([]);
  });
});

describe('F39: TaskChain.hasStep()', () => {
  const makeChain = () => {
    const orch = { _agents: new Map([['mock', { execute: async () => 'ok' }]]) };
    return new TaskChain(orch);
  };

  test('returns true for existing step', () => {
    const chain = makeChain();
    chain.add('step1', { agent: 'mock', task: 'do stuff' });
    expect(chain.hasStep('step1')).toBe(true);
  });

  test('returns false for non-existent step', () => {
    const chain = makeChain();
    expect(chain.hasStep('nope')).toBe(false);
  });

  test('returns false after remove_step', () => {
    const chain = makeChain();
    chain.add('step1', { agent: 'mock', task: 'do stuff' });
    chain.remove_step('step1');
    expect(chain.hasStep('step1')).toBe(false);
  });
});

describe('F40: EventBus.clearHistory()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => bus.removeAllListeners?.());

  test('clears history and returns count', () => {
    bus.emit('a', { x: 1 });
    bus.emit('b', { x: 2 });
    const count = bus.clearHistory();
    expect(count).toBe(2);
    expect(bus.getHistory()).toEqual([]);
  });

  test('returns 0 when history is empty', () => {
    expect(bus.clearHistory()).toBe(0);
  });

  test('does not affect subscribers', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    bus.emit('test', {});
    bus.clearHistory();
    bus.emit('test', {});
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

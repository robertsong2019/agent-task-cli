const { EventBus } = require('../src/utils/event-bus');

describe('EventBus.channelStats()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => { bus.removeAllListeners(); });

  test('returns empty object for empty bus', () => {
    const stats = bus.channelStats();
    expect(stats).toEqual({});
  });

  test('reports subscriber counts per channel', () => {
    bus.on('a', () => {});
    bus.on('a', () => {});
    bus.on('b', () => {});
    const stats = bus.channelStats();
    expect(stats.a.subscribers).toBe(2);
    expect(stats.b.subscribers).toBe(1);
  });

  test('reports event counts from history', () => {
    bus.emit('x', { n: 1 });
    bus.emit('x', { n: 2 });
    bus.emit('y', { n: 3 });
    const stats = bus.channelStats();
    expect(stats.x.events).toBe(2);
    expect(stats.y.events).toBe(1);
  });

  test('includes channels with events but no subscribers', () => {
    bus.emit('orphan', {});
    const stats = bus.channelStats();
    expect(stats.orphan).toEqual({ subscribers: 0, events: 1 });
  });
});

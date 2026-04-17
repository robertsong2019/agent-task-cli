const { EventBus } = require('../src/utils/event-bus');

describe('EventBus.onBatch()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('receives events from all subscribed channels', () => {
    const received = [];
    bus.onBatch(['task:start', 'task:end'], (e) => received.push(e.channel));
    bus.emit('task:start', { a: 1 });
    bus.emit('task:end', { b: 2 });
    expect(received).toEqual(['task:start', 'task:end']);
  });

  test('unsubscribe removes handler from all channels', () => {
    const received = [];
    const unsub = bus.onBatch(['a', 'b'], (e) => received.push(e.channel));
    unsub();
    bus.emit('a', {});
    bus.emit('b', {});
    expect(received).toEqual([]);
  });

  test('does not receive events from non-subscribed channels', () => {
    const received = [];
    bus.onBatch(['x'], (e) => received.push(e.channel));
    bus.emit('y', {});
    expect(received).toEqual([]);
  });

  test('works with empty array (no-op unsubscribe)', () => {
    const unsub = bus.onBatch([], () => {});
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });
});

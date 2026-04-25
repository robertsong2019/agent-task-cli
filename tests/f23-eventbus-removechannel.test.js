const { EventBus } = require('../src/utils/event-bus');

describe('EventBus.removeChannel()', () => {
  test('removes all subscribers for a channel', () => {
    const bus = new EventBus();
    bus.on('test', () => {});
    bus.on('test', () => {});
    bus.on('other', () => {});
    expect(bus.removeChannel('test')).toBe(2);
    expect(bus.listenerCount('test')).toBe(0);
    expect(bus.listenerCount('other')).toBeGreaterThan(0);
    bus.reset();
  });

  test('returns 0 for unknown channel', () => {
    const bus = new EventBus();
    expect(bus.removeChannel('nope')).toBe(0);
    bus.reset();
  });

  test('removed subscribers no longer receive events', () => {
    const bus = new EventBus();
    let received = false;
    bus.on('ch', () => { received = true; });
    bus.removeChannel('ch');
    bus.emit('ch', {});
    expect(received).toBe(false);
    bus.reset();
  });
});

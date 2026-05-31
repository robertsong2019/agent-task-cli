const { EventBus } = require('../src/utils/event-bus');

describe('F87: EventBus.oncePattern()', () => {
  test('fires once then auto-unsubscribes', () => {
    const bus = new EventBus();
    let count = 0;
    bus.oncePattern('task:*', () => { count++; });
    bus.emit('task:start', {});
    bus.emit('task:end', {});
    expect(count).toBe(1);
  });

  test('receives the event payload', () => {
    const bus = new EventBus();
    let received = null;
    bus.oncePattern('user:*', (e) => { received = e; });
    bus.emit('user:login', { name: 'alice' });
    expect(received.data).toEqual({ name: 'alice' });
    expect(received.channel).toBe('user:login');
  });

  test('cancel before first match prevents handler', () => {
    const bus = new EventBus();
    let count = 0;
    const unsub = bus.oncePattern('sys:*', () => { count++; });
    unsub();
    bus.emit('sys:alert', {});
    expect(count).toBe(0);
  });

  test('multiple oncePattern handlers each fire once independently', () => {
    const bus = new EventBus();
    const results = [];
    bus.oncePattern('log:*', () => { results.push('a'); });
    bus.oncePattern('log:*', () => { results.push('b'); });
    bus.emit('log:info', {});
    bus.emit('log:info', {});
    expect(results).toEqual(['a', 'b']);
  });
});

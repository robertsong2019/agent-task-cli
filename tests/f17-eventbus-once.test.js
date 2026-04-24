const { EventBus } = require('../src/utils/event-bus');

describe('F17: EventBus.once()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('fires handler exactly once then auto-unsubscribes', async () => {
    const calls = [];
    bus.once('x', () => calls.push(1));
    bus.emit('x', {});
    bus.emit('x', {});
    expect(calls).toEqual([1]);
  });

  test('returns unsubscribe that prevents the handler from firing', () => {
    const calls = [];
    const unsub = bus.once('x', () => calls.push(1));
    unsub();
    bus.emit('x', {});
    expect(calls).toEqual([]);
  });

  test('multiple once handlers on same channel each fire once', () => {
    const a = [], b = [];
    bus.once('ch', () => a.push(1));
    bus.once('ch', () => b.push(1));
    bus.emit('ch', {});
    bus.emit('ch', {});
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
  });

  test('receives the event payload', () => {
    let received;
    bus.once('data', (e) => { received = e; });
    bus.emit('data', { foo: 'bar' });
    expect(received.data).toEqual({ foo: 'bar' });
  });
});

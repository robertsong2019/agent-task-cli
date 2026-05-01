const { EventBus } = require('../src/utils/event-bus');

test('prependListener fires before regular on() handlers', () => {
  const bus = new EventBus();
  const order = [];

  bus.on('test', () => order.push('on1'));
  bus.prependListener('test', () => order.push('prepend'));
  bus.on('test', () => order.push('on2'));

  bus.emit('test', {});
  expect(order).toEqual(['prepend', 'on1', 'on2']);
});

test('prependListener returns unsubscribe function', () => {
  const bus = new EventBus();
  const calls = [];
  const unsub = bus.prependListener('test', () => calls.push(1));

  bus.emit('test', {});
  expect(calls).toEqual([1]);

  unsub();
  bus.emit('test', {});
  expect(calls).toEqual([1]);
});

test('prependListener appears in channelNames', () => {
  const bus = new EventBus();
  bus.prependListener('my-channel', () => {});
  expect(bus.channelNames()).toContain('my-channel');
});

test('prependListener wildcard * not tracked in subscribers', () => {
  const bus = new EventBus();
  bus.prependListener('*', () => {});
  // '*' goes through _emitter directly, not _subscribers
  expect(bus.listenerCount('*')).toBeGreaterThanOrEqual(1);
});

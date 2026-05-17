const { EventBus } = require('../src/utils/event-bus');

test('onAny receives all events', () => {
  const bus = new EventBus();
  const received = [];
  const unsub = bus.onAny(e => received.push(e.channel));

  bus.emit('task:started', { id: 1 });
  bus.emit('agent:done', { id: 2 });

  expect(received).toEqual(['task:started', 'agent:done']);
  unsub();
});

test('onAny unsubscribe works', () => {
  const bus = new EventBus();
  const received = [];
  const unsub = bus.onAny(e => received.push(e.channel));

  bus.emit('a', {});
  unsub();
  bus.emit('b', {});

  expect(received).toEqual(['a']);
});

test('onAny works alongside regular listeners', () => {
  const bus = new EventBus();
  const all = [];
  const specific = [];
  bus.onAny(e => all.push(e.channel));
  bus.on('x', e => specific.push(e.data));

  bus.emit('x', { val: 1 });
  bus.emit('y', { val: 2 });

  expect(all).toEqual(['x', 'y']);
  expect(specific).toEqual([{ val: 1 }]);
});

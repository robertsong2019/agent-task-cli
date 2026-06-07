const { EventBus } = require('../src/utils/event-bus');

describe('EventBus.sample (F114)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('fires handler on first event within window', () => {
    const received = [];
    bus.sample('click', 100, (e) => received.push(e.data));

    bus.emit('click', { x: 1 });
    expect(received).toEqual([{ x: 1 }]);
  });

  test('drops subsequent events within interval', async () => {
    const received = [];
    bus.sample('click', 100, (e) => received.push(e.data));

    bus.emit('click', { x: 1 });
    bus.emit('click', { x: 2 });
    bus.emit('click', { x: 3 });

    expect(received).toEqual([{ x: 1 }]);

    // After interval, should fire again
    await new Promise(r => setTimeout(r, 120));
    bus.emit('click', { x: 4 });
    expect(received).toEqual([{ x: 1 }, { x: 4 }]);
  });

  test('allows events from different channels independently', () => {
    const a = [], b = [];
    bus.sample('chan-a', 50, (e) => a.push(e.data));
    bus.sample('chan-b', 50, (e) => b.push(e.data));

    bus.emit('chan-a', { v: 1 });
    bus.emit('chan-b', { v: 2 });
    bus.emit('chan-a', { v: 3 });

    expect(a).toEqual([{ v: 1 }]);
    expect(b).toEqual([{ v: 2 }]);
  });

  test('returned unsubscribe function works', () => {
    const received = [];
    const unsub = bus.sample('test', 50, (e) => received.push(e.data));

    bus.emit('test', { a: 1 });
    expect(received).toHaveLength(1);

    unsub();

    bus.emit('test', { a: 2 });
    expect(received).toHaveLength(1); // no new events after unsub
  });

  test('fires again after interval window resets', async () => {
    const received = [];
    bus.sample('pulse', 50, (e) => received.push(e.data));

    bus.emit('pulse', 1);
    await new Promise(r => setTimeout(r, 60));
    bus.emit('pulse', 2);
    await new Promise(r => setTimeout(r, 60));
    bus.emit('pulse', 3);

    expect(received).toEqual([1, 2, 3]);
  });

  test('first event after subscription fires immediately', () => {
    const received = [];
    bus.sample('instant', 1000, (e) => received.push(e.data));
    bus.emit('instant', 'hello');
    expect(received).toEqual(['hello']);
  });
});

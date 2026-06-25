const { EventBus } = require('../src/utils/event-bus');

describe('F142: EventBus.debounce()', () => {
  let bus;

  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => bus.reset());

  test('only fires after quiet period', async () => {
    const received = [];
    bus.debounce('test', 50, (event) => received.push(event.data.n));

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });
    bus.emit('test', { n: 3 });

    // Nothing yet — debounce waiting
    expect(received).toHaveLength(0);

    // After quiet period
    await new Promise(r => setTimeout(r, 80));
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(3); // only last event
  });

  test('resets timer on new event', async () => {
    const received = [];
    bus.debounce('test', 80, (event) => received.push(event.data.n));

    bus.emit('test', { n: 1 });
    await new Promise(r => setTimeout(r, 40));
    bus.emit('test', { n: 2 }); // resets 80ms timer
    await new Promise(r => setTimeout(r, 50));
    // Only 50ms since last emit — still waiting
    expect(received).toHaveLength(0);

    await new Promise(r => setTimeout(r, 50));
    // Now 100ms since last emit — fires
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(2);
  });

  test('unsubscribe cancels pending debounce', async () => {
    const received = [];
    const unsub = bus.debounce('test', 50, (event) => received.push(event.data.n));

    bus.emit('test', { n: 1 });
    unsub();

    await new Promise(r => setTimeout(r, 80));
    expect(received).toHaveLength(0);
  });

  test('works independently across channels', async () => {
    const receivedA = [];
    const receivedB = [];

    bus.debounce('chanA', 50, (e) => receivedA.push(e.data.n));
    bus.debounce('chanB', 50, (e) => receivedB.push(e.data.n));

    bus.emit('chanA', { n: 1 });
    bus.emit('chanB', { n: 10 });

    await new Promise(r => setTimeout(r, 80));
    expect(receivedA).toEqual([1]);
    expect(receivedB).toEqual([10]);
  });
});

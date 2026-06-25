const { EventBus } = require('../src/utils/event-bus');

describe('F141: EventBus.subscribeThrottled()', () => {
  let bus;

  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => bus.reset());

  test('processes first event immediately', () => {
    const received = [];
    bus.subscribeThrottled('test', 100, (event) => received.push(event.data));

    bus.emit('test', { n: 1 });
    expect(received).toHaveLength(1);
    expect(received[0].n).toBe(1);
  });

  test('throttles subsequent events within interval', async () => {
    const received = [];
    bus.subscribeThrottled('test', 100, (event) => received.push(event.data.n));

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });
    bus.emit('test', { n: 3 });

    // First event immediate, rest throttled
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(1);

    // Wait for throttle window — trailing event fires
    await new Promise(r => setTimeout(r, 150));
    expect(received).toHaveLength(2);
    expect(received[1]).toBe(3); // last event in window
  });

  test('respects interval between fires', async () => {
    const received = [];
    bus.subscribeThrottled('test', 80, (event) => received.push(Date.now()));

    bus.emit('test', { n: 1 });
    await new Promise(r => setTimeout(r, 30));
    bus.emit('test', { n: 2 });

    await new Promise(r => setTimeout(r, 100));
    expect(received).toHaveLength(2);
    // Second fire should be at least ~80ms after first
    expect(received[1] - received[0]).toBeGreaterThanOrEqual(75);
  });

  test('unsubscribe stops processing', async () => {
    const received = [];
    const unsub = bus.subscribeThrottled('test', 50, (event) => received.push(event.data.n));

    bus.emit('test', { n: 1 });
    unsub();
    bus.emit('test', { n: 2 });

    await new Promise(r => setTimeout(r, 80));
    expect(received).toHaveLength(1);
  });

  test('works with different channels independently', async () => {
    const receivedA = [];
    const receivedB = [];

    bus.subscribeThrottled('chanA', 100, (e) => receivedA.push(e.data.n));
    bus.subscribeThrottled('chanB', 100, (e) => receivedB.push(e.data.n));

    bus.emit('chanA', { n: 1 });
    bus.emit('chanB', { n: 10 });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedA[0]).toBe(1);
    expect(receivedB[0]).toBe(10);
  });
});

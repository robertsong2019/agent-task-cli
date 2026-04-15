const { EventBus } = require('../src/utils/event-bus');

describe('EventBus.emitAfter', () => {
  test('should emit event after delay', async () => {
    const bus = new EventBus();
    const received = [];
    bus.on('delayed', (e) => received.push(e.data));

    bus.emitAfter(50, 'delayed', { v: 1 });
    expect(received.length).toBe(0);

    await new Promise(r => setTimeout(r, 100));
    expect(received.length).toBe(1);
    expect(received[0].v).toBe(1);
  });

  test('should cancel delayed emission', async () => {
    const bus = new EventBus();
    const received = [];
    bus.on('cancel', (e) => received.push(e.data));

    const cancel = bus.emitAfter(50, 'cancel', { v: 1 });
    cancel();

    await new Promise(r => setTimeout(r, 100));
    expect(received.length).toBe(0);
  });

  test('should appear in history after firing', async () => {
    const bus = new EventBus();
    bus.emitAfter(30, 'hist', { x: 42 });

    await new Promise(r => setTimeout(r, 80));
    const hist = bus.getHistory({ channel: 'hist' });
    expect(hist.length).toBe(1);
    expect(hist[0].data.x).toBe(42);
  });
});

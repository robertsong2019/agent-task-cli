const { EventBus } = require('../src/utils/event-bus');

describe('F24: EventBus waitFor', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('resolves when event is emitted', async () => {
    const p = bus.waitFor('test');
    setTimeout(() => bus.emit('test', { ok: true }), 10);
    const event = await p;
    expect(event.data).toEqual({ ok: true });
  });

  test('rejects on timeout', async () => {
    await expect(bus.waitFor('slow', 50)).rejects.toThrow(/Timeout waiting/);
  });

  test('resolves before timeout', async () => {
    const p = bus.waitFor('fast', 1000);
    bus.emit('fast', 42);
    const event = await p;
    expect(event.data).toBe(42);
  });
});

const { EventBus } = require('../../src/utils/event-bus');

describe('F211: EventBus.emitSeries(channel, items, opts)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('emits all items in sequence', async () => {
    const received = [];
    bus.on('test', (event) => received.push(event.data));
    const items = [{ n: 1 }, { n: 2 }, { n: 3 }];
    const result = await bus.emitSeries('test', items);
    expect(result.emitted).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(received.map(r => r.n)).toEqual([1, 2, 3]);
  });

  test('handles empty items array', async () => {
    const result = await bus.emitSeries('test', []);
    expect(result.emitted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('collects errors when emit throws (non-atomic)', async () => {
    const originalEmit = bus.emit.bind(bus);
    let callIdx = 0;
    bus.emit = (channel, data) => {
      callIdx++;
      if (data.fail) throw new Error('emit boom');
      originalEmit(channel, data);
    };
    const items = [{ ok: true }, { fail: true }, { ok: true }];
    const result = await bus.emitSeries('test', items, { atomic: false });
    expect(result.emitted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
  });

  test('respects delay between emissions', async () => {
    const timestamps = [];
    bus.on('test', (event) => timestamps.push(Date.now()));
    const start = Date.now();
    await bus.emitSeries('test', [{ a: 1 }, { a: 2 }, { a: 3 }], { delay: 50 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // ~50ms * 2 gaps
    expect(timestamps).toHaveLength(3);
  });

  test('fires wildcard listeners for each item', async () => {
    const received = [];
    bus.on('*', (event) => received.push(event.channel));
    await bus.emitSeries('custom', [{ x: 1 }, { x: 2 }]);
    expect(received).toEqual(['custom', 'custom']);
  });

  test('stores all events in history', async () => {
    await bus.emitSeries('test', [{ n: 1 }, { n: 2 }]);
    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].data.n).toBe(1);
    expect(history[1].data.n).toBe(2);
  });

  test('atomic mode stops on first error', async () => {
    let callCount = 0;
    // Override emit to throw on second item
    const originalEmit = bus.emit.bind(bus);
    bus.emit = (channel, data) => {
      callCount++;
      if (data.fail) throw new Error('intentional');
      originalEmit(channel, data);
    };
    const items = [{ ok: true }, { fail: true }, { ok: true }];
    const result = await bus.emitSeries('test', items, { atomic: true });
    expect(result.emitted).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
    expect(callCount).toBe(2); // stopped after error
  });

  test('non-atomic mode continues after errors', async () => {
    let callCount = 0;
    const originalEmit = bus.emit.bind(bus);
    bus.emit = (channel, data) => {
      callCount++;
      if (data.fail) throw new Error('intentional');
      originalEmit(channel, data);
    };
    const items = [{ ok: true }, { fail: true }, { ok: true }];
    const result = await bus.emitSeries('test', items, { atomic: false });
    expect(result.emitted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(callCount).toBe(3); // processed all
  });

  test('returns correct shape { emitted, errors }', async () => {
    const result = await bus.emitSeries('test', [{ a: 1 }]);
    expect(result).toHaveProperty('emitted');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.emitted).toBe('number');
  });
});

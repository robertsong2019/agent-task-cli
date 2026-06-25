const { EventBus } = require('../src/utils/event-bus');

describe('F143: EventBus.buffer()', () => {
  let bus;

  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => bus.reset());

  test('buffers events and flush returns them', () => {
    const buf = bus.buffer('test');

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });
    bus.emit('test', { n: 3 });

    const items = buf.flush();
    expect(items).toHaveLength(3);
    expect(items[0].data.n).toBe(1);
    expect(items[2].data.n).toBe(3);

    // Buffer is empty after flush
    expect(buf.flush()).toHaveLength(0);
    buf.unsub();
  });

  test('auto-flushes when max is reached', () => {
    const flushed = [];
    const buf = bus.buffer('test', { max: 3, onFlush: (items) => flushed.push(...items) });

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });
    expect(flushed).toHaveLength(0);

    bus.emit('test', { n: 3 });
    expect(flushed).toHaveLength(3);

    buf.unsub();
  });

  test('auto-flushes on timer', async () => {
    const flushed = [];
    const buf = bus.buffer('test', { flushMs: 50, onFlush: (items) => flushed.push(...items) });

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });

    await new Promise(r => setTimeout(r, 80));
    expect(flushed).toHaveLength(2);

    buf.unsub();
  });

  test('clear() empties the buffer', () => {
    const buf = bus.buffer('test');

    bus.emit('test', { n: 1 });
    bus.emit('test', { n: 2 });
    buf.clear();

    expect(buf.flush()).toHaveLength(0);
    buf.unsub();
  });

  test('unsub stops buffering', () => {
    const buf = bus.buffer('test');

    bus.emit('test', { n: 1 });
    buf.unsub();
    bus.emit('test', { n: 2 });

    expect(buf.flush()).toHaveLength(1);
  });

  test('no onFlush callback — flush still works manually', () => {
    const buf = bus.buffer('test');

    bus.emit('test', { n: 42 });
    const items = buf.flush();
    expect(items).toHaveLength(1);
    expect(items[0].data.n).toBe(42);

    buf.unsub();
  });
});

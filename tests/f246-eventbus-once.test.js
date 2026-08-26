const { EventBus } = require('../src/utils/event-bus');

describe('F246: EventBus.onOnce(channel, handler) — one-shot listener', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.destroy ? bus.destroy() : bus._emitter.removeAllListeners();
  });

  test('fires exactly once across repeated emissions', () => {
    const calls = [];
    bus.onOnce('job', (e) => calls.push(e.data.id));
    bus.emit('job', { id: 1 });
    bus.emit('job', { id: 2 });
    bus.emit('job', { id: 3 });
    expect(calls).toEqual([1]);
  });

  test('receives the emitted data payload', () => {
    let received;
    bus.onOnce('data', (e) => { received = e; });
    bus.emit('data', { x: 42 });
    expect(received.data).toEqual({ x: 42 });
    expect(received.channel).toBe('data');
  });

  test('multiple onOnce handlers each fire once', () => {
    let a = 0, b = 0;
    bus.onOnce('ch', () => a++);
    bus.onOnce('ch', () => b++);
    bus.emit('ch', {});
    bus.emit('ch', {});
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  test('coexists with regular on listeners without affecting them', () => {
    let onceCount = 0, alwaysCount = 0;
    bus.onOnce('mix', () => onceCount++);
    bus.on('mix', () => alwaysCount++);
    bus.emit('mix', {});
    bus.emit('mix', {});
    expect(onceCount).toBe(1);
    expect(alwaysCount).toBe(2);
  });

  test('returned unsubscribe removes listener before first fire', () => {
    let fired = 0;
    const off = bus.onOnce('pre', () => fired++);
    off();
    bus.emit('pre', {});
    expect(fired).toBe(0);
  });

  test('off(channel, plainHandler) does not remove the onOnce wrapper', () => {
    let fired = 0;
    const plain = () => {};
    bus.onOnce('tgt', () => fired++);
    bus.on('tgt', plain);
    bus.off('tgt', plain);
    bus.emit('tgt', {});
    expect(fired).toBe(1);
  });

  test('throws TypeError when handler is not a function', () => {
    expect(() => bus.onOnce('ch', 'nope')).toThrow(TypeError);
  });
});

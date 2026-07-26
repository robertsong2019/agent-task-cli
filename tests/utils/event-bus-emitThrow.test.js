const { EventBus } = require('../../src/utils/event-bus');

describe('EventBus F206: emitThrow(channel, data)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('returns count of handlers that fired successfully', () => {
    bus.on('test', () => {});
    bus.on('test', () => {});
    const count = bus.emitThrow('test', { val: 1 });
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('fires handlers with event object', () => {
    const received = [];
    bus.on('event', (evt) => received.push(evt.data));
    bus.emitThrow('event', { x: 42 });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ x: 42 });
  });

  test('stores event in history', () => {
    bus.emitThrow('channel', { foo: 'bar' });
    const last = bus.peek('channel');
    expect(last).toBeTruthy();
    expect(last.data).toEqual({ foo: 'bar' });
  });

  test('throws AggregateError-like when handler throws', () => {
    bus.on('fail', () => { throw new Error('boom'); });
    expect(() => bus.emitThrow('fail', {})).toThrow(/emitThrow/);
  });

  test('error object contains .errors array with all thrown errors', () => {
    bus.on('fail', () => { throw new Error('err1'); });
    bus.on('fail', () => { throw new Error('err2'); });
    try {
      bus.emitThrow('fail', {});
      fail('should have thrown');
    } catch (e) {
      expect(e.errors).toBeDefined();
      expect(e.errors).toHaveLength(2);
      expect(e.errors[0].message).toBe('err1');
      expect(e.errors[1].message).toBe('err2');
    }
  });

  test('continues executing remaining handlers after one throws', () => {
    let handler3Fired = false;
    bus.on('chain', () => { throw new Error('first fails'); });
    bus.on('chain', () => { handler3Fired = true; });
    try {
      bus.emitThrow('chain', {});
    } catch (e) { /* expected */ }
    expect(handler3Fired).toBe(true);
  });

  test('works with wildcard listeners', () => {
    let starFired = false;
    bus.on('*', () => { starFired = true; });
    bus.emitThrow('special', {});
    expect(starFired).toBe(true);
  });

  test('returns success count when no errors', () => {
    bus.on('ok', () => 1);
    bus.on('ok', () => 2);
    const count = bus.emitThrow('ok', {});
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('default data is empty object', () => {
    const events = [];
    bus.on('default', (evt) => events.push(evt));
    bus.emitThrow('default');
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({});
  });
});

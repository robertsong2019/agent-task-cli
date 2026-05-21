const { EventBus } = require('../src/utils/event-bus');

describe('F75: EventBus.off(channel, handler)', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('removes specific handler and returns true', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    expect(bus.subscriberCount('test')).toBe(1);
    const result = bus.off('test', handler);
    expect(result).toBe(true);
    expect(bus.subscriberCount('test')).toBe(0);
  });

  test('returns false if handler not found', () => {
    const result = bus.off('test', jest.fn());
    expect(result).toBe(false);
  });

  test('returns false for non-existent channel', () => {
    expect(bus.off('missing', jest.fn())).toBe(false);
  });

  test('only removes specified handler, not others', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on('ch', h1);
    bus.on('ch', h2);
    bus.off('ch', h1);
    bus.emit('ch', 'data');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
    expect(h2.mock.calls[0][0].data).toBe('data');
  });

  test('removed handler no longer receives events', () => {
    const handler = jest.fn();
    bus.on('evt', handler);
    bus.emit('evt', 'before');
    bus.off('evt', handler);
    bus.emit('evt', 'after');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].data).toBe('before');
  });
});

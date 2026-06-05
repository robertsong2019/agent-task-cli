const { EventBus } = require('../../src/utils/event-bus');

describe('EventBus F108: race(channels[], timeout?)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('resolves with first event from competing channels', async () => {
    const promise = bus.race(['a', 'b', 'c']);
    bus.emit('b', { msg: 'won' });
    const result = await promise;
    expect(result.channel).toBe('b');
    expect(result.data).toEqual({ msg: 'won' });
  });

  test('resolves when first channel fires', async () => {
    const promise = bus.race(['x', 'y']);
    bus.emit('x', 123);
    const result = await promise;
    expect(result.channel).toBe('x');
    expect(result.data).toBe(123);
  });

  test('rejects on timeout', async () => {
    const promise = bus.race(['a', 'b'], 50);
    await expect(promise).rejects.toThrow(/race timeout/);
  });

  test('rejects with channel names in timeout message', async () => {
    const promise = bus.race(['alpha', 'beta'], 50);
    await expect(promise).rejects.toThrow(/alpha.*beta|beta.*alpha/);
  });

  test('cleans up all listeners after resolve', async () => {
    const promise = bus.race(['a', 'b']);
    bus.emit('a', 'data');
    await promise;
    expect(bus._emitter.listenerCount('a')).toBe(0);
    expect(bus._emitter.listenerCount('b')).toBe(0);
  });

  test('cleans up all listeners after timeout', async () => {
    const promise = bus.race(['x', 'y'], 50);
    await promise.catch(() => {});
    expect(bus._emitter.listenerCount('x')).toBe(0);
    expect(bus._emitter.listenerCount('y')).toBe(0);
  });

  test('only first emit resolves the promise', async () => {
    const promise = bus.race(['a', 'b']);
    bus.emit('a', 1);
    bus.emit('b', 2);
    const result = await promise;
    expect(result.channel).toBe('a');
    expect(result.data).toBe(1);
  });

  test('works with single channel', async () => {
    const promise = bus.race(['only']);
    bus.emit('only', { val: true });
    const result = await promise;
    expect(result.channel).toBe('only');
    expect(result.data).toEqual({ val: true });
  });
});

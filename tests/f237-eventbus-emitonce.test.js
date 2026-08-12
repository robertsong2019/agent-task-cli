const { EventBus } = require('../src/utils/event-bus');

describe('F237: EventBus.emitOnce(channel, data, keyFn)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('emits first occurrence and returns true', () => {
    const received = [];
    bus.on('alerts', e => received.push(e.data));
    const result = bus.emitOnce('alerts', { level: 'warn' });
    expect(result).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ level: 'warn' });
  });

  test('suppresses duplicate (same JSON data) and returns false', () => {
    const received = [];
    bus.on('alerts', e => received.push(e.data));

    expect(bus.emitOnce('alerts', { level: 'warn' })).toBe(true);
    expect(bus.emitOnce('alerts', { level: 'warn' })).toBe(false);
    expect(received).toHaveLength(1);
  });

  test('allows different data on same channel', () => {
    const received = [];
    bus.on('alerts', e => received.push(e.data));

    bus.emitOnce('alerts', { level: 'warn' });
    bus.emitOnce('alerts', { level: 'error' });
    bus.emitOnce('alerts', { level: 'info' });

    expect(received).toHaveLength(3);
  });

  test('custom keyFn for domain-specific dedup', () => {
    const received = [];
    bus.on('users', e => received.push(e.data));

    const keyFn = data => data.userId;
    bus.emitOnce('users', { userId: 'u1', action: 'login' }, keyFn);
    bus.emitOnce('users', { userId: 'u1', action: 'logout' }, keyFn); // same key → suppressed
    bus.emitOnce('users', { userId: 'u2', action: 'login' }, keyFn);

    expect(received).toHaveLength(2);
    expect(received[0].userId).toBe('u1');
    expect(received[1].userId).toBe('u2');
  });

  test('dedup is per-channel, not global', () => {
    const a = [], b = [];
    bus.on('ch1', e => a.push(e.data));
    bus.on('ch2', e => b.push(e.data));

    bus.emitOnce('ch1', { msg: 'hello' });
    bus.emitOnce('ch2', { msg: 'hello' });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  test('records event in history when emitted', () => {
    bus.emitOnce('test', { val: 42 });
    const events = bus.last('test');
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ val: 42 });
  });

  test('no history entry when suppressed', () => {
    bus.emitOnce('test', { val: 1 });
    bus.emitOnce('test', { val: 1 }); // suppressed
    const events = bus.last('test');
    expect(events).toHaveLength(1);
  });

  test('empty channel still works', () => {
    const result = bus.emitOnce('nobody-listening', { data: 'test' });
    expect(result).toBe(true);
  });

  test('dedup keys persist across many emissions', () => {
    const received = [];
    bus.on('events', e => received.push(e.data));

    for (let i = 0; i < 5; i++) {
      bus.emitOnce('events', { id: i });
      bus.emitOnce('events', { id: i }); // always dup
    }

    expect(received).toHaveLength(5);
  });
});

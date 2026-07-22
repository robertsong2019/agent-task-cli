const { EventBus } = require('../../src/utils/event-bus');

describe('F202: EventBus.emitIfChanged(channel, data, keyFn)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus({ maxHistory: 50 });
  });

  test('emits on first call, suppresses duplicate', () => {
    let count = 0;
    bus.on('ch', () => count++);
    const emitted1 = bus.emitIfChanged('ch', { a: 1 });
    const emitted2 = bus.emitIfChanged('ch', { a: 1 });
    expect(emitted1).toBe(true);
    expect(emitted2).toBe(false);
    expect(count).toBe(1);
  });

  test('emits when data changes', () => {
    let count = 0;
    bus.on('ch', () => count++);
    bus.emitIfChanged('ch', { a: 1 });
    bus.emitIfChanged('ch', { a: 2 });
    bus.emitIfChanged('ch', { a: 2 });
    expect(count).toBe(2);
  });

  test('uses keyFn for custom dedup logic', () => {
    let count = 0;
    bus.on('ch', () => count++);
    const keyFn = (data) => data.id; // only compare by id
    bus.emitIfChanged('ch', { id: 'x', name: 'foo' }, keyFn);
    bus.emitIfChanged('ch', { id: 'x', name: 'bar' }, keyFn); // same id, suppressed
    bus.emitIfChanged('ch', { id: 'y', name: 'baz' }, keyFn); // different id, emitted
    expect(count).toBe(2);
  });

  test('tracks channels independently', () => {
    let countA = 0, countB = 0;
    bus.on('a', () => countA++);
    bus.on('b', () => countB++);
    bus.emitIfChanged('a', { v: 1 });
    bus.emitIfChanged('b', { v: 1 }); // different channel, should emit
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  test('emits after data changes back to previous value', () => {
    let count = 0;
    bus.on('ch', () => count++);
    bus.emitIfChanged('ch', { v: 1 });
    bus.emitIfChanged('ch', { v: 2 });
    bus.emitIfChanged('ch', { v: 1 }); // back to original, but different from last emit
    expect(count).toBe(3);
  });

  test('handles primitives (string data)', () => {
    let count = 0;
    bus.on('ch', () => count++);
    bus.emitIfChanged('ch', 'hello');
    bus.emitIfChanged('ch', 'hello');
    bus.emitIfChanged('ch', 'world');
    expect(count).toBe(2);
  });

  test('returns false when no subscribers (but still records)', () => {
    const emitted = bus.emitIfChanged('ch', { a: 1 });
    expect(emitted).toBe(true); // emit still "changes", just no listeners
    // Second call with same data should still suppress
    const emitted2 = bus.emitIfChanged('ch', { a: 1 });
    expect(emitted2).toBe(false);
  });
});

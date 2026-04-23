const { EventBus } = require('../src/utils/event-bus');

describe('F16: EventBus.emitBatch()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('emits multiple events on same channel', () => {
    const received = [];
    bus.on('task', e => received.push(e.data));
    const count = bus.emitBatch('task', [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(count).toBe(3);
    expect(received).toHaveLength(3);
    expect(received.map(d => d.id)).toEqual([1, 2, 3]);
  });

  test('records single summary in history', () => {
    bus.emitBatch('task', [{ a: 1 }, { b: 2 }]);
    const history = bus.getHistory({ channel: 'task' });
    expect(history).toHaveLength(1);
    expect(history[0].data.count).toBe(2);
  });

  test('wildcard listeners receive all batch events', () => {
    const all = [];
    bus.on('*', e => all.push(e));
    bus.emitBatch('x', [1, 2]);
    expect(all).toHaveLength(2);
  });

  test('returns 0 for empty array', () => {
    expect(bus.emitBatch('ch', [])).toBe(0);
    expect(bus.emitBatch('ch')).toBe(0);
  });

  test('returns 0 for non-array input', () => {
    expect(bus.emitBatch('ch', 'not-array')).toBe(0);
  });

  test('history respects maxHistory', () => {
    const small = new (require('../src/utils/event-bus').EventBus)();
    small._maxHistory = 3;
    small.emitBatch('a', [1, 2]);
    small.emitBatch('b', [3]);
    small.emitBatch('c', [4, 5]);
    small.emitBatch('d', [6]);
    expect(small._history.length).toBeLessThanOrEqual(3);
  });
});

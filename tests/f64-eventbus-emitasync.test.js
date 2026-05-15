const { EventBus } = require('../src/utils/event-bus');

describe('F64: EventBus emitAsync()', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('awaits async handlers and returns results', async () => {
    bus.on('test', async (e) => e.data.value * 2);
    const { event, results } = await bus.emitAsync('test', { value: 21 });
    expect(results).toEqual([42]);
    expect(event.channel).toBe('test');
  });

  test('handles mix of sync and async handlers', async () => {
    bus.on('test', (e) => 'sync');
    bus.on('test', async (e) => 'async');
    const { results } = await bus.emitAsync('test', {});
    expect(results).toContain('sync');
    expect(results).toContain('async');
  });

  test('stores event in history', async () => {
    await bus.emitAsync('mychan', { x: 1 });
    const hist = bus.getHistory({ channel: 'mychan' });
    expect(hist).toHaveLength(1);
    expect(hist[0].data.x).toBe(1);
  });

  test('tolerates handler that throws', async () => {
    bus.on('test', () => { throw new Error('boom'); });
    bus.on('test', () => 'ok');
    const { results } = await bus.emitAsync('test', {});
    expect(results).toContain('ok');
    expect(results).toContain(undefined); // the throwing handler
  });

  test('fires wildcard listeners too', async () => {
    bus.on('*', (e) => 'wildcard');
    const { results } = await bus.emitAsync('chan', {});
    expect(results).toContain('wildcard');
  });
});

const { TaskChain } = require('../src/task-chain');
const { EventEmitter } = require('events');

function makeOrchestrator(results = {}) {
  const ee = new EventEmitter();
  return {
    run: jest.fn().mockImplementation((config) => {
      const task = new EventEmitter();
      task.results = results[config.name || config.task] || { ok: true };
      process.nextTick(() => {
        task.emit('complete');
      });
      return Promise.resolve(task);
    })
  };
}

describe('F21: TaskChain.tap()', () => {
  test('tap fires for specific step on success', async () => {
    const orch = makeOrchestrator({ test: { data: 42 } });
    const chain = new TaskChain(orch);
    const tapped = [];
    chain.add('s1', { task: 'test' });
    chain.tap('s1', (info) => tapped.push(info));
    await chain.execute();
    expect(tapped).toHaveLength(1);
    expect(tapped[0].name).toBe('s1');
    expect(tapped[0].status).toBe('completed');
    expect(tapped[0].result).toEqual({ data: 42 });
  });

  test('tap does not fire for other steps', async () => {
    const orch = makeOrchestrator();
    const chain = new TaskChain(orch);
    const tapped = [];
    chain.add('s1', { task: 'a' });
    chain.add('s2', { task: 'b' });
    chain.tap('s1', (info) => tapped.push(info.name));
    await chain.execute();
    expect(tapped).toEqual(['s1']);
  });

  test('multiple taps on same step', async () => {
    const orch = makeOrchestrator();
    const chain = new TaskChain(orch);
    const log = [];
    chain.add('s1', { task: 'a' });
    chain.tap('s1', () => log.push('first'));
    chain.tap('s1', () => log.push('second'));
    await chain.execute();
    expect(log).toEqual(['first', 'second']);
  });

  test('tap throws for unknown step', () => {
    const chain = new TaskChain(makeOrchestrator());
    expect(() => chain.tap('nope', () => {})).toThrow('Unknown step: nope');
  });

  test('tap throws for non-function callback', () => {
    const chain = new TaskChain(makeOrchestrator());
    chain.add('s1', { task: 'a' });
    expect(() => chain.tap('s1', 'not-a-fn')).toThrow('tap requires a function argument');
  });

  test('tap errors do not break chain execution', async () => {
    const orch = makeOrchestrator();
    const chain = new TaskChain(orch);
    chain.add('s1', { task: 'a' });
    chain.tap('s1', () => { throw new Error('boom'); });
    const results = await chain.execute();
    expect(results.s1).toBeDefined();
  });

  test('tap fires on failed step', async () => {
    const orch = {
      run: jest.fn().mockImplementation(() => {
        const task = new EventEmitter();
        process.nextTick(() => task.emit('error', new Error('fail')));
        return Promise.resolve(task);
      })
    };
    const chain = new TaskChain(orch, { stopOnError: false });
    // Override _executeStep to not throw
    chain.add('s1', { task: 'a' });
    const tapped = [];
    chain.tap('s1', (info) => tapped.push(info.status));
    // execute will throw due to step failure, but tap should still fire
    try { await chain.execute(); } catch (_) {}
    expect(tapped).toContain('failed');
  });
});

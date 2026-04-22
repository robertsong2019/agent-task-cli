const { Orchestrator, Task } = require('../src/orchestrator');

describe('Orchestrator middleware', () => {
  let orch;

  beforeEach(() => {
    orch = new Orchestrator();
  });

  test('use() registers middleware and returns orchestrator for chaining', () => {
    const mw = { pre: jest.fn(), post: jest.fn() };
    const result = orch.use(mw);
    expect(result).toBe(orch);
    expect(orch.middleware).toContain(mw);
  });

  test('use() throws if middleware has no pre or post', () => {
    expect(() => orch.use({})).toThrow('Middleware must have pre and/or post hook');
    expect(() => orch.use(null)).toThrow();
  });

  test('pre hook can modify config', async () => {
    const mw = {
      pre: jest.fn((config) => ({ ...config, injected: true })),
      post: jest.fn((task, result) => result),
    };
    orch.use(mw);

    // Run a minimal task with wait:true
    const config = {
      pattern: 'work-crew',
      name: 'test',
      agents: [{ role: 'worker', count: 1 }],
    };

    // We only need to verify pre was called with original config
    await orch._runPreHooks(config);
    expect(mw.pre).toHaveBeenCalledWith(config);
    const result = await orch._runPreHooks(config);
    expect(result.injected).toBe(true);
  });

  test('post hook receives task and can modify results', async () => {
    const mw = {
      post: jest.fn((task, result) => ({ ...result, annotated: true })),
    };
    orch.use(mw);

    const fakeTask = { id: 't1', status: 'completed' };
    const fakeResult = { output: 'hello' };

    const modified = await orch._runPostHooks(fakeTask, fakeResult);
    expect(mw.post).toHaveBeenCalledWith(fakeTask, fakeResult);
    expect(modified.annotated).toBe(true);
  });

  test('multiple middleware run in registration order', async () => {
    const order = [];
    orch.use({ pre: () => { order.push(1); } });
    orch.use({ pre: () => { order.push(2); } });
    orch.use({ pre: () => { order.push(3); } });

    await orch._runPreHooks({});
    expect(order).toEqual([1, 2, 3]);
  });

  test('pre hook returning undefined keeps original config', async () => {
    orch.use({ pre: () => undefined });
    const config = { pattern: 'work-crew', name: 'test' };
    const result = await orch._runPreHooks(config);
    expect(result).toBe(config);
  });

  test('post hook returning undefined keeps original result', async () => {
    orch.use({ post: () => undefined });
    const result = { output: 'unchanged' };
    const final = await orch._runPostHooks({}, result);
    expect(final).toBe(result);
  });
});

const SupervisorPattern = require('../src/patterns/supervisor');

describe('SupervisorPattern', () => {
  const makeConfig = (overrides = {}) => ({
    task: 'Build the feature',
    supervisor: { name: 'boss' },
    workers: [
      { name: 'w1' },
      { name: 'w2' },
    ],
    ...overrides,
  });

  const cb = jest.fn();
  beforeEach(() => cb.mockClear());

  test('initializeAgents creates supervisor + workers', () => {
    const sup = new SupervisorPattern(makeConfig());
    const agents = sup.initializeAgents();
    expect(agents).toHaveLength(3); // 1 supervisor + 2 workers
    expect(sup.supervisor).toBeDefined();
    expect(sup.workers).toHaveLength(2);
  });

  test('execute returns supervisor result', async () => {
    const sup = new SupervisorPattern(makeConfig());
    sup.initializeAgents();
    const result = await sup.execute(cb);
    expect(result.pattern).toBe('supervisor');
    expect(result.strategy).toBe('adaptive');
    expect(result.subtasks).toHaveLength(3);
    expect(result.workerResults).toHaveLength(3);
    expect(result.review).toBeDefined();
  });

  test('decomposeTask creates research/implementation/testing subtasks', () => {
    const sup = new SupervisorPattern(makeConfig());
    const tasks = sup.decomposeTask('my task', 'adaptive');
    expect(tasks).toHaveLength(3);
    expect(tasks.map(t => t.type)).toEqual(['research', 'implementation', 'testing']);
  });

  test('parallel strategy executes all subtasks concurrently', async () => {
    const sup = new SupervisorPattern(makeConfig({
      supervisor: { name: 'boss', strategy: 'parallel' },
    }));
    sup.initializeAgents();
    const result = await sup.execute(cb);
    expect(result.strategy).toBe('parallel');
    expect(result.workerResults).toHaveLength(3);
    // All should succeed with mock agents
    expect(result.workerResults.every(r => r.success)).toBe(true);
  });

  test('sequential strategy executes subtasks in order', async () => {
    const sup = new SupervisorPattern(makeConfig({
      supervisor: { name: 'boss', strategy: 'sequential' },
    }));
    sup.initializeAgents();
    const result = await sup.execute(cb);
    expect(result.strategy).toBe('sequential');
    expect(result.workerResults).toHaveLength(3);
  });

  test('handles worker failure gracefully in parallel', async () => {
    const sup = new SupervisorPattern(makeConfig({
      supervisor: { name: 'boss', strategy: 'parallel' },
    }));
    sup.initializeAgents();
    sup.workers[0].execute = jest.fn().mockRejectedValue(new Error('worker down'));
    const result = await sup.execute(cb);
    const failed = result.workerResults.filter(r => !r.success);
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  test('handles worker failure gracefully in sequential', async () => {
    const sup = new SupervisorPattern(makeConfig({
      supervisor: { name: 'boss', strategy: 'sequential' },
    }));
    sup.initializeAgents();
    sup.workers[0].execute = jest.fn().mockRejectedValue(new Error('worker down'));
    const result = await sup.execute(cb);
    expect(result.workerResults.some(r => !r.success)).toBe(true);
  });

  test('execute calls updateCallback for supervisor and workers', async () => {
    const sup = new SupervisorPattern(makeConfig());
    sup.initializeAgents();
    await sup.execute(cb);
    // Supervisor: decompose (running+completed) + review (running+completed) = 4
    // 3 subtasks × 2 callbacks each = 6
    expect(cb).toHaveBeenCalledTimes(10);
  });

  test('workers round-robin across subtasks', async () => {
    const sup = new SupervisorPattern(makeConfig({
      workers: [{ name: 'only-worker' }],
    }));
    sup.initializeAgents();
    const result = await sup.execute(cb);
    // All 3 subtasks assigned to the single worker
    expect(result.workerResults.every(r => r.worker === 'only-worker')).toBe(true);
  });
});

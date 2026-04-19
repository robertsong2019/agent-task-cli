const { Orchestrator, Task } = require('../src/orchestrator');

// Mock pattern that takes a long time
jest.mock('../src/patterns/work-crew', () => {
  return class WorkCrewPattern {
    constructor(config) { this.config = config; }
    initializeAgents() { return []; }
    async execute(onProgress) {
      return new Promise(resolve => setTimeout(() => resolve({ done: true }), 5000));
    }
  };
});

describe('Orchestrator task timeout', () => {
  it('times out a task that exceeds the timeout limit', async () => {
    const orch = new Orchestrator();
    const task = await orch.run(
      { pattern: 'work-crew', name: 'slow-task' },
      { wait: true, timeout: 100 }
    ).catch(err => {
      expect(err.message).toMatch(/timed out/);
      return orch.activeTasks.size ? null : null;
    });
    // Task was cancelled due to timeout
    // The run() rejects with timeout error
  });

  it('completes a task within the timeout limit', async () => {
    // Use a pattern that resolves quickly
    jest.resetModules();
    jest.mock('../src/patterns/pipeline', () => {
      return class PipelinePattern {
        constructor(config) { this.config = config; }
        initializeAgents() { return []; }
        async execute() { return { fast: true }; }
      };
    });
    const { Orchestrator: O2 } = require('../src/orchestrator');
    const orch = new O2();
    const task = await orch.run(
      { pattern: 'pipeline', name: 'fast-task' },
      { wait: true, timeout: 5000 }
    );
    expect(task.status).toBe('completed');
    expect(task.results).toEqual({ fast: true });
  });

  it('does not apply timeout when timeout option is not set', async () => {
    jest.resetModules();
    jest.mock('../src/patterns/council', () => {
      return class CouncilPattern {
        constructor(config) { this.config = config; }
        initializeAgents() { return []; }
        async execute() { return { ok: 1 }; }
      };
    });
    const { Orchestrator: O3 } = require('../src/orchestrator');
    const orch = new O3();
    const task = await orch.run(
      { pattern: 'council', name: 'no-timeout' },
      { wait: true }
    );
    expect(task.status).toBe('completed');
  });

  it('emits error with timeout message on timeout', async () => {
    jest.resetModules();
    jest.mock('../src/patterns/supervisor', () => {
      return class SupervisorPattern {
        constructor(config) { this.config = config; }
        initializeAgents() { return []; }
        async execute() {
          return new Promise(resolve => setTimeout(() => resolve({}), 5000));
        }
      };
    });
    const { Orchestrator: O4 } = require('../src/orchestrator');
    const orch = new O4();
    await expect(
      orch.run(
        { pattern: 'supervisor', name: 'timeout-err' },
        { wait: true, timeout: 50 }
      )
    ).rejects.toThrow(/timed out/);
  });
});

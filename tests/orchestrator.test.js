const { Orchestrator } = require('../src/orchestrator');

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(async () => {
    // Clean up active tasks
    if (orchestrator && orchestrator.activeTasks) {
      for (const [taskId, task] of orchestrator.activeTasks) {
        task.removeAllListeners();
        task.cancel();
      }
      orchestrator.activeTasks.clear();
    }
    // Give time for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('should create orchestrator instance', () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator.patterns).toBeDefined();
    expect(Object.keys(orchestrator.patterns).length).toBe(5);
  });

  test('should throw error for unknown pattern', () => {
    expect(() => orchestrator.getPattern('unknown-pattern')).toThrow('Unknown pattern');
  });

  test('should return pattern class for valid pattern', () => {
    const pattern = orchestrator.getPattern('work-crew');
    expect(pattern).toBeDefined();
  });

  test('should run task with work-crew pattern', async () => {
    const config = {
      name: 'Test Task',
      pattern: 'work-crew',
      agents: [
        { name: 'agent-1', role: 'Test role' }
      ],
      task: 'Test task'
    };

    const task = await orchestrator.run(config, { wait: true });
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.status).toBe('completed'); // Should be completed after waiting
    expect(task.config).toBe(config);

    // Clean up task
    task.removeAllListeners();
  });

  test('should cancel running task', async () => {
    const config = {
      name: 'Test Task',
      pattern: 'work-crew',
      agents: [
        { name: 'agent-1', role: 'Test role' }
      ],
      task: 'Test task'
    };

    const task = await orchestrator.run(config);
    const cancelledTask = await orchestrator.cancel(task.id);
    
    expect(cancelledTask).toBeDefined();
    expect(cancelledTask.cancelled).toBe(true);
    
    // Clean up task
    task.removeAllListeners();
  });
});

const { Orchestrator } = require('../src/orchestrator');

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
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

    const task = await orchestrator.run(config);
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.config).toBe(config);
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
  });
});

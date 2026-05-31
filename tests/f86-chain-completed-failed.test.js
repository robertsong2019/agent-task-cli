const { TaskChain } = require('../src/task-chain');
const { Orchestrator } = require('../src/orchestrator');

function createChain(options = {}) {
  const orch = new Orchestrator({ logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} } });
  return new TaskChain(orch, options);
}

describe('F86: TaskChain.getCompletedSteps & getFailedSteps', () => {
  test('getCompletedSteps returns empty before execution', () => {
    const chain = createChain();
    chain.add('a', { pattern: 'work-crew', task: 't1', agents: [] });
    expect(chain.getCompletedSteps()).toEqual([]);
  });

  test('getFailedSteps returns empty before execution', () => {
    const chain = createChain();
    chain.add('a', { pattern: 'work-crew', task: 't1', agents: [] });
    expect(chain.getFailedSteps()).toEqual([]);
  });

  test('getCompletedSteps returns names of successful steps', async () => {
    const chain = createChain();
    chain.add('step1', {
      pattern: 'work-crew',
      task: 'do stuff',
      agents: [{ name: 'a1', role: 'worker' }],
      _mockResult: { output: 'done' }
    });
    // Manually mark as completed to test without full execution
    chain.steps.get('step1').status = 'completed';
    expect(chain.getCompletedSteps()).toEqual(['step1']);
  });

  test('getFailedSteps returns names of failed steps', () => {
    const chain = createChain();
    chain.add('bad', { pattern: 'work-crew', task: 't', agents: [] });
    chain.steps.get('bad').status = 'failed';
    expect(chain.getFailedSteps()).toEqual(['bad']);
  });

  test('mixed completed and failed steps', () => {
    const chain = createChain();
    chain.add('s1', { pattern: 'work-crew', task: 't1', agents: [] });
    chain.add('s2', { pattern: 'work-crew', task: 't2', agents: [] });
    chain.add('s3', { pattern: 'work-crew', task: 't3', agents: [] });
    chain.steps.get('s1').status = 'completed';
    chain.steps.get('s2').status = 'failed';
    chain.steps.get('s3').status = 'completed';
    expect(chain.getCompletedSteps()).toEqual(['s1', 's3']);
    expect(chain.getFailedSteps()).toEqual(['s2']);
  });
});

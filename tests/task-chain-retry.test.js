const { TaskChain } = require('../src/task-chain');

// Mock orchestrator that can fail on demand
function createMockOrchestrator(failSteps = []) {
  let callCount = {};
  return {
    _failSteps: failSteps,
    _callCount: callCount,
    run: jest.fn().mockImplementation(async (config) => {
      const stepName = config._stepName || 'unknown';
      callCount[stepName] = (callCount[stepName] || 0) + 1;

      // Fail on first attempt for listed steps
      if (failSteps.includes(stepName) && callCount[stepName] === 1) {
        const task = {
          on: jest.fn((event, handler) => {
            if (event === 'error') handler(new Error(`Step ${stepName} failed`));
          }),
          results: null
        };
        return task;
      }

      const task = {
        on: jest.fn((event, handler) => {
          if (event === 'complete') handler({ output: `${stepName}-result` });
        }),
        results: { output: `${stepName}-result` }
      };
      return task;
    })
  };
}

describe('TaskChain retry', () => {
  test('retries a failed step and succeeds on second attempt', async () => {
    const orchestrator = createMockOrchestrator(['step1']);

    const chain = new TaskChain(orchestrator, { stopOnError: false });
    // Manually set up step status as failed
    chain.add('step1', { _stepName: 'step1', pattern: 'work-crew', task: 'do stuff', agents: [] });
    
    // First execution will fail
    try {
      await chain.execute();
    } catch (e) {
      // Expected - step1 fails on first try
    }

    // Now retry - this time it should succeed
    const result = await chain.retry('step1');
    expect(result).toEqual({ output: 'step1-result' });
    expect(orchestrator._callCount['step1']).toBe(2);
  });

  test('throws when retrying non-existent step', async () => {
    const orchestrator = createMockOrchestrator();
    const chain = new TaskChain(orchestrator);
    await expect(chain.retry('nonexistent')).rejects.toThrow('Unknown step');
  });

  test('retries multiple times with maxRetries', async () => {
    // Step always fails
    const orchestrator = {
      run: jest.fn().mockImplementation(async () => {
        return {
          on: jest.fn((event, handler) => {
            if (event === 'error') handler(new Error('always fails'));
          }),
          results: null
        };
      })
    };

    const chain = new TaskChain(orchestrator, { stopOnError: false });
    chain.add('flaky', { pattern: 'work-crew', task: 'test', agents: [] });
    try {
      await chain.execute();
    } catch (e) {}

    await expect(chain.retry('flaky', { maxRetries: 3 })).rejects.toThrow('always fails');
    // 1 from execute + 3 from retry = 4 total calls
    expect(orchestrator.run).toHaveBeenCalledTimes(4);
  });

  test('emits chain:step:retried events', async () => {
    const orchestrator = createMockOrchestrator(['step1']);
    const events = [];
    
    const chain = new TaskChain(orchestrator, { stopOnError: false });
    chain.add('step1', { _stepName: 'step1', pattern: 'work-crew', task: 'test', agents: [] });
    
    try { await chain.execute(); } catch (e) {}

    chain._eventBus.on('chain:step:retried', (e) => events.push(e.data));
    await chain.retry('step1');

    expect(events.length).toBe(1);
    expect(events[0].step).toBe('step1');
    expect(events[0].attempt).toBe(1);
    expect(events[0].succeeded).toBe(true);
  });

  test('retry with delay respects delayMs', async () => {
    jest.useFakeTimers();
    const orchestrator = createMockOrchestrator(['step1']);
    
    const chain = new TaskChain(orchestrator, { stopOnError: false });
    chain.add('step1', { _stepName: 'step1', pattern: 'work-crew', task: 'test', agents: [] });
    try { await chain.execute(); } catch (e) {}

    const retryPromise = chain.retry('step1', { maxRetries: 2, delayMs: 100 });
    await jest.advanceTimersByTimeAsync(200);
    await retryPromise;
    
    jest.useRealTimers();
  });
});

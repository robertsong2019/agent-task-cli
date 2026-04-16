const { TaskChain } = require('../src/task-chain');

function mockOrchestrator() {
  return {
    run: jest.fn().mockImplementation(() => {
      // Return a task that never completes on its own
      const task = {
        on: jest.fn(),
        results: { ok: true }
      };
      return Promise.resolve(task);
    })
  };
}

describe('TaskChain.abort()', () => {
  it('returns false when chain is not running', () => {
    const chain = new TaskChain(mockOrchestrator());
    expect(chain.abort()).toBe(false);
    expect(chain.status).toBe('pending');
  });

  it('marks chain as aborted and sets status', () => {
    const chain = new TaskChain(mockOrchestrator());
    chain.add('a', { pattern: 'work-crew', agents: [] });
    // Simulate running state
    chain.status = 'running';
    const result = chain.abort();
    expect(result).toBe(true);
    expect(chain.status).toBe('aborted');
  });

  it('aborted chain marks pending steps as aborted', () => {
    const chain = new TaskChain(mockOrchestrator());
    chain.add('a', { pattern: 'work-crew', agents: [] });
    chain.add('b', { pattern: 'work-crew', agents: [] });
    chain.status = 'running';
    chain.abort();
    const status = chain.getStatus();
    expect(status.status).toBe('aborted');
    const steps = status.steps;
    expect(steps.every(s => s.status === 'aborted')).toBe(true);
  });

  it('execute rejects with abort error when aborted mid-execution', async () => {
    const orc = mockOrchestrator();
    const chain = new TaskChain(orc);
    chain.add('a', { pattern: 'work-crew', agents: [] });

    // Start execution — the mock task never resolves 'complete',
    // but the execute loop will check _aborted after the step tries to await
    const execPromise = chain.execute();

    // Give event loop a tick to enter execute
    await new Promise(r => setTimeout(r, 5));
    chain.abort();

    await expect(execPromise).rejects.toThrow('Chain aborted');
  });
});

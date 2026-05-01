const { TaskChain } = require('../src/task-chain');

// Minimal mock orchestrator to avoid Cache setInterval
const mockOrch = { on: () => {}, emit: () => {} };

describe('TaskChain.progress & retryAll', () => {
  let chain;

  beforeEach(() => {
    chain = new TaskChain(mockOrch);
  });

  it('progress returns zeros for empty chain', () => {
    const p = chain.progress;
    expect(p.total).toBe(0);
    expect(p.completed).toBe(0);
    expect(p.failed).toBe(0);
    expect(p.percent).toBe(0);
  });

  it('progress reflects step states', () => {
    chain.add('s1', { agents: ['a1'], task: 'do stuff' });
    const step = chain.steps.get('s1');
    step.status = 'completed';
    step.result = { ok: true };
    step.completedAt = Date.now();
    chain.results.s1 = step.result;

    chain.add('s2', { agents: ['a1'], task: 'fail stuff' });
    chain.steps.get('s2').status = 'failed';
    chain.steps.get('s2').error = new Error('boom');

    chain.add('s3', { agents: ['a1'], task: 'waiting' });

    const p = chain.progress;
    expect(p.total).toBe(3);
    expect(p.completed).toBe(1);
    expect(p.failed).toBe(1);
    expect(p.pending).toBe(1);
    expect(p.percent).toBe(33);
  });

  it('progress counts skipped steps toward percent', () => {
    chain.add('s1', { agents: ['a1'], task: 'a' });
    chain.add('s2', { agents: ['a1'], task: 'b' });
    chain.steps.get('s1').status = 'completed';
    chain.steps.get('s2').status = 'skipped';
    const p = chain.progress;
    expect(p.skipped).toBe(1);
    expect(p.percent).toBe(100);
  });

  it('retryAll collects failed step names', async () => {
    chain.retry = async (name) => {
      const step = chain.steps.get(name);
      step.status = 'completed';
      step.result = { ok: true };
      chain.results[name] = step.result;
    };

    chain.add('s1', { agents: ['a1'], task: 'a' });
    chain.add('s2', { agents: ['a1'], task: 'b' });
    chain.add('s3', { agents: ['a1'], task: 'c' });

    chain.steps.get('s1').status = 'completed';
    chain.steps.get('s1').result = {};
    chain.results.s1 = {};
    chain.steps.get('s2').status = 'failed';
    chain.steps.get('s2').error = new Error('fail');
    chain.steps.get('s3').status = 'failed';
    chain.steps.get('s3').error = new Error('fail2');

    const result = await chain.retryAll();
    expect(result.retried).toEqual(['s2', 's3']);
    expect(chain.steps.get('s2').status).toBe('completed');
    expect(chain.steps.get('s3').status).toBe('completed');
  });

  it('retryAll with resetPending also retries pending steps', async () => {
    chain.retry = async (name) => {
      const step = chain.steps.get(name);
      step.status = 'completed';
      step.result = {};
      chain.results[name] = {};
    };

    chain.add('s1', { agents: ['a1'], task: 'a' });
    chain.add('s2', { agents: ['a1'], task: 'b' });
    chain.steps.get('s1').status = 'failed';
    chain.steps.get('s1').error = new Error('x');

    const result = await chain.retryAll({ resetPending: true });
    expect(result.retried).toEqual(['s1', 's2']);
  });
});

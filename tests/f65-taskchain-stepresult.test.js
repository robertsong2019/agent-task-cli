const { TaskChain } = require('../src/task-chain');

describe('F65: TaskChain stepResult()', () => {
  test('returns result of executed step', async () => {
    const chain = new TaskChain('c1');
    chain.add('step1', { pattern: 'mock', task: 'hello' });
    // Directly set result to simulate execution
    chain.results['step1'] = 'hello';
    expect(chain.stepResult('step1')).toBe('hello');
  });

  test('returns undefined for non-existent step', () => {
    const chain = new TaskChain('c2');
    expect(chain.stepResult('nope')).toBeUndefined();
  });

  test('returns undefined for step not yet executed', () => {
    const chain = new TaskChain('c3');
    chain.add('pending', { pattern: 'mock', task: 'x' });
    expect(chain.stepResult('pending')).toBeUndefined();
  });

  test('returns error object for failed step', () => {
    const chain = new TaskChain('c4');
    chain.results['fail'] = { error: 'boom' };
    expect(chain.stepResult('fail').error).toBe('boom');
  });
});

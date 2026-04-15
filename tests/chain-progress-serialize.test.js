const { TaskChain } = require('../src/task-chain');

// Minimal mock orchestrator for unit tests
function mockOrchestrator() {
  return {
    run: jest.fn().mockImplementation((config) => {
      const emitter = new (require('events').EventEmitter)();
      emitter.results = { output: config.name || 'done' };
      // Complete asynchronously
      setTimeout(() => emitter.emit('complete'), 10);
      return Promise.resolve(emitter);
    })
  };
}

describe('TaskChain.onStepComplete', () => {
  test('should call callback after each step completes', async () => {
    const orch = mockOrchestrator();
    const completed = [];
    
    const chain = new TaskChain(orch);
    chain.onStepComplete((info) => completed.push(info));
    chain.add('s1', { name: 'step1' });
    chain.add('s2', { name: 'step2' }, { dependsOn: 's1' });

    await chain.execute();

    expect(completed.length).toBe(2);
    expect(completed[0].name).toBe('s1');
    expect(completed[0].status).toBe('completed');
    expect(completed[1].name).toBe('s2');
  });

  test('should throw if argument is not a function', () => {
    const chain = new TaskChain(mockOrchestrator());
    expect(() => chain.onStepComplete('not a fn')).toThrow('requires a function');
  });

  test('should return this for chaining', () => {
    const chain = new TaskChain(mockOrchestrator());
    const result = chain.onStepComplete(() => {});
    expect(result).toBe(chain);
  });
});

describe('TaskChain.toJSON round-trip', () => {
  test('toJSON returns serializable structure', async () => {
    const orch = mockOrchestrator();
    const chain = new TaskChain(orch);
    chain.add('a', { name: 'alpha' });
    chain.add('b', { name: 'beta' }, { dependsOn: 'a' });

    await chain.execute();

    const json = chain.toJSON();
    expect(json.id).toBe(chain.id);
    expect(json.status).toBe('completed');
    expect(json.steps.length).toBe(2);
    expect(json.steps[0].name).toBe('a');
    expect(json.steps[1].dependsOn).toEqual(['a']);
    expect(json.results.a).toBeDefined();

    // Verify it's actually JSON-serializable
    const str = JSON.stringify(json);
    const parsed = JSON.parse(str);
    expect(parsed.steps.length).toBe(2);
  });

  test('toJSON on pending chain includes step definitions', () => {
    const chain = new TaskChain(mockOrchestrator());
    chain.add('x', { name: 'x' });
    chain.add('y', { name: 'y' }, { dependsOn: 'x' });

    const json = chain.toJSON();
    expect(json.status).toBe('pending');
    expect(json.steps.length).toBe(2);
    expect(json.steps[1].dependsOn).toEqual(['x']);
  });
});

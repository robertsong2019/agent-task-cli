const { TaskChain } = require('../src/task-chain');

// Minimal mock orchestrator
function mockOrch() {
  return {
    run: jest.fn(),
    storage: { saveTask: jest.fn(), updateTask: jest.fn() },
    logger: { error: jest.fn() },
    middleware: [],
    _runPreHooks: jest.fn(c => c),
    _runPostHooks: jest.fn((t, r) => r),
  };
}

describe('TaskChain.fromJSON()', () => {
  test('reconstructs chain with same id, status, steps', () => {
    const orch = mockOrch();
    const chain = new TaskChain(orch);
    chain.add('step1', { pattern: 'work-crew', name: 's1' });
    chain.add('step2', { pattern: 'pipeline', name: 's2' }, { dependsOn: 'step1' });
    chain.status = 'completed';
    chain.results = { step1: { out: 1 }, step2: { out: 2 } };

    const json = chain.toJSON();
    const restored = TaskChain.fromJSON(json, orch);

    expect(restored.id).toBe(chain.id);
    expect(restored.status).toBe('completed');
    expect(restored.stepOrder).toEqual(['step1', 'step2']);
    expect(restored.results).toEqual({ step1: { out: 1 }, step2: { out: 2 } });
  });

  test('restores step metadata (status, startedAt, error)', () => {
    const orch = mockOrch();
    const chain = new TaskChain(orch);
    chain.add('s1', { pattern: 'work-crew' });
    const step = chain.steps.get('s1');
    step.status = 'failed';
    step.startedAt = '2026-01-01T00:00:00Z';
    step.error = 'something broke';

    const json = chain.toJSON();
    const restored = TaskChain.fromJSON(json, orch);
    const rStep = restored.steps.get('s1');

    expect(rStep.status).toBe('failed');
    expect(rStep.startedAt).toBe('2026-01-01T00:00:00Z');
    expect(rStep.error).toBe('something broke');
  });

  test('restores condition function from string', () => {
    const orch = mockOrch();
    const chain = new TaskChain(orch);
    chain.add('s1', { pattern: 'work-crew' });
    chain.add('s2', { pattern: 'pipeline' }, {
      dependsOn: 's1',
      condition: (ctx) => ctx.s1 && ctx.s1.ok,
    });

    const json = chain.toJSON();
    const restored = TaskChain.fromJSON(json, orch);
    const cond = restored.steps.get('s2').condition;

    expect(cond).toBeInstanceOf(Function);
    expect(cond({ s1: { ok: true } })).toBeTruthy();
    expect(cond({ s1: { ok: false } })).toBeFalsy();
  });

  test('handles chain with no conditions or transforms', () => {
    const orch = mockOrch();
    const chain = new TaskChain(orch);
    chain.add('a', { pattern: 'council' });

    const json = chain.toJSON();
    const restored = TaskChain.fromJSON(json, orch);

    expect(restored.steps.get('a').condition).toBeNull();
    expect(restored.steps.get('a').transform).toBeNull();
  });

  test('roundtrip: fromJSON(toJSON()) preserves dependencies', () => {
    const orch = mockOrch();
    const chain = new TaskChain(orch);
    chain.add('a', { pattern: 'work-crew' });
    chain.add('b', { pattern: 'pipeline' }, { dependsOn: 'a' });
    chain.add('c', { pattern: 'council' }, { dependsOn: 'a,b' });

    const restored = TaskChain.fromJSON(chain.toJSON(), orch);

    expect(restored.steps.get('b').dependsOn).toEqual(['a']);
    expect(restored.steps.get('c').dependsOn).toEqual(['a', 'b']);
  });
});

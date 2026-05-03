const PipelinePattern = require('../src/patterns/pipeline');

describe('PipelinePattern', () => {
  const makeConfig = (overrides = {}) => ({
    task: 'Process the data',
    stages: [
      { name: 'extract', agent: 'extractor' },
      { name: 'transform', agent: 'transformer' },
      { name: 'load', agent: 'loader' },
    ],
    ...overrides,
  });

  const cb = jest.fn();

  beforeEach(() => cb.mockClear());

  test('initializeAgents creates one agent per stage', () => {
    const pipeline = new PipelinePattern(makeConfig());
    const agents = pipeline.initializeAgents();
    expect(agents).toHaveLength(3);
  });

  test('execute returns successful pipeline result', async () => {
    const pipeline = new PipelinePattern(makeConfig());
    pipeline.initializeAgents();
    const result = await pipeline.execute(cb);
    expect(result.pattern).toBe('pipeline');
    expect(result.success).toBe(true);
    expect(result.stages).toHaveLength(3);
    expect(result.finalOutput).toBeDefined();
  });

  test('execute passes output of one stage as input to next', async () => {
    const pipeline = new PipelinePattern(makeConfig());
    pipeline.initializeAgents();
    const result = await pipeline.execute(cb);
    // Stage 2 input should be stage 1 output
    expect(result.stages[1].input).toBe(result.stages[0].output);
    expect(result.stages[2].input).toBe(result.stages[1].output);
  });

  test('execute calls updateCallback for each stage', async () => {
    const pipeline = new PipelinePattern(makeConfig());
    pipeline.initializeAgents();
    await pipeline.execute(cb);
    // 3 stages × 2 callbacks (running + completed) = 6
    expect(cb).toHaveBeenCalledTimes(6);
  });

  test('failure strategy stop halts pipeline on error', async () => {
    const pipeline = new PipelinePattern(makeConfig({ failureStrategy: 'stop' }));
    pipeline.initializeAgents();
    pipeline.agents[1].execute = jest.fn().mockRejectedValue(new Error('transform failed'));
    const result = await pipeline.execute(cb);
    expect(result.success).toBe(false);
    expect(result.failedAt).toBe('transform');
    expect(result.error).toBe('transform failed');
    // Extract succeeded, transform failed
    expect(result.results).toHaveLength(2);
    expect(result.results[1].success).toBe(false);
  });

  test('validation gate failure stops pipeline', async () => {
    const pipeline = new PipelinePattern(makeConfig({
      stages: [
        { name: 'short-output', agent: 'minimal' },
      ],
      gates: [{ after: 'short-output', validator: 'minLength' }],
    }));
    pipeline.initializeAgents();
    // Override execute to return very short output
    pipeline.agents[0].execute = jest.fn().mockResolvedValue('hi');
    const result = await pipeline.execute(cb);
    expect(result.success).toBe(false);
    expect(result.failedAt).toBe('short-output');
    expect(result.error).toContain('Validation gate failed');
  });

  test('validation gate passes with long enough output', async () => {
    const pipeline = new PipelinePattern(makeConfig({
      stages: [
        { name: 'long-output', agent: 'verbose' },
      ],
      gates: [{ after: 'long-output', validator: 'minLength' }],
    }));
    pipeline.initializeAgents();
    pipeline.agents[0].execute = jest.fn().mockResolvedValue('This is a sufficiently long output that passes the gate validation');
    const result = await pipeline.execute(cb);
    expect(result.success).toBe(true);
  });

  test('empty stages returns undefined finalOutput', async () => {
    const pipeline = new PipelinePattern({ task: 'empty', stages: [] });
    pipeline.initializeAgents();
    const result = await pipeline.execute(cb);
    expect(result.success).toBe(true);
    expect(result.finalOutput).toBeUndefined();
  });
});

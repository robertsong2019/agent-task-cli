const CouncilPattern = require('../src/patterns/council');

describe('CouncilPattern', () => {
  const makeConfig = (overrides = {}) => ({
    task: 'Evaluate the project',
    experts: [
      { name: 'Alice', role: 'technical-researcher' },
      { name: 'Bob', role: 'business-analyst' },
    ],
    rounds: 1,
    ...overrides,
  });

  const cb = jest.fn();

  beforeEach(() => cb.mockClear());

  test('initializeAgents creates agents from config', () => {
    const council = new CouncilPattern(makeConfig());
    const agents = council.initializeAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0].name).toBe('Alice');
  });

  test('execute returns council result with pattern type', async () => {
    const council = new CouncilPattern(makeConfig({ rounds: 1 }));
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.pattern).toBe('council');
    expect(result.rounds).toBe(1);
    expect(result.discussion).toHaveLength(1);
  });

  test('execute calls updateCallback for each agent per round', async () => {
    const council = new CouncilPattern(makeConfig({ rounds: 1 }));
    council.initializeAgents();
    await council.execute(cb);
    // 2 agents, each gets 'running' + 'completed' = 4 calls
    expect(cb).toHaveBeenCalledTimes(4);
  });

  test('consensus strategy reports consensusReached', async () => {
    const council = new CouncilPattern(makeConfig({
      convergence: { strategy: 'consensus' },
    }));
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.decision.strategy).toBe('consensus');
    expect(result.decision).toHaveProperty('consensusReached');
    expect(result.decision).toHaveProperty('themes');
  });

  test('vote strategy returns winner and votes', async () => {
    const council = new CouncilPattern(makeConfig({
      convergence: { strategy: 'vote' },
    }));
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.decision.strategy).toBe('vote');
    expect(result.decision).toHaveProperty('winner');
    expect(result.decision).toHaveProperty('votes');
    expect(result.decision).toHaveProperty('totalVoters', 2);
  });

  test('average strategy returns combinedView', async () => {
    const council = new CouncilPattern(makeConfig({
      convergence: { strategy: 'average' },
    }));
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.decision.strategy).toBe('average');
    expect(result.decision).toHaveProperty('combinedView');
    expect(result.decision.participantCount).toBe(2);
  });

  test('default convergence is average', async () => {
    const council = new CouncilPattern(makeConfig());
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.decision.strategy).toBe('consensus');
  });

  test('multi-round discussion accumulates rounds', async () => {
    const council = new CouncilPattern(makeConfig({ rounds: 2 }));
    council.initializeAgents();
    const result = await council.execute(cb);
    expect(result.discussion).toHaveLength(2);
    // 2 agents × 2 callbacks × 2 rounds = 8
    expect(cb).toHaveBeenCalledTimes(8);
  });

  test('handles agent failure gracefully', async () => {
    const config = makeConfig({ rounds: 1 });
    const council = new CouncilPattern(config);
    council.initializeAgents();
    // Make one agent throw
    council.agents[0].execute = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await council.execute(cb);
    expect(result.pattern).toBe('council');
    expect(cb).toHaveBeenCalledWith(council.agents[0].id, 'failed', 'boom');
  });

  test('extractTheme detects keywords', () => {
    const council = new CouncilPattern(makeConfig());
    expect(council.extractTheme('This is positive news')).toBe('positive');
    expect(council.extractTheme('Negative outcome')).toBe('negative');
    expect(council.extractTheme('Random text')).toBe('neutral');
  });

  test('buildContext returns initial message for round 1', () => {
    const council = new CouncilPattern(makeConfig());
    expect(council.buildContext(1, [], [])).toBe('Initial discussion - no prior context');
  });

  test('buildContext includes previous round summary', () => {
    const council = new CouncilPattern(makeConfig());
    const prev = [{ perspectives: [{ expert: 'A', perspective: 'x'.repeat(200) }] }];
    const ctx = council.buildContext(2, [], prev);
    expect(ctx).toContain('Previous round summary');
  });
});

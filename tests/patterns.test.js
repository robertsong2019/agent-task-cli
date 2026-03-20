const WorkCrewPattern = require('../src/patterns/work-crew');
const SupervisorPattern = require('../src/patterns/supervisor');
const PipelinePattern = require('../src/patterns/pipeline');
const CouncilPattern = require('../src/patterns/council');
const AutoRoutingPattern = require('../src/patterns/auto-routing');

describe('WorkCrewPattern', () => {
  test('should initialize agents', () => {
    const pattern = new WorkCrewPattern({
      agents: [
        { name: 'agent-1', role: 'Role 1' },
        { name: 'agent-2', role: 'Role 2' }
      ]
    });

    const agents = pattern.initializeAgents();
    expect(agents.length).toBe(2);
    expect(agents[0].name).toBe('agent-1');
    expect(agents[1].name).toBe('agent-2');
  });

  test('should execute and converge results', async () => {
    const pattern = new WorkCrewPattern({
      agents: [
        { name: 'agent-1', role: 'Role 1', delay: 100 }
      ],
      task: 'Test task',
      convergence: { strategy: 'merge' }
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('work-crew');
    expect(results.task).toBe('Test task');
    expect(results.agentResults.length).toBe(1);
    expect(results.converged).toBeDefined();
  });
});

describe('SupervisorPattern', () => {
  test('should initialize supervisor and workers', () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor' },
      workers: [
        { name: 'worker-1' },
        { name: 'worker-2' }
      ]
    });

    const agents = pattern.initializeAgents();
    expect(agents.length).toBe(3);
    expect(pattern.supervisor).toBeDefined();
    expect(pattern.workers.length).toBe(2);
  });

  test('should execute with adaptive strategy', async () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor', strategy: 'adaptive' },
      workers: [
        { name: 'worker-1', delay: 100 }
      ],
      task: 'Test task'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('supervisor');
    expect(results.strategy).toBe('adaptive');
    expect(results.workerResults).toBeDefined();
  }, 10000); // Increase timeout to 10 seconds
});

describe('PipelinePattern', () => {
  test('should initialize stage agents', () => {
    const pattern = new PipelinePattern({
      stages: [
        { name: 'stage-1', agent: 'agent-1' },
        { name: 'stage-2', agent: 'agent-2' }
      ]
    });

    const agents = pattern.initializeAgents();
    expect(agents.length).toBe(2);
  });

  test('should execute stages sequentially', async () => {
    const pattern = new PipelinePattern({
      stages: [
        { name: 'stage-1', agent: 'agent-1' }
      ],
      task: 'Test task'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('pipeline');
    expect(results.success).toBe(true);
    expect(results.stages.length).toBe(1);
  });
});

describe('CouncilPattern', () => {
  test('should initialize expert agents', () => {
    const pattern = new CouncilPattern({
      experts: [
        { name: 'expert-1', role: 'Role 1' },
        { name: 'expert-2', role: 'Role 2' }
      ]
    });

    const agents = pattern.initializeAgents();
    expect(agents.length).toBe(2);
  });

  test('should conduct discussion rounds', async () => {
    const pattern = new CouncilPattern({
      experts: [
        { name: 'expert-1', role: 'Role 1', delay: 100 }
      ],
      task: 'Test task',
      rounds: 2
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('council');
    expect(results.rounds).toBe(2);
    expect(results.discussion.length).toBe(2);
    expect(results.decision).toBeDefined();
  });
});

describe('AutoRoutingPattern', () => {
  test('should initialize agents', () => {
    const pattern = new AutoRoutingPattern({
      agents: [
        { name: 'coder', skills: ['programming'] },
        { name: 'writer', skills: ['documentation'] }
      ]
    });

    const agents = pattern.initializeAgents();
    expect(agents.length).toBe(2);
  });

  test('should route task to appropriate agent', async () => {
    const pattern = new AutoRoutingPattern({
      agents: [
        { name: 'coder', skills: ['programming'], delay: 100 }
      ],
      router: { confidence_threshold: 0.85 },
      task: 'Write code for API'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('auto-routing');
    expect(results.routing).toBeDefined();
    expect(results.results.length).toBeGreaterThan(0);
  });

  test('should analyze task and score agents', () => {
    const pattern = new AutoRoutingPattern({
      agents: [
        { name: 'coder', skills: ['programming', 'debugging'] },
        { name: 'writer', skills: ['documentation', 'blog'] }
      ],
      router: { confidence_threshold: 0.85 },
      task: 'Debug the code'
    });

    pattern.initializeAgents();
    const routing = pattern.analyzeTask('Debug the code');
    
    expect(routing.routes.length).toBeGreaterThan(0);
    expect(routing.routes[0].agent).toBe('coder');
  });
});

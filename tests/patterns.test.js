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

  test('should execute with parallel strategy', async () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor', strategy: 'parallel' },
      workers: [
        { name: 'worker-1', delay: 50 },
        { name: 'worker-2', delay: 50 }
      ],
      task: 'Parallel task'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('supervisor');
    expect(results.strategy).toBe('parallel');
    expect(results.workerResults).toBeDefined();
    expect(results.workerResults.length).toBe(3); // 3 subtasks
    expect(results.subtasks).toBeDefined();
  }, 10000);

  test('should execute with sequential strategy', async () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor', strategy: 'sequential' },
      workers: [
        { name: 'worker-1', delay: 50 }
      ],
      task: 'Sequential task'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('supervisor');
    expect(results.strategy).toBe('sequential');
    expect(results.workerResults).toBeDefined();
    expect(results.workerResults.every(r => r.success)).toBe(true);
  }, 10000);

  test('should handle worker errors in parallel execution', async () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor', strategy: 'parallel' },
      workers: [
        { name: 'worker-1', delay: 50 }
      ],
      task: 'Error task'
    });

    pattern.initializeAgents();
    
    // Override one worker to fail
    const originalExecute = pattern.workers[0].execute.bind(pattern.workers[0]);
    pattern.workers[0].execute = async function() {
      throw new Error('Worker failed');
    };
    
    const results = await pattern.execute(() => {});
    
    expect(results.workerResults).toBeDefined();
    const failedResults = results.workerResults.filter(r => !r.success);
    expect(failedResults.length).toBeGreaterThan(0);
  }, 10000);

  test('should handle worker errors in sequential execution', async () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor', strategy: 'sequential' },
      workers: [
        { name: 'worker-1', delay: 50 }
      ],
      task: 'Error task'
    });

    pattern.initializeAgents();
    
    // Override worker to fail
    pattern.workers[0].execute = async function() {
      throw new Error('Worker failed');
    };
    
    const results = await pattern.execute(() => {});
    
    expect(results.workerResults).toBeDefined();
    expect(results.workerResults.some(r => !r.success)).toBe(true);
  }, 10000);

  test('should decompose task into subtasks', () => {
    const pattern = new SupervisorPattern({
      supervisor: { name: 'supervisor' },
      workers: [],
      task: 'Build feature'
    });

    const subtasks = pattern.decomposeTask('Build feature', 'adaptive');
    
    expect(subtasks.length).toBe(3);
    expect(subtasks[0].type).toBe('research');
    expect(subtasks[1].type).toBe('implementation');
    expect(subtasks[2].type).toBe('testing');
  });
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

describe('PipelinePattern - Advanced', () => {
  test('should execute with validation gates', async () => {
    const pattern = new PipelinePattern({
      stages: [
        { name: 'research', agent: 'researcher' },
        { name: 'draft', agent: 'writer' }
      ],
      gates: [
        { after: 'research', validate: 'completeness' }
      ],
      task: 'Write a report'
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('pipeline');
    expect(results.success).toBe(true);
    expect(results.stages.length).toBe(2);
  });

  test('should fail on gate validation failure', async () => {
    const pattern = new PipelinePattern({
      stages: [
        { name: 'research', agent: 'researcher' },
        { name: 'draft', agent: 'writer' }
      ],
      gates: [
        { after: 'research', validate: 'completeness' }
      ],
      task: 'x' // Very short - will fail gate (output.length <= 10)
    });

    pattern.initializeAgents();
    // Override validateGate to force failure
    pattern.validateGate = async () => false;
    
    const results = await pattern.execute(() => {});
    
    expect(results.success).toBe(false);
    expect(results.failedAt).toBe('research');
    expect(results.error).toContain('Validation gate failed');
  });

  test('should continue on failure with continue strategy', async () => {
    const pattern = new PipelinePattern({
      stages: [
        { name: 'stage-1', agent: 'agent-1' },
        { name: 'stage-2', agent: 'agent-2' }
      ],
      failureStrategy: 'continue',
      task: 'Test task'
    });

    pattern.initializeAgents();
    
    // Make first agent fail
    pattern.agents[0].execute = async () => {
      throw new Error('Stage 1 failed');
    };
    
    const results = await pattern.execute(() => {});
    
    // With 'continue' strategy, it should still try next stages
    expect(results.stages.length).toBe(2);
    expect(results.stages[0].success).toBe(false);
  });

  test('should validate gate with sufficient output', async () => {
    const pattern = new PipelinePattern({
      stages: [{ name: 'test', agent: 'agent' }],
      task: 'Test'
    });

    // Output longer than 10 chars should pass
    const result = await pattern.validateGate({}, 'This is a long enough output for validation');
    expect(result).toBe(true);
    
    // Short output should fail
    const shortResult = await pattern.validateGate({}, 'short');
    expect(shortResult).toBe(false);
  });
});

describe('WorkCrewPattern - Advanced', () => {
  test('should handle agent errors gracefully', async () => {
    const pattern = new WorkCrewPattern({
      agents: [
        { name: 'agent-1', role: 'Role 1' }
      ],
      task: 'Test task',
      convergence: { strategy: 'merge' }
    });

    pattern.initializeAgents();
    
    // Make agent fail
    pattern.agents[0].execute = async () => {
      throw new Error('Agent failed');
    };
    
    const results = await pattern.execute(() => {});
    
    expect(results.agentResults).toBeDefined();
    expect(results.agentResults[0].success).toBe(false);
    expect(results.agentResults[0].error).toBe('Agent failed');
  });

  test('should handle multiple agents with mixed results', async () => {
    const pattern = new WorkCrewPattern({
      agents: [
        { name: 'agent-1', role: 'Role 1', delay: 50 },
        { name: 'agent-2', role: 'Role 2' }
      ],
      task: 'Test task',
      convergence: { strategy: 'merge' }
    });

    pattern.initializeAgents();
    
    // Make one agent fail
    pattern.agents[1].execute = async () => {
      throw new Error('Agent 2 failed');
    };
    
    const results = await pattern.execute(() => {});
    
    expect(results.agentResults.length).toBe(2);
    expect(results.agentResults[0].success).toBe(true);
    expect(results.agentResults[1].success).toBe(false);
  });
});

describe('CouncilPattern - Advanced', () => {
  test('should handle voting with tie', async () => {
    const pattern = new CouncilPattern({
      experts: [
        { name: 'expert-1', role: 'Role 1', delay: 50 },
        { name: 'expert-2', role: 'Role 2', delay: 50 }
      ],
      task: 'Test task',
      rounds: 1,
      voting: { strategy: 'unanimous' }
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.pattern).toBe('council');
    expect(results.decision).toBeDefined();
  });

  test('should execute with multiple rounds', async () => {
    const pattern = new CouncilPattern({
      experts: [
        { name: 'expert-1', role: 'Role 1', delay: 30 }
      ],
      task: 'Complex task',
      rounds: 3
    });

    pattern.initializeAgents();
    const results = await pattern.execute(() => {});
    
    expect(results.rounds).toBe(3);
    expect(results.discussion.length).toBe(3);
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
